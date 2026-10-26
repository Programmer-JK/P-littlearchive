"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useWishlist } from "@/lib/firestore-hooks";
import { db } from "@/lib/firebase";
import { parseLocalDate, today } from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";
import type { WishlistItem, Category, Priority, WishStatus } from "@/lib/types";

const CATEGORIES: Category[] = ["음식", "여행", "전시", "일상", "기타"];
const PRIORITIES: Priority[] = ["보통", "하고 싶음", "꼭 하기"];

interface FormDraft {
  title: string;
  category: Category;
  place: string;
  estimatedCost: string;
  priority: Priority;
  status: WishStatus;
  targetDate: string;
}

const emptyDraft = (): FormDraft => ({
  title: "",
  category: "일상",
  place: "",
  estimatedCost: "",
  priority: "보통",
  status: "wish",
  targetDate: "",
});

export default function WishlistPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;

  const { items } = useWishlist(coupleId);

  // Full edit form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // New ticket sheet
  const [showNewTicket, setShowNewTicket] = useState(false);

  // Schedule sheet
  const [schedulingItem, setSchedulingItem] = useState<WishlistItem | null>(null);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Open form from URL (?new=1)
  useEffect(() => {
    if (searchParams.get("new") === "1" && !showNewTicket) {
      setShowNewTicket(true);
    }
  }, [searchParams]);

  // Stable sort order: computed once on first load, updated only for add/remove
  const PRI_ORDER: Record<Priority, number> = { "꼭 하기": 0, "하고 싶음": 1, "보통": 2 };
  const sortFn = (a: WishlistItem, b: WishlistItem) => {
    const statusOrder = (s: WishStatus) => s === "planned" ? 0 : s === "wish" ? 1 : 2;
    const so = statusOrder(a.status) - statusOrder(b.status);
    if (so !== 0) return so;
    if (a.status === "planned") {
      if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
      if (a.targetDate) return -1;
      if (b.targetDate) return 1;
    }
    return (PRI_ORDER[a.priority] ?? 2) - (PRI_ORDER[b.priority] ?? 2);
  };

  const [orderedIds, setOrderedIds] = useState<string[] | null>(null);
  const prevItemIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(items.map((i) => i.id!).filter(Boolean));
    const prev = prevItemIdsRef.current;

    const added = items.filter((i) => i.id && !prev.has(i.id));
    const removedIds = new Set([...prev].filter((id) => !currentIds.has(id)));

    if (orderedIds === null) {
      // First load: full sort
      const initial = [...items].sort(sortFn).map((i) => i.id!);
      setOrderedIds(initial);
    } else if (added.length > 0 || removedIds.size > 0) {
      setOrderedIds((prev) => [
        ...(prev ?? []).filter((id) => !removedIds.has(id)),
        ...added.map((i) => i.id!),
      ]);
    }

    prevItemIdsRef.current = currentIds;
  }, [items]);

  const sorted =
    orderedIds !== null
      ? orderedIds.map((id) => items.find((i) => i.id === id)).filter(Boolean) as WishlistItem[]
      : [...items].sort(sortFn);

  // Ticket numbers (sequential by createdAt)
  const ticketNumbers = new Map(
    [...items]
      .sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime() ?? 0;
        return ta - tb;
      })
      .map((w, i) => [w.id!, i + 1])
  );

  const openCount = items.filter((w) => w.status !== "done").length;

  function openNew() {
    setShowNewTicket(true);
  }

  function openEdit(item: WishlistItem) {
    setDraft({
      title: item.title,
      category: item.category,
      place: item.place ?? "",
      estimatedCost: item.estimatedCost != null ? String(item.estimatedCost) : "",
      priority: item.priority,
      status: item.status,
      targetDate: item.targetDate ?? "",
    });
    setEditingId(item.id ?? null);
    setFormError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!coupleId || !myUid) return;
    if (!draft.title.trim()) {
      setFormError("하고 싶은 것을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setFormError("");

    try {
      const costNum = draft.estimatedCost ? parseInt(draft.estimatedCost.replace(/[^0-9]/g, "")) : null;
      const data = {
        title: draft.title.trim(),
        category: draft.category,
        place: draft.place.trim() || null,
        estimatedCost: costNum && !isNaN(costNum) ? costNum : null,
        priority: draft.priority,
        status: draft.status,
        targetDate: draft.targetDate || null,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, "couples", coupleId, "wishlist", editingId), data);
        showToast("수정됐어요");
      } else {
        const ref = doc(collection(db, "couples", coupleId, "wishlist"));
        await setDoc(ref, {
          ...data,
          memoryId: null,
          createdBy: myUid,
          createdAt: serverTimestamp(),
        });
        showToast("하고 싶은 것에 담았어요");
      }
      setShowForm(false);
    } catch {
      setFormError("저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!coupleId || !confirmDelete) return;
    try {
      await deleteDoc(doc(db, "couples", coupleId, "wishlist", confirmDelete));
      showToast("삭제됐어요");
      setConfirmDelete(null);
      setShowForm(false);
    } catch {
      showToast("삭제에 실패했어요");
    }
  }

  async function handleNewTicket(title: string, category: Category, priority: Priority) {
    if (!coupleId || !myUid) return;
    const ref = doc(collection(db, "couples", coupleId, "wishlist"));
    await setDoc(ref, {
      title,
      category,
      place: null,
      estimatedCost: null,
      priority,
      status: "wish" as WishStatus,
      targetDate: null,
      memoryId: null,
      createdBy: myUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    showToast("하고 싶은 것에 담았어요");
    setShowNewTicket(false);
  }

  async function handleSchedule(item: WishlistItem, targetDate: string, place: string) {
    if (!coupleId || !item.id) return;
    const newStatus: WishStatus = targetDate ? "planned" : "wish";
    await updateDoc(doc(db, "couples", coupleId, "wishlist", item.id), {
      status: newStatus,
      targetDate: targetDate || null,
      place: place.trim() || item.place || null,
      updatedAt: serverTimestamp(),
    });
    showToast(targetDate ? "계획 중으로 옮겼어요" : "저장됐어요");
    setSchedulingItem(null);
  }

  async function handleStatusChange(item: WishlistItem, newStatus: WishStatus) {
    if (!coupleId || !item.id) return;
    await updateDoc(doc(db, "couples", coupleId, "wishlist", item.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    if (newStatus === "done") showToast("다녀왔어요. 추억을 남겨 볼까요?");
    if (newStatus === "planned") showToast("계획 중으로 옮겼어요");
  }

  return (
    <div className="flex flex-col">
      {/* Title */}
      <div className="px-5 pt-[6px] pb-2">
        <div className="font-heading text-[28px]">하고 싶은 것</div>
        <div className="text-[13px]" style={{ color: "#6B6152" }}>
          남은 표 {openCount}장
        </div>
      </div>

      {/* Ticket list */}
      <div className="px-5 pt-[10px] flex flex-col gap-[14px] pb-4">
        {sorted.length === 0 ? (
          <div className="py-12 text-center flex flex-col gap-[6px]">
            <div className="font-heading text-[22px] text-ink-2">여기는 아직 비어 있어요</div>
            <div className="text-[13px] text-ink-3">가고 싶은 곳, 먹고 싶은 것을 담아 두세요</div>
          </div>
        ) : (
          sorted.map((w) => (
            <TicketCard
              key={w.id!}
              item={w}
              ticketNo={ticketNumbers.get(w.id!) ?? 1}
              onEdit={() => openEdit(w)}
              onSchedule={() => setSchedulingItem(w)}
              onStatusChange={(s) => handleStatusChange(w, s)}
              onGoMemory={() =>
                router.push(
                  w.memoryId
                    ? `/memories/${w.memoryId}`
                    : `/memories/new?fromWish=${w.id}`
                )
              }
            />
          ))
        )}
      </div>

      {/* New ticket sheet */}
      {showNewTicket && (
        <NewTicketSheet
          onSave={handleNewTicket}
          onCancel={() => setShowNewTicket(false)}
        />
      )}

      {/* Schedule sheet */}
      {schedulingItem && (
        <ScheduleSheet
          item={schedulingItem}
          onSave={handleSchedule}
          onCancel={() => setSchedulingItem(null)}
        />
      )}

      {/* Full edit form */}
      {showForm && (
        <WishForm
          draft={draft}
          setDraft={setDraft}
          editing={!!editingId}
          error={formError}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setShowForm(false)}
          onDelete={() => setConfirmDelete(editingId)}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmModal
          title="이 항목을 지울까요?"
          body="되돌릴 수 없어요."
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── TicketCard ─────────────────────────────────────────────────────────────────

function TicketCard({
  item,
  ticketNo,
  onEdit,
  onSchedule,
  onStatusChange,
  onGoMemory,
}: {
  item: WishlistItem;
  ticketNo: number;
  onEdit: () => void;
  onSchedule: () => void;
  onStatusChange: (s: WishStatus) => void;
  onGoMemory: () => void;
}) {
  const isDone = item.status === "done";
  const isPlanned = item.status === "planned";

  const [stamping, setStamping] = useState(false);

  const bandColor = isPlanned ? "#23201C" : isDone ? "#A8977A" : "#CDBFA6";
  const titleColor = isDone ? "#6B6152" : "#23201C";

  // Date display for right stub
  let dateShort = "미정";
  let dow = "";
  let doneDate = "";

  if (item.targetDate) {
    const d = parseLocalDate(item.targetDate);
    const mo = d.getMonth() + 1;
    const dd = d.getDate();
    dateShort = `${String(mo).padStart(2, "0")}.${String(dd).padStart(2, "0")}`;
    const DOW = "일월화수목금토";
    dow = DOW[d.getDay()];
    doneDate = `${String(d.getFullYear()).slice(2)}.${dateShort}`;
  }

  // If done, use today's date as doneDate fallback
  if (isDone && !doneDate) {
    const t = today();
    const yr = String(t.getFullYear()).slice(2);
    const mo = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    doneDate = `${yr}.${mo}.${dd}`;
  }

  // Bottom meta grid
  const costStr = item.estimatedCost ? item.estimatedCost.toLocaleString("ko-KR") + "원" : "—";
  const placeStr = item.place || "—";
  const dateFull = item.targetDate ? `${dateShort} ${dow}` : "미정";

  // Action button
  const btnLabel = isDone ? (item.memoryId ? "추억 보기" : "기록 남기기") : isPlanned ? "했어요" : "날짜 정하기";
  const btnBg = isPlanned && !isDone ? "#23201C" : "transparent";
  const btnFg = isPlanned && !isDone ? "#EFE7D8" : "#23201C";

  const handleAct = () => {
    if (isDone) return onGoMemory();
    if (isPlanned) {
      setStamping(true);
      setTimeout(() => {
        setStamping(false);
        onStatusChange("done");
      }, 480);
      return;
    }
    return onSchedule();
  };

  const no = `No.${String(ticketNo).padStart(4, "0")}`;

  return (
    // Outer wrapper: shadow + 1px outline as box-shadow (follows border-radius)
    <div
      style={{
        position: "relative",
        height: isDone || isPlanned ? 186 : 158,
        borderRadius: 6,
        boxShadow: "0 0 0 1px #DDD3BE",
      }}
    >
      {/* Inner flex row — overflow:hidden clips content to rounded corners */}
      <div style={{ display: "flex", height: "100%", borderRadius: 6, overflow: "hidden" }}>

      {/* Left body */}
      <div
        onClick={onEdit}
        style={{
          flex: 1,
          minWidth: 0,
          background: "#FFFFFF",
          borderTop: `3px solid ${bandColor}`,
          padding: "12px 14px 12px 16px",
          display: "flex",
          flexDirection: "column",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: ".2em", color: "#6B6152", textTransform: "uppercase" }}>
            Our Little Archive
          </span>
          <span style={{ fontSize: 11, color: "#6B6152" }}>{item.category}</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontFamily: "'Gowun Batang', serif",
            fontWeight: 600,
            fontSize: 18,
            lineHeight: 1.35,
            marginTop: 8,
            wordBreak: "keep-all",
            color: titleColor,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          } as React.CSSProperties}
        >
          {item.title}
        </div>

        {/* Bottom grid */}
        <div
          style={{
            marginTop: "auto",
            display: "grid",
            gridTemplateColumns: ".9fr 1.3fr 1fr",
            borderTop: "1px solid #23201C",
            paddingTop: 6,
            gap: 6,
          }}
        >
          <GridCell label="일자" value={dateFull} />
          <GridCell label="장소" value={placeStr} />
          <GridCell label="요금" value={costStr} />
        </div>

        {/* Done stamp */}
        {(isDone || stamping) && (
          <div
            className={stamping ? "stamp-in" : undefined}
            style={{
              position: "absolute",
              right: 12,
              top: 30,
              padding: "5px 9px 4px",
              border: "2px solid #A4583C",
              borderRadius: 5,
              color: "#A4583C",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              transform: "rotate(-11deg)",
              opacity: 0.88,
              mixBlendMode: "multiply",
              pointerEvents: "none",
            } as React.CSSProperties}
          >
            <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: ".12em" }}>다녀옴</span>
            {doneDate && (
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11 }}>
                {doneDate}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right stub */}
      <div
        style={{
          width: 98,
          flexShrink: 0,
          background: "#FFFFFF",
          borderTop: `3px solid ${bandColor}`,
          borderLeft: "1.5px dashed #B7A586",
          padding: "8px 8px 10px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Hole slot — always reserves space; hole appears only when done */}
        <div style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0, position: "relative" }}>
          {(isDone || stamping) && (
            <span
              className={stamping ? "hole-punch" : undefined}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "#F2EDE1",
                boxShadow: "inset 0 1.5px 3px rgba(35,32,28,.32)",
              }}
            />
          )}
        </div>
        {/* Ticket no. */}
        <span
          style={{
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 10,
            color: "#6B6152",
            marginTop: 6,
          }}
        >
          {no}
        </span>
        {/* Date */}
        <span
          style={{
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 22,
            lineHeight: 1.1,
            marginTop: 2,
            color: item.targetDate ? "#23201C" : "#A8977A",
          }}
        >
          {dateShort}
        </span>
        {/* Day */}
        <span style={{ fontSize: 11, color: "#6B6152" }}>
          {dow || (item.targetDate ? "" : "날짜 없음")}
        </span>
        {/* Action + Revert */}
        <div style={{ marginTop: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
          <button
            onClick={handleAct}
            style={{
              width: "100%",
              height: 36,
              borderRadius: 6,
              fontFamily: "'Gowun Dodum', sans-serif",
              fontSize: 13,
              cursor: "pointer",
              background: btnBg,
              color: btnFg,
              border: "1px solid #23201C",
            }}
          >
            {btnLabel}
          </button>
          {(isDone || isPlanned) && (
            <button
              onClick={(e) => { e.stopPropagation(); onStatusChange(isDone ? "planned" : "wish"); }}
              style={{
                width: "100%",
                height: 24,
                border: "none",
                background: "transparent",
                fontFamily: "'Gowun Dodum', sans-serif",
                fontSize: 11,
                color: "#9A9182",
                cursor: "pointer",
              }}
            >
              ↩ 되돌리기
            </button>
          )}
        </div>
      </div>

      </div>{/* /inner flex row */}

      {/* Half-circle cutouts at seam — positioned outside overflow:hidden inner */}
      <span
        style={{
          position: "absolute",
          right: 89,
          top: -9,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#F2EDE1",
          borderBottom: "1px solid #DDD3BE",
          pointerEvents: "none",
        }}
      />
      <span
        style={{
          position: "absolute",
          right: 89,
          bottom: -9,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#F2EDE1",
          borderTop: "1px solid #DDD3BE",
          pointerEvents: "none",
        }}
      />

    </div>
  );
}

function GridCell({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, color: "#6B6152" }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── NewTicketSheet ────────────────────────────────────────────────────────────

function NewTicketSheet({
  onSave,
  onCancel,
}: {
  onSave: (title: string, category: Category, priority: Priority) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("일상");
  const [priority, setPriority] = useState<Priority>("보통");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("하고 싶은 것을 입력해 주세요."); return; }
    setSaving(true);
    try { await onSave(title.trim(), category, priority); }
    catch { setError("저장에 실패했어요."); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{ background: "rgba(35,32,28,.32)" }}>
      <div
        className="max-w-[480px] w-full mx-auto flex flex-col animate-ola-up"
        style={{ background: "#FBF8F1", borderRadius: "22px 22px 0 0", padding: "0 0 env(safe-area-inset-bottom,0)" }}
      >
        {/* Header */}
        <div
          className="grid items-center px-2 pt-4 pb-3"
          style={{ gridTemplateColumns: "72px 1fr 72px", borderBottom: "1px solid #E3DACB" }}
        >
          <button onClick={onCancel} className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer">취소</button>
          <div className="text-center font-heading text-[17px]">새 티켓 만들기</div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
          >
            담기
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">하고 싶은 것</div>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              placeholder="예: 한강 피크닉 가기"
              className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper text-[15px] text-ink outline-none focus:border-sage"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">카테고리</div>
            <div className="flex gap-2 flex-wrap">
              {(["음식", "여행", "전시", "일상", "기타"] as Category[]).map((c) => (
                <ChipBtn key={c} active={category === c} label={c} onClick={() => setCategory(c)} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">얼마나 하고 싶어요?</div>
            <div className="p-1 rounded-[12px] bg-seg-track grid grid-cols-3 gap-1">
              {(["보통", "하고 싶음", "꼭 하기"] as Priority[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className="h-[40px] border-0 rounded-[9px] text-[14px] cursor-pointer"
                  style={{
                    background: priority === p ? "#FBF8F1" : "transparent",
                    color: priority === p ? "#2F2B25" : "#9A9182",
                    boxShadow: priority === p ? "0 1px 3px rgba(60,40,20,.1)" : "none",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="text-[14px] text-clay-deep">{error}</div>}
        </div>
      </div>
    </div>
  );
}

// ── ScheduleSheet ─────────────────────────────────────────────────────────────

function ScheduleSheet({
  item,
  onSave,
  onCancel,
}: {
  item: WishlistItem;
  onSave: (item: WishlistItem, targetDate: string, place: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [targetDate, setTargetDate] = useState(item.targetDate ?? "");
  const [undecided, setUndecided] = useState(!item.targetDate);
  const [place, setPlace] = useState(item.place ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try { await onSave(item, undecided ? "" : targetDate, place); }
    catch { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" style={{ background: "rgba(35,32,28,.32)" }}>
      <div
        className="max-w-[480px] w-full mx-auto flex flex-col animate-ola-up"
        style={{ background: "#FBF8F1", borderRadius: "22px 22px 0 0", padding: "0 0 env(safe-area-inset-bottom,0)" }}
      >
        {/* Header */}
        <div
          className="grid items-center px-2 pt-4 pb-3"
          style={{ gridTemplateColumns: "72px 1fr 72px", borderBottom: "1px solid #E3DACB" }}
        >
          <button onClick={onCancel} className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer">취소</button>
          <div className="text-center font-heading text-[17px]">날짜 정하기</div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
          >
            저장
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 flex flex-col gap-5">
          {/* Item title */}
          <div
            className="px-4 py-3 rounded-[10px]"
            style={{ background: "rgba(125,146,118,.1)", borderLeft: "2.5px solid #7D9276" }}
          >
            <div className="text-[12px] text-ink-3 mb-[2px]">{item.category}</div>
            <div className="font-heading text-[17px] text-ink leading-snug">{item.title}</div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-ink-2">언제쯤?</div>
              <label className="flex items-center gap-[6px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={undecided}
                  onChange={(e) => setUndecided(e.target.checked)}
                  className="w-[16px] h-[16px] accent-sage-deep cursor-pointer"
                />
                <span className="text-[13px] text-ink-2">미정</span>
              </label>
            </div>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              disabled={undecided}
              className="w-full h-[48px] px-[12px] rounded-[10px] border border-line bg-paper text-[15px] text-ink outline-none focus:border-sage disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">
              장소 <span className="text-ink-3">· 선택</span>
            </div>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="어디에서"
              className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper text-[15px] text-ink outline-none focus:border-sage"
            />
          </div>

          <div className="text-[13px] text-ink-3 leading-relaxed">
            저장하면 이 항목이 <span style={{ color: "#50634A", fontWeight: 600 }}>계획 중</span>으로 바뀌어요.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WishForm ──────────────────────────────────────────────────────────────────

function WishForm({
  draft,
  setDraft,
  editing,
  error,
  saving,
  onSave,
  onCancel,
  onDelete,
}: {
  draft: FormDraft;
  setDraft: React.Dispatch<React.SetStateAction<FormDraft>>;
  editing: boolean;
  error: string;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col animate-ola-up max-w-[480px] mx-auto left-1/2 -translate-x-1/2 w-full">
      {/* Header */}
      <div
        className="pt-[54px] px-2 pb-[6px] grid items-center border-b border-line"
        style={{ gridTemplateColumns: "72px 1fr 72px" }}
      >
        <button
          onClick={onCancel}
          className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer"
        >
          취소
        </button>
        <div className="text-center font-heading text-[17px]">
          {editing ? "항목 수정" : "하고 싶은 것"}
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
        >
          저장
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-[18px] flex flex-col gap-5">
        <Field label="하고 싶은 것">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="예: 한강 피크닉 가기"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        <Field label="카테고리">
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <ChipBtn
                key={c}
                active={draft.category === c}
                label={c}
                onClick={() => setDraft((d) => ({ ...d, category: c }))}
              />
            ))}
          </div>
        </Field>

        <Field label={<>장소 <span className="text-ink-3">· 선택</span></>}>
          <input
            value={draft.place}
            onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
            placeholder="어디에서"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        <Field label={<>예상 비용 <span className="text-ink-3">· 선택</span></>}>
          <input
            value={draft.estimatedCost}
            onChange={(e) => setDraft((d) => ({ ...d, estimatedCost: e.target.value }))}
            placeholder="예: 30000"
            inputMode="numeric"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        <Field label="얼마나 하고 싶어요?">
          <div className="p-1 rounded-[12px] bg-seg-track grid grid-cols-3 gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                onClick={() => setDraft((d) => ({ ...d, priority: p }))}
                className="h-[40px] border-0 rounded-[9px] text-[14px] cursor-pointer"
                style={{
                  background: draft.priority === p ? "#FBF8F1" : "transparent",
                  color: draft.priority === p ? "#2F2B25" : "#9A9182",
                  boxShadow: draft.priority === p ? "0 1px 3px rgba(60,40,20,.1)" : "none",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </Field>

        <Field label="상태">
          <div className="p-1 rounded-[12px] bg-seg-track grid grid-cols-2 gap-1">
            {(["wish", "planned"] as WishStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setDraft((d) => ({ ...d, status: s }))}
                className="h-[40px] border-0 rounded-[9px] text-[14px] cursor-pointer"
                style={{
                  background: draft.status === s ? "#FBF8F1" : "transparent",
                  color: draft.status === s ? "#2F2B25" : "#9A9182",
                  boxShadow: draft.status === s ? "0 1px 3px rgba(60,40,20,.1)" : "none",
                }}
              >
                {s === "wish" ? "하고 싶은 일" : "계획 중"}
              </button>
            ))}
          </div>
        </Field>

        <Field label={<>언제쯤 <span className="text-ink-3">· 선택</span></>}>
          <input
            type="date"
            value={draft.targetDate}
            onChange={(e) => setDraft((d) => ({ ...d, targetDate: e.target.value }))}
            className="w-full h-[48px] px-[12px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        {error && <div className="text-[14px] text-clay-deep">{error}</div>}

        {editing && (
          <button
            onClick={onDelete}
            className="h-[48px] rounded-[12px] text-[15px] text-clay-deep cursor-pointer bg-transparent"
            style={{ border: "1px solid #E5CFC3" }}
          >
            이 항목 지우기
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[13px] text-ink-2">{label}</div>
      {children}
    </div>
  );
}

function ChipBtn({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-[38px] px-[15px] rounded-full text-[14px] cursor-pointer"
      style={{
        background: active ? "#50634A" : "transparent",
        color: active ? "#FBF8F1" : "#6E665A",
        border: `1px solid ${active ? "#50634A" : "#D9CFBE"}`,
      }}
    >
      {label}
    </button>
  );
}
