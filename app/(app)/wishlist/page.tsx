"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
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
import { formatYMD, today, parseLocalDate } from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";
import type { WishlistItem, Category, Priority, WishStatus } from "@/lib/types";

const CATEGORIES: Category[] = ["음식", "여행", "전시", "일상", "기타"];
const PRIORITIES: Priority[] = ["보통", "하고 싶음", "꼭 하기"];
const PRI_STYLE: Record<Priority, { bg: string; fg: string }> = {
  "보통": { bg: "#EFE8DC", fg: "#6E665A" },
  "하고 싶음": { bg: "#E4E9DB", fg: "#3F5139" },
  "꼭 하기": { bg: "#F1E2D7", fg: "#8A4A30" },
};

type StatusFilter = "wish" | "planned" | "done";

interface FormDraft {
  title: string;
  category: Category;
  place: string;
  priority: Priority;
  status: WishStatus;
  targetDate: string;
}

const emptyDraft = (): FormDraft => ({
  title: "",
  category: "일상",
  place: "",
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
  const members = coupleData?.members ?? {};

  const { items } = useWishlist(coupleId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("wish");
  const [catFilter, setCatFilter] = useState<Category | "전체">("전체");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<FormDraft>(emptyDraft());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Open form from URL (?new=1) or from + button
  useEffect(() => {
    if (searchParams.get("new") === "1" && !showForm) {
      setDraft(emptyDraft());
      setEditingId(null);
      setShowForm(true);
    }
  }, [searchParams]);

  const filtered = items
    .filter((w) => w.status === statusFilter)
    .filter((w) => catFilter === "전체" || w.category === catFilter)
    .sort((a, b) => {
      if (statusFilter === "planned") {
        if (a.targetDate && b.targetDate) return a.targetDate.localeCompare(b.targetDate);
        if (a.targetDate) return -1;
        if (b.targetDate) return 1;
      }
      const PRI_ORDER: Record<Priority, number> = { "꼭 하기": 0, "하고 싶음": 1, "보통": 2 };
      return (PRI_ORDER[a.priority] ?? 2) - (PRI_ORDER[b.priority] ?? 2);
    });

  const counts: Record<StatusFilter, number> = {
    wish: items.filter((w) => w.status === "wish").length,
    planned: items.filter((w) => w.status === "planned").length,
    done: items.filter((w) => w.status === "done").length,
  };

  function openNew() {
    setDraft(emptyDraft());
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: WishlistItem) {
    setDraft({
      title: item.title,
      category: item.category,
      place: item.place ?? "",
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
      const data = {
        title: draft.title.trim(),
        category: draft.category,
        place: draft.place.trim() || null,
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

  async function handleStatusChange(item: WishlistItem, newStatus: WishStatus) {
    if (!coupleId || !item.id) return;
    await updateDoc(doc(db, "couples", coupleId, "wishlist", item.id), {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    if (newStatus === "planned") showToast("계획 중으로 옮겼어요");
  }

  const statusLabels: Record<StatusFilter, string> = {
    wish: "하고 싶은 일",
    planned: "계획 중",
    done: "완료",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div className="px-5 pt-[6px] flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-heading text-[26px]">하고 싶은 것</div>
          <div className="text-[13px] text-ink-3">둘이 함께 채우는 버킷리스트</div>
        </div>
        <button
          onClick={openNew}
          aria-label="추가"
          className="w-[44px] h-[44px] rounded-full border border-chip-off-bd bg-paper-2 text-[22px] text-ink cursor-pointer leading-none flex items-center justify-center"
        >
          +
        </button>
      </div>

      {/* Status segment */}
      <div className="mx-5 p-1 rounded-[12px] bg-seg-track grid grid-cols-3 gap-1">
        {(["wish", "planned", "done"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="h-[40px] border-0 rounded-[9px] text-[14px] cursor-pointer flex items-center justify-center gap-[5px]"
            style={{
              background: statusFilter === s ? "#FBF8F1" : "transparent",
              color: statusFilter === s ? "#2F2B25" : "#9A9182",
              boxShadow: statusFilter === s ? "0 1px 3px rgba(60,40,20,.1)" : "none",
            }}
          >
            {statusLabels[s]}
            <span className="text-[12px] opacity-60">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto px-5">
        {(["전체", ...CATEGORIES] as Array<Category | "전체">).map((c) => (
          <button
            key={c}
            onClick={() => setCatFilter(c)}
            className="flex-none h-[34px] px-[13px] rounded-full text-[13px] cursor-pointer"
            style={{
              background: catFilter === c ? "#50634A" : "transparent",
              color: catFilter === c ? "#FBF8F1" : "#6E665A",
              border: `1px solid ${catFilter === c ? "#50634A" : "#D9CFBE"}`,
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="px-5 flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="py-9 text-center flex flex-col gap-[6px]">
            <div className="font-hand text-[26px] text-ink-2">여기는 아직 비어 있어요</div>
            <div className="text-[13px] text-ink-3">가고 싶은 곳, 먹고 싶은 것을 담아 두세요</div>
          </div>
        ) : (
          filtered.map((w) => (
            <WishCard
              key={w.id!}
              item={w}
              members={members}
              onEdit={() => openEdit(w)}
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

      {/* Form overlay */}
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

// ── WishCard ──────────────────────────────────────────────────────────────────

function WishCard({
  item,
  members,
  onEdit,
  onStatusChange,
  onGoMemory,
}: {
  item: WishlistItem;
  members: Record<string, { displayName: string }>;
  onEdit: () => void;
  onStatusChange: (s: WishStatus) => void;
  onGoMemory: () => void;
}) {
  const priStyle = PRI_STYLE[item.priority];
  const creatorName = members[item.createdBy]?.displayName ?? "?";

  const metaParts = [
    item.place,
    item.targetDate ? `${formatYMD(item.targetDate)} 예정` : null,
  ].filter(Boolean);

  const daysLeft = item.targetDate
    ? (() => {
        const target = parseLocalDate(item.targetDate);
        return Math.round((target.getTime() - today().getTime()) / 86400000);
      })()
    : null;

  // Action button
  let actionLabel = "";
  let actBg = "transparent";
  let actFg = "#6E665A";
  let actBd = "#D9CFBE";
  let actionFn = onEdit;

  if (item.status === "wish") {
    actionLabel = "계획 세우기";
    actionFn = () => onStatusChange("planned");
  } else if (item.status === "planned") {
    actionLabel = "완료하고 기록하기";
    actBg = "#50634A"; actFg = "#FBF8F1"; actBd = "#50634A";
    actionFn = onGoMemory;
  } else {
    actionLabel = item.memoryId ? "추억 보기" : "기록 남기기";
    actionFn = onGoMemory;
  }

  const byDate = item.createdAt?.toDate
    ? item.createdAt.toDate()
    : null;
  const byLabel = byDate
    ? `${creatorName} 담음 · ${byDate.getMonth() + 1}월 ${byDate.getDate()}일`
    : `${creatorName} 담음`;

  return (
    <div className="bg-paper-2 border border-line-soft rounded-[12px] p-4 flex flex-col gap-[10px]">
      <button
        onClick={onEdit}
        className="border-0 bg-transparent p-0 text-left cursor-pointer flex flex-col gap-2"
      >
        <span className="flex gap-[6px] flex-wrap">
          <span
            className="px-[9px] py-[3px] rounded-full text-[12px]"
            style={{ background: "#EFE8DC", color: "#6E665A" }}
          >
            {item.category}
          </span>
          <span
            className="px-[9px] py-[3px] rounded-full text-[12px]"
            style={{ background: priStyle.bg, color: priStyle.fg }}
          >
            {item.priority}
          </span>
        </span>
        <span
          className="font-heading text-[18px] leading-[1.35] text-ink"
          style={{ textWrap: "pretty" } as React.CSSProperties}
        >
          {item.title}
        </span>
        {metaParts.length > 0 && (
          <span className="text-[13px] text-ink-2 leading-[1.5]">
            {metaParts.join(" · ")}
          </span>
        )}
      </button>

      <div
        className="flex items-center justify-between gap-[10px] border-t border-dashed border-chip-off-bd pt-[10px]"
      >
        <span className="text-[12px] text-ink-3">{byLabel}</span>
        <button
          onClick={actionFn}
          className="h-[38px] px-[14px] rounded-full text-[13px] cursor-pointer"
          style={{ background: actBg, color: actFg, border: `1px solid ${actBd}` }}
        >
          {actionLabel}
        </button>
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
        {/* Title */}
        <Field label="하고 싶은 것">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="예: 한강 피크닉 가기"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        {/* Category */}
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

        {/* Place */}
        <Field label={<>장소 <span className="text-ink-3">· 선택</span></>}>
          <input
            value={draft.place}
            onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
            placeholder="어디에서"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </Field>

        {/* Priority */}
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

        {/* Status */}
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

        {/* Target date */}
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
