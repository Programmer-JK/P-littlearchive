"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function RulesPage() {
  const router = useRouter();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;

  const { rules, loading } = useRules(coupleId);

  const [ruleContent, setRuleContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleAdd() {
    if (!coupleId || !myUid || !ruleContent.trim()) return;
    setAdding(true);
    try {
      const newRef = doc(collection(db, "couples", coupleId, "rules"));
      await setDoc(newRef, {
        content: ruleContent.trim(),
        createdBy: myUid,
        createdAt: serverTimestamp(),
      });
      setRuleContent("");
      showToast("약속이 추가됐어요");
      inputRef.current?.focus();
    } catch (e) {
      console.error(e);
      showToast("추가에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setAdding(false);
    }
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

  return (
    <div
      className="absolute inset-0 z-30 bg-paper overflow-y-auto animate-ola-in"
      style={{ paddingTop: "54px", paddingBottom: "48px" }}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 mb-[6px]">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="w-[44px] h-[44px] border-0 bg-transparent cursor-pointer text-ink flex items-center justify-center"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="font-heading text-[20px]">우리의 약속</div>
      </div>

      <div className="px-5 flex flex-col gap-5">
        {/* Description */}
        <div
          className="p-[12px_14px] rounded-[10px] text-[13px] leading-[1.6] text-ink-2"
          style={{ background: "#E4E9DB", color: "#3F5139" }}
        >
          둘이 함께 지키고 싶은 약속을 적어 두세요. 홈 화면에서 항상 볼 수 있어요.
        </div>

        {/* Rules list — notebook paper look */}
        <div
          className="relative bg-paper-2 rounded-[12px] overflow-hidden"
          style={{
            border: "1px solid #EAE2D4",
            boxShadow: "0 1px 2px rgba(60,40,20,.04), 0 8px 20px -12px rgba(60,40,20,.2)",
          }}
        >
          {/* Decorative pin at top */}
          <div className="flex justify-center pt-[10px] pb-[2px]">
            <div
              className="w-[10px] h-[10px] rounded-full"
              style={{ background: "#C98B6B", boxShadow: "0 1px 4px rgba(60,40,20,.3)" }}
            />
          </div>

          {loading ? (
            <div className="px-5 py-[24px] text-center text-[13px] text-ink-3">
              불러오는 중…
            </div>
          ) : rules.length === 0 ? (
            <div className="px-5 py-[28px] text-center">
              <p className="font-hand text-[22px] text-ink-3 leading-none">아직 약속이 없어요</p>
              <p className="text-[13px] text-ink-3 mt-2">아래에 첫 번째 약속을 적어 보세요.</p>
            </div>
          ) : (
            <div className="px-1 pt-[6px] pb-[10px]">
              {rules.map((r, i) => (
                <div
                  key={r.id!}
                  className="flex items-center gap-3 min-h-[54px] px-4 py-[10px]"
                  style={{
                    borderBottom: i < rules.length - 1 ? "1px solid #EFE8DC" : "none",
                    opacity: deletingId === r.id ? 0.4 : 1,
                    transition: "opacity 0.2s",
                  }}
                >
                  <span
                    className="font-display text-[16px] flex-none w-[22px] text-center"
                    style={{ color: "#C98B6B" }}
                  >
                    {i + 1}.
                  </span>
                  <span className="flex-1 font-hand text-[20px] text-ink-hand leading-[1.35]">
                    {r.content}
                  </span>
                  <button
                    onClick={() => r.id && handleDelete(r.id)}
                    disabled={deletingId !== null}
                    aria-label="삭제"
                    className="w-[44px] h-[44px] border-0 bg-transparent text-ink-3 text-[20px] cursor-pointer flex items-center justify-center disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new rule */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">새 약속 추가</div>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={ruleContent}
              onChange={(e) => setRuleContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAdd();
              }}
              placeholder="예: 매주 금요일은 데이트 날"
              maxLength={60}
              className="flex-1 min-w-0 h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
              disabled={adding}
            />
            <button
              onClick={handleAdd}
              disabled={adding || !ruleContent.trim()}
              className="flex-none h-[48px] px-5 rounded-[10px] border-0 text-[15px] cursor-pointer disabled:opacity-60"
              style={{ background: "#50634A", color: "#FBF8F1" }}
            >
              {adding ? "…" : "추가"}
            </button>
          </div>
          <div className="text-[12px] text-ink-3">Enter를 눌러도 추가할 수 있어요.</div>
        </div>

        {/* Empty state CTA if no rules */}
        {!loading && rules.length === 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-ink-3">이런 약속은 어때요?</div>
            {[
              "매주 금요일은 데이트 날",
              "싸우면 꼭 그날 화해하기",
              "한 달에 한 번 새로운 곳 가보기",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setRuleContent(suggestion)}
                className="text-left h-[44px] px-[14px] rounded-[10px] border cursor-pointer text-[14px] text-ink-2 hover:bg-paper-2 transition-colors"
                style={{ borderColor: "#D9CFBE", background: "transparent" }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
