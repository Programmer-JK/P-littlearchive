"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  updateDoc,
  setDoc,
  deleteDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useAnniversaries, useRules } from "@/lib/firestore-hooks";
import { db } from "@/lib/firebase";
import { formatYMD, toDateString, today } from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";

export default function SettingsPage() {
  const router = useRouter();
  const { coupleData, user, signOutUser, refetchCouple } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;
  const couple = coupleData?.couple;
  const members = coupleData?.members ?? {};
  const partnerUid = coupleData?.partnerUid;

  const { anniversaries } = useAnniversaries(coupleId);
  const { rules } = useRules(coupleId);

  const [coupleName, setCoupleName] = useState(couple?.name ?? "");
  const partnerDisplayName = partnerUid ? (members[partnerUid]?.displayName ?? "") : "";
  const [meName, setMeName] = useState(
    myUid ? (members[myUid]?.displayName ?? "") : ""
  );
  const [startDate, setStartDate] = useState(couple?.startDate ?? "");

  // Anniversary draft
  const [annTitle, setAnnTitle] = useState("");
  const [annDate, setAnnDate] = useState("");
  const [annRepeat, setAnnRepeat] = useState(true);
  const [addingAnn, setAddingAnn] = useState(false);

  // Rule draft
  const [ruleContent, setRuleContent] = useState("");
  const [addingRule, setAddingRule] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const todayStr = toDateString(today());

  const partnerInitial = partnerDisplayName[0] ?? "?";
  const meInitial = meName[0] ?? "나";

  async function handleSaveNames() {
    if (!coupleId || !myUid) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "couples", coupleId), {
        name: coupleName,
        startDate,
        updatedAt: serverTimestamp(),
      });
      if (meName.trim()) {
        await updateDoc(doc(db, "couples", coupleId, "members", myUid), {
          displayName: meName.trim(),
        });
      }
      await refetchCouple();
      showToast("저장됐어요");
    } catch {
      showToast("저장에 실패했어요");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddAnn() {
    if (!coupleId || !myUid || !annTitle.trim() || !annDate) return;
    setAddingAnn(true);
    try {
      await setDoc(doc(collection(db, "couples", coupleId, "anniversaries")), {
        title: annTitle.trim(),
        date: annDate,
        repeatYearly: annRepeat,
        createdBy: myUid,
        createdAt: serverTimestamp(),
      });
      setAnnTitle("");
      setAnnDate("");
      setAnnRepeat(true);
      showToast("기념일이 추가됐어요");
    } catch {
      showToast("추가에 실패했어요");
    } finally {
      setAddingAnn(false);
    }
  }

  async function handleRemoveAnn(id: string) {
    if (!coupleId) return;
    try {
      await deleteDoc(doc(db, "couples", coupleId, "anniversaries", id));
      showToast("삭제됐어요");
    } catch {
      showToast("삭제에 실패했어요");
    }
  }

  async function handleAddRule() {
    if (!coupleId || !myUid || !ruleContent.trim()) return;
    setAddingRule(true);
    try {
      await setDoc(doc(collection(db, "couples", coupleId, "rules")), {
        content: ruleContent.trim(),
        createdBy: myUid,
        createdAt: serverTimestamp(),
      });
      setRuleContent("");
      showToast("규칙이 추가됐어요");
    } catch {
      showToast("추가에 실패했어요");
    } finally {
      setAddingRule(false);
    }
  }

  async function handleRemoveRule(id: string) {
    if (!coupleId) return;
    try {
      await deleteDoc(doc(db, "couples", coupleId, "rules", id));
    } catch {
      showToast("삭제에 실패했어요");
    }
  }

  async function handleLogout() {
    await signOutUser();
    router.replace("/login");
  }

  const isConnected = couple ? couple.memberUids.length >= 2 : false;

  return (
    <div className="absolute inset-0 z-35 bg-paper overflow-y-auto animate-ola-in" style={{ paddingTop: "54px", paddingBottom: "48px" }}>
      {/* Header */}
      <div className="flex items-center gap-1 px-3">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="w-[44px] h-[44px] border-0 bg-transparent cursor-pointer text-ink flex items-center justify-center"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="font-heading text-[20px]">우리 공간</div>
      </div>

      <div className="px-5 pt-[14px] flex flex-col gap-[26px]">
        {/* Couple name */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">공간 이름</div>
          <input
            value={coupleName}
            onChange={(e) => setCoupleName(e.target.value)}
            onBlur={handleSaveNames}
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </div>

        {/* Members */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">두 사람</div>
          <div className="grid gap-[10px]" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
            {/* 파트너 이름: 읽기 전용 */}
            <div className="min-w-0 flex items-center gap-2 h-[48px] px-2 pl-[8px] rounded-[10px] border border-line bg-paper-2">
              <span className="w-[30px] h-[30px] flex-none rounded-full bg-avatar-her flex items-center justify-center font-heading text-[13px]">
                {partnerInitial}
              </span>
              <span className="flex-1 min-w-0 text-[15px] text-ink-2 truncate">
                {partnerDisplayName || "파트너"}
              </span>
            </div>
            {/* 내 이름: 편집 가능 */}
            <label className="min-w-0 flex items-center gap-2 h-[48px] px-2 pl-[8px] rounded-[10px] border border-line bg-paper-2 cursor-text">
              <span className="w-[30px] h-[30px] flex-none rounded-full bg-avatar-me flex items-center justify-center font-heading text-[13px]">
                {meInitial}
              </span>
              <input
                value={meName}
                onChange={(e) => setMeName(e.target.value)}
                onBlur={handleSaveNames}
                className="flex-1 min-w-0 h-[40px] border-0 bg-transparent text-[15px] text-ink outline-none"
              />
            </label>
          </div>
          <div className="text-[12px] text-ink-3">파트너 이름은 파트너가 직접 설정해요.</div>
        </div>

        {/* Connection status */}
        <div
          className="flex items-center gap-3 min-h-[52px] p-[8px_8px_8px_14px] rounded-[12px] bg-paper-2 border border-line-soft -mt-[14px]"
        >
          <span
            className="w-[9px] h-[9px] rounded-full flex-none"
            style={{ background: isConnected ? "#7D9276" : "#C98B6B" }}
          />
          <span className="flex-1 text-[14px] text-ink">
            {isConnected ? "두 사람이 연결됐어요" : "파트너 연결 대기 중"}
          </span>
        </div>

        {/* Start date */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">사귀기 시작한 날</div>
          <input
            type="date"
            value={startDate}
            max={todayStr}
            onChange={(e) => setStartDate(e.target.value)}
            onBlur={handleSaveNames}
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
          <div className="text-[12px] text-ink-3 leading-[1.5]">
            이 날을 1일로 세요. 100일 단위와 매년 기념일이 자동으로 표시돼요.
          </div>
        </div>

        {/* Anniversaries */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">기념일</div>
          <div className="bg-paper-2 border border-line-soft rounded-[12px] overflow-hidden">
            {anniversaries.map((a) => (
              <div
                key={a.id!}
                className="flex items-center gap-[10px] min-h-[56px] px-4 py-[6px] border-b border-line-faint"
              >
                <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                  <span className="text-[15px]">{a.title}</span>
                  <span className="text-[12px] text-ink-3">
                    {formatYMD(a.date)}{a.repeatYearly ? " · 매년 반복" : ""}
                  </span>
                </div>
                <button
                  onClick={() => a.id && handleRemoveAnn(a.id)}
                  aria-label="삭제"
                  className="w-[44px] h-[44px] border-0 bg-transparent text-ink-3 text-[20px] cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add form */}
            <div className="p-3 flex flex-col gap-2" style={{ background: "#F7F2E9" }}>
              <input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="기념일 이름"
                className="w-full h-[44px] px-3 rounded-[8px] border border-line bg-polaroid text-[14px] text-ink outline-none focus:border-sage"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={annDate}
                  onChange={(e) => setAnnDate(e.target.value)}
                  className="flex-1 min-w-0 h-[44px] px-[10px] rounded-[8px] border border-line bg-polaroid text-[14px] text-ink outline-none focus:border-sage"
                />
                <button
                  onClick={() => setAnnRepeat((r) => !r)}
                  className="flex-none h-[44px] px-3 rounded-[8px] text-[13px] cursor-pointer"
                  style={{
                    background: annRepeat ? "#50634A" : "transparent",
                    color: annRepeat ? "#FBF8F1" : "#6E665A",
                    border: `1px solid ${annRepeat ? "#50634A" : "#D9CFBE"}`,
                  }}
                >
                  매년 반복
                </button>
              </div>
              <button
                onClick={handleAddAnn}
                disabled={addingAnn || !annTitle.trim() || !annDate}
                className="h-[44px] rounded-[8px] border-0 bg-sage-deep text-paper-2 text-[14px] cursor-pointer disabled:opacity-60"
              >
                기념일 추가
              </button>
            </div>
          </div>
        </div>

        {/* 둘만의 규칙 */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">둘만의 규칙</div>
          <div className="bg-paper-2 border border-line-soft rounded-[12px] overflow-hidden">
            {rules.length === 0 && (
              <div className="px-4 py-[18px] text-[13px] text-ink-3 text-center">
                아직 규칙이 없어요. 둘만의 약속을 만들어 보세요.
              </div>
            )}
            {rules.map((r, i) => (
              <div
                key={r.id!}
                className="flex items-center gap-[10px] min-h-[52px] px-4 py-[8px] border-b border-line-faint"
              >
                <span className="text-[13px] text-ink-3 flex-none w-[20px]">{i + 1}</span>
                <span className="flex-1 text-[15px] text-ink leading-[1.4]">{r.content}</span>
                <button
                  onClick={() => r.id && handleRemoveRule(r.id)}
                  aria-label="삭제"
                  className="w-[44px] h-[44px] border-0 bg-transparent text-ink-3 text-[20px] cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add form */}
            <div className="p-3 flex gap-2" style={{ background: "#F7F2E9" }}>
              <input
                value={ruleContent}
                onChange={(e) => setRuleContent(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                placeholder="예: 매주 금요일은 데이트 날"
                className="flex-1 min-w-0 h-[44px] px-3 rounded-[8px] border border-line bg-polaroid text-[14px] text-ink outline-none focus:border-sage"
              />
              <button
                onClick={handleAddRule}
                disabled={addingRule || !ruleContent.trim()}
                className="flex-none h-[44px] px-4 rounded-[8px] border-0 bg-sage-deep text-paper-2 text-[14px] cursor-pointer disabled:opacity-60"
              >
                추가
              </button>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/onboarding")}
            className="h-[50px] rounded-[12px] border border-chip-off-bd bg-transparent text-[15px] text-ink cursor-pointer"
          >
            처음 설정 다시 하기
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="h-[50px] rounded-[12px] border border-chip-off-bd bg-transparent text-[15px] text-clay-deep cursor-pointer"
          >
            로그아웃
          </button>
        </div>
      </div>

      {showLogoutConfirm && (
        <ConfirmModal
          title="로그아웃 할까요?"
          body="다시 로그인하면 그대로 돌아올 수 있어요."
          confirmLabel="로그아웃"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}
