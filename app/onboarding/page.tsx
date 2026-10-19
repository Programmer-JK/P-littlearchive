"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { today, toDateString, daysBetween, parseLocalDate, formatDot } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4;

interface Draft {
  selfName: string;
  startDate: string;
  metDate: string;
}

export default function OnboardingPage() {
  const { user, coupleData, loading, refetchCouple } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [draft, setDraft] = useState<Draft>({
    selfName: "",
    startDate: "",
    metDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 2단계: 초대 링크 상태
  const [createdCoupleId, setCreatedCoupleId] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [partnerJoined, setPartnerJoined] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 커플 연결 감지 (실시간)
  useEffect(() => {
    if (!createdCoupleId || step !== 2) return;
    const unsub = onSnapshot(doc(db, "couples", createdCoupleId), (snap) => {
      const data = snap.data();
      if (data?.memberUids?.length >= 2) {
        setPartnerJoined(true);
      }
    });
    return unsub;
  }, [createdCoupleId, step]);

  // 리다이렉트
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (coupleData?.couple.startDate) {
      router.replace("/");
    } else if (coupleData && !coupleData.couple.startDate) {
      // 새로고침 복구: 커플은 있는데 날짜 미설정
      setCreatedCoupleId(coupleData.coupleId);
      setStep((s) => (s < 3 ? 3 : s));
    }
  }, [user, coupleData, loading, router]);

  const todayStr = toDateString(today());

  const dayPreview = draft.startDate
    ? (() => {
        const n = daysBetween(today(), parseLocalDate(draft.startDate)) + 1;
        return `오늘이 함께한 지 ${n}일째예요`;
      })()
    : "";

  const obDateDot = draft.startDate ? formatDot(draft.startDate) : "YYYY.MM.DD";
  const selfInitial = draft.selfName[0] ?? "나";
  const obSummary = draft.startDate
    ? `${obDateDot}부터 함께하고 있어요.${draft.metDate ? " 처음 만난 날도 기념일로 저장할게요." : ""}`
    : "";

  const inviteUrl =
    inviteCode && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${inviteCode}`
      : null;

  async function createInvite() {
    if (!user) return;
    setInviteLoading(true);
    setInviteError("");
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/invite/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, selfName: draft.selfName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "오류가 발생했어요.");
      setCreatedCoupleId(data.coupleId);
      setInviteCode(data.code);
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : "링크 생성에 실패했어요.");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!inviteUrl) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Our Little Archive 초대", url: inviteUrl });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  }

  async function handleNext() {
    setError("");

    if (step === 1) {
      if (!draft.selfName.trim()) {
        setError("이름을 입력해 주세요.");
        return;
      }
      setStep(2);
      createInvite();
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!draft.startDate) {
        setError("사귀기 시작한 날을 선택해 주세요.");
        return;
      }
      if (draft.startDate > todayStr) {
        setError("오늘 이후 날짜는 선택할 수 없어요.");
        return;
      }
      setStep(4);
    } else if (step === 4) {
      await handleFinish();
    }
  }

  async function handleFinish() {
    if (!user) return;
    const coupleId = createdCoupleId ?? coupleData?.coupleId;
    if (!coupleId) {
      setError("커플 정보를 찾을 수 없어요. 처음부터 다시 시도해 주세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "couples", coupleId), {
        startDate: draft.startDate,
        updatedAt: serverTimestamp(),
      });

      if (draft.metDate) {
        await setDoc(doc(collection(db, "couples", coupleId, "anniversaries")), {
          title: "처음 만난 날",
          date: draft.metDate,
          repeatYearly: true,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        });
      }

      await refetchCouple();
      router.replace("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "저장에 실패했어요.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const ctaLabel = () => {
    if (step === 1) return "다음";
    if (step === 2) return partnerJoined ? "다음" : "보냈어요, 다음으로";
    if (step === 3) return "다음";
    return saving ? "저장 중…" : "기록 시작하기";
  };

  const ctaDisabled = (step === 2 && inviteLoading) || saving;

  const dots = [1, 2, 3].map((n) => ({
    active: n === step || (n === 3 && step === 4),
    done: n < step,
  }));

  if (loading || !user) return <div className="absolute inset-0 bg-paper" />;

  return (
    <div
      className="absolute inset-0 z-[80] bg-paper flex flex-col animate-ola-fade"
      style={{ padding: "56px 24px 34px" }}
    >
      {/* Header */}
      <div className="h-[44px] flex items-center justify-between">
        <div className="w-[44px]">
          {step > 1 && step <= 3 && (
            <button
              onClick={() => setStep((s) => Math.max(1, s - 1) as Step)}
              className="w-[44px] h-[44px] -ml-3 border-0 bg-transparent cursor-pointer flex items-center justify-center text-ink"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex gap-[6px] items-center">
          {dots.map((d, i) => (
            <span
              key={i}
              className="h-[7px] rounded-[9px] transition-all duration-250"
              style={{
                width: d.active ? "22px" : "7px",
                background: d.active ? "#50634A" : "#D9CFBE",
              }}
            />
          ))}
        </div>

        <div className="w-[44px] text-right text-[12px] text-ink-3">
          {step < 4 ? `${Math.min(step, 3)} / 3` : ""}
        </div>
      </div>

      {/* Step 1: 이름 */}
      {step === 1 && (
        <div className="pt-[28px] flex flex-col gap-[26px] animate-ola-in">
          <div className="flex flex-col gap-[10px]">
            <div className="text-[13px] text-sage">우리 공간 만들기</div>
            <div className="font-heading text-[29px] leading-[1.35]">
              어떻게 불러드릴까요?
            </div>
            <div className="text-[14px] leading-[1.6] text-ink-2">
              상대방에게 보일 이름이에요.
            </div>
          </div>

          <div className="flex flex-col gap-[8px]">
            <div className="text-[13px] text-ink-2">내 이름</div>
            <input
              value={draft.selfName}
              onChange={(e) => setDraft((d) => ({ ...d, selfName: e.target.value }))}
              placeholder="예: 지훈"
              className="w-full h-[50px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[16px] text-ink outline-none focus:border-sage"
            />
          </div>
        </div>
      )}

      {/* Step 2: 초대 */}
      {step === 2 && (
        <div className="pt-[28px] flex flex-col gap-[22px] animate-ola-in">
          <div className="flex flex-col gap-[10px]">
            <div className="text-[13px] text-sage">초대하기</div>
            <div className="font-heading text-[29px] leading-[1.35]">
              파트너에게<br />초대 링크를 보내세요
            </div>
          </div>

          {/* 초대 링크 카드 */}
          <div
            className="relative p-[20px_18px_16px] rounded-[14px] bg-polaroid flex flex-col gap-[14px]"
            style={{ border: "1.5px dashed #CFC5B3" }}
          >
            <div className="flex flex-col gap-[4px]">
              <span className="text-[12px] text-ink-3">초대 링크</span>
              {inviteLoading ? (
                <span className="font-mono text-[14px] text-ink-3">링크 만드는 중…</span>
              ) : inviteError ? (
                <div className="flex flex-col gap-[8px]">
                  <span className="text-[13px] text-clay-deep">{inviteError}</span>
                  <button
                    onClick={createInvite}
                    className="text-[13px] text-sage-deep underline text-left cursor-pointer"
                  >
                    다시 시도
                  </button>
                </div>
              ) : inviteUrl ? (
                <span className="font-mono text-[14px] text-ink break-all leading-[1.5]">
                  {inviteUrl}
                </span>
              ) : null}
            </div>

            {inviteUrl && (
              <div className="flex gap-[8px]">
                <button
                  onClick={handleCopy}
                  className="flex-1 h-[40px] rounded-[9px] border border-line bg-paper text-[14px] text-ink cursor-pointer"
                >
                  {copied ? "복사됐어요 ✓" : "링크 복사"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 h-[40px] rounded-[9px] bg-sage-deep text-paper-2 text-[14px] cursor-pointer border-0"
                >
                  공유하기
                </button>
              </div>
            )}
          </div>

          {/* 연결 상태 */}
          {inviteUrl && (
            <div
              className="flex items-center gap-[12px] px-[16px] py-[14px] rounded-[12px]"
              style={{ background: partnerJoined ? "#E4E9DB" : "#FBF8F1", border: "1px solid #E3DACB" }}
            >
              {partnerJoined ? (
                <>
                  <div className="flex -space-x-[8px]">
                    <span className="w-[32px] h-[32px] rounded-full bg-avatar-me border-[2px] border-paper-2 flex items-center justify-center font-heading text-[13px]">
                      {selfInitial}
                    </span>
                    <span className="w-[32px] h-[32px] rounded-full bg-avatar-her border-[2px] border-paper-2 flex items-center justify-center font-heading text-[13px]">
                      ♥
                    </span>
                  </div>
                  <span className="text-[14px] text-sage-deep font-heading">
                    파트너와 연결됐어요
                  </span>
                </>
              ) : (
                <>
                  <div className="flex gap-[5px] items-center">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-[6px] h-[6px] rounded-full bg-sage"
                        style={{
                          animation: "pulse 1.4s ease-in-out infinite",
                          animationDelay: `${i * 0.28}s`,
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-[14px] text-ink-2">대기 중</span>
                </>
              )}
            </div>
          )}

          <div className="text-[13px] leading-[1.6] text-ink-2">
            링크는 48시간 동안, 한 사람만 쓸 수 있어요. 파트너가 링크를 열고 Google로 로그인하면 바로 연결돼요.
          </div>
        </div>
      )}

      {/* Step 3: 날짜 */}
      {step === 3 && (
        <div className="pt-[20px] flex flex-col gap-[22px] animate-ola-in">
          <div className="flex items-end gap-[18px]">
            <div className="flex flex-col gap-[10px]">
              <div className="text-[13px] text-sage">우리의 날짜</div>
              <div className="font-heading text-[29px] leading-[1.35]">
                언제부터<br />함께였나요?
              </div>
            </div>
            <div className="flex-none mb-[-4px]">
              <Image
                src="/assets/onboarding-couple.png"
                alt="커플 일러스트"
                width={96}
                height={96}
                className="rounded-[16px]"
              />
            </div>
          </div>

          <div className="flex flex-col gap-[8px]">
            <div className="text-[13px] text-ink-2">사귀기 시작한 날</div>
            <input
              type="date"
              value={draft.startDate}
              max={todayStr}
              onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))}
              className="w-full h-[50px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[16px] text-ink outline-none focus:border-sage"
            />
            {dayPreview && (
              <div className="text-[13px] text-sage-deep">{dayPreview}</div>
            )}
          </div>

          <div className="flex flex-col gap-[8px]">
            <div className="text-[13px] text-ink-2">
              처음 만난 날 <span className="text-ink-3">· 선택</span>
            </div>
            <input
              type="date"
              value={draft.metDate}
              max={todayStr}
              onChange={(e) => setDraft((d) => ({ ...d, metDate: e.target.value }))}
              className="w-full h-[50px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[16px] text-ink outline-none focus:border-sage"
            />
            <div className="text-[12px] text-ink-3">매년 기념일로 홈에 보여 드릴게요.</div>
          </div>
        </div>
      )}

      {/* Step 4: 요약 */}
      {step === 4 && (
        <div className="pt-[40px] flex flex-col items-center gap-[28px] text-center animate-ola-in">
          <div
            className="relative w-[190px] flex flex-col"
            style={{
              padding: "10px 10px 40px",
              background: "#FFFDF8",
              boxShadow: "0 16px 30px -16px rgba(60,40,20,.5)",
              transform: "rotate(-3deg)",
            }}
          >
            <div
              className="absolute top-[-10px] left-1/2 w-[70px] h-[20px] -translate-x-1/2"
              style={{ background: "rgba(222,208,170,.8)", transform: "translateX(-50%) rotate(3deg)" }}
            />
            <div className="aspect-square overflow-hidden">
              <Image
                src="/assets/onboarding-couple.png"
                alt="커플 일러스트"
                width={400}
                height={400}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute left-0 right-0 bottom-[9px] font-hand text-[23px] text-ink-hand text-center">
              {obDateDot} ~
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className="font-heading text-[28px]">준비됐어요</div>
            <div
              className="text-[14px] leading-[1.65] text-ink-2"
              style={{ textWrap: "pretty" } as React.CSSProperties}
            >
              {obSummary}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {error && (
        <div className="text-[14px] text-clay-deep text-center pb-3">{error}</div>
      )}

      <button
        onClick={handleNext}
        disabled={ctaDisabled}
        className="h-[54px] rounded-[12px] border-0 bg-sage-deep text-paper-2 text-[16px] cursor-pointer disabled:opacity-60"
      >
        {ctaLabel()}
      </button>
    </div>
  );
}
