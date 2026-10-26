"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  doc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useRules } from "@/lib/firestore-hooks";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/toast";

function josaGwaWa(name: string) {
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return "와";
  return (code - 0xac00) % 28 > 0 ? "과" : "와";
}

export default function RulesPage() {
  const searchParams = useSearchParams();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;

  const { rules, loading } = useRules(coupleId);

  const [showSheet, setShowSheet] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1" && !showSheet) {
      setShowSheet(true);
    }
  }, [searchParams]);

  const myName = myUid ? (coupleData?.members[myUid]?.displayName ?? "나") : "나";
  const partnerUid = coupleData?.partnerUid;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "상대")
    : "상대";
  const startDate = coupleData?.couple.startDate ?? "";
  const startDateFormatted = startDate.replace(/-/g, ".");

  async function handleAdd(content: string) {
    if (!coupleId || !myUid) return;
    const newRef = doc(collection(db, "couples", coupleId, "rules"));
    await setDoc(newRef, {
      content,
      createdBy: myUid,
      createdAt: serverTimestamp(),
    });
    showToast("약속이 추가됐어요");
  }

  async function handleDelete(id: string) {
    if (!coupleId) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, "couples", coupleId, "rules", id));
      showToast("삭제됐어요");
    } catch {
      showToast("삭제에 실패했어요");
    } finally {
      setDeletingId(null);
    }
  }

  const josa = josaGwaWa(partnerName);

  return (
    <div className="flex flex-col">
      {/* Title */}
      <div className="px-5 pt-[6px] pb-2 flex items-start justify-between">
        <div>
          <div className="font-heading text-[28px]">우리의 약속</div>
          <div className="text-[13px]" style={{ color: "#6B6152" }}>
            약속 {rules.length}개
          </div>
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          className="h-[44px] px-1 border-0 bg-transparent text-[15px] cursor-pointer mt-[4px]"
          style={{ color: editMode ? "#50634A" : "#6E665A" }}
        >
          {editMode ? "완료" : "편집"}
        </button>
      </div>

      {/* Contract card */}
      <div className="px-5">
        <div
          className="rounded-[5px]"
          style={{
            background: "#FFFDF8",
            border: "1px solid #EAE2D4",
            padding: "0px 10px 0px 10px",
            boxShadow:
              "0 1px 2px rgba(60,40,20,.06), 0 14px 28px -18px rgba(60,40,20,.35)",
          }}
        >
          {/* Card header row */}
          <div
            className="flex items-baseline justify-between px-5 pt-[14px] pb-[10px]"
          >
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 10,
                letterSpacing: ".1em",
                color: "#9A9182",
                textTransform: "uppercase",
              }}
            >
              Our Little Archive
            </span>
            <span
              style={{
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 11,
                color: "#9A9182",
              }}
            >
              {startDateFormatted} —
            </span>
          </div>

          {/* Subtitle */}
          <div
            className="px-2 py-[12px]"
            style={{ borderBottom: "1px solid #2F2B25" }}
          >
            <span className="font-heading text-[16px]" style={{ color: "#2F2B25", fontWeight: "700" }}>
              {partnerName}{josa} 나는 아래와 같이 약속한다.
            </span>
          </div>

          {/* Rules list */}
          {loading ? (
            <div className="px-5 py-[24px] text-center text-[13px] text-ink-3">
              불러오는 중…
            </div>
          ) : (
            <>
              {rules.map((r, i) => (
                <div
                  key={r.id!}
                  className="flex items-start gap-3 px-2 py-[14px]"
                  style={{
                    borderBottom: "1px dashed #DDD3BE",
                    opacity: deletingId === r.id ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "ui-monospace, Menlo, monospace",
                      fontSize: 11,
                      color: "#9A9182",
                      flexShrink: 0,
                      width: 34,
                      paddingTop: 2,
                    }}
                  >
                    제{i + 1}조
                  </span>
                  <span
                    className="flex-1 font-heading text-[16px] leading-[1.5]"
                    style={{ color: "#2F2B25", wordBreak: "break-word", minWidth: 0 }}
                  >
                    {r.content}
                  </span>
                  {editMode && (
                    <button
                      onClick={() => r.id && handleDelete(r.id)}
                      disabled={deletingId !== null}
                      aria-label="삭제"
                      className="w-[28px] h-[28px] rounded-full border-0 flex items-center justify-center cursor-pointer disabled:opacity-40 flex-shrink-0"
                      style={{ background: "#F1E2D7", color: "#A4583C", fontSize: 15 }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

            </>
          )}

          {/* Add row — edit mode only */}
          {editMode && (
            <button
              onClick={() => setShowSheet(true)}
              className="w-full flex items-center gap-3 px-2 min-h-[52px] py-[12px] border-0 text-left cursor-pointer"
              style={{ background: "transparent", borderBottom: "1px dashed #DDD3BE" }}
            >
              <span
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: 11,
                  color: "#C5BCB0",
                  flexShrink: 0,
                  width: 34,
                }}
              >
                제{rules.length + 1}조
              </span>
              <span className="font-heading text-[16px]" style={{ color: "#7D9276" }}>
                + 새 약속 추가
              </span>
            </button>
          )}

          {/* Signatures */}
          <div className="flex items-center justify-center gap-8 px-5 py-[22px]">
            <div className="flex items-center gap-[8px]">
              <span className="text-[13px]" style={{ color: "#6E665A" }}>
                {partnerName}
              </span>
              <StampCircle name={partnerName} color="#B9C3AC" />
            </div>
            <div className="flex items-center gap-[8px]">
              <span className="text-[13px]" style={{ color: "#6E665A" }}>
                나
              </span>
              <StampCircle name={myName} color="#D4AFA0" />
            </div>
          </div>
        </div>
      </div>

      {/* Add rule sheet */}
      {showSheet && (
        <AddRuleSheet
          onSave={handleAdd}
          onCancel={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}

// ── StampCircle ────────────────────────────────────────────────────────────────

function StampCircle({ name, color }: { name: string; color: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      <span
        style={{
          fontFamily: "'Nanum Pen Script', cursive",
          fontSize: 22,
          color,
          lineHeight: 1,
        }}
      >
        {name.charAt(0)}
      </span>
    </div>
  );
}

// ── AddRuleSheet ───────────────────────────────────────────────────────────────

function AddRuleSheet({
  onSave,
  onCancel,
}: {
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!content.trim()) {
      setError("약속 내용을 입력해 주세요.");
      return;
    }
    setSaving(true);
    try {
      await onSave(content.trim());
      onCancel();
    } catch {
      setError("저장에 실패했어요.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col justify-end"
      style={{ background: "rgba(35,32,28,.32)" }}
    >
      <div
        className="max-w-[480px] w-full mx-auto flex flex-col animate-ola-up"
        style={{
          background: "#FBF8F1",
          borderRadius: "22px 22px 0 0",
          padding: "0 0 env(safe-area-inset-bottom,0)",
        }}
      >
        <div
          className="grid items-center px-2 pt-4 pb-3"
          style={{ gridTemplateColumns: "72px 1fr 72px", borderBottom: "1px solid #E3DACB" }}
        >
          <button
            onClick={onCancel}
            className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer"
          >
            취소
          </button>
          <div className="text-center font-heading text-[17px]">새 약속</div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
          >
            {saving ? "…" : "추가"}
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">약속 내용</div>
            <input
              autoFocus
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleSave();
              }}
              placeholder="예: 매주 금요일은 데이트 날"
              maxLength={60}
              className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper text-[15px] text-ink outline-none focus:border-sage"
              disabled={saving}
            />
          </div>

          {error && <div className="text-[14px] text-clay-deep">{error}</div>}
        </div>
      </div>
    </div>
  );
}
