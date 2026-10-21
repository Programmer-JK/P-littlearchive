"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";

type Status = "pending" | "processing" | "naming" | "saving" | "error";

export default function InvitePage(props: { params: Promise<{ code: string }> }) {
  const { code } = use(props.params);
  const router = useRouter();
  const { user, loading, signInWithGoogle, refetchCouple } = useAuth();
  const [status, setStatus] = useState<Status>("pending");
  const [error, setError] = useState("");
  const [nameError, setNameError] = useState("");
  const [acceptedCoupleId, setAcceptedCoupleId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (status === "pending") handleAccept();
  }, [user, loading]);

  async function handleAccept() {
    setStatus("processing");
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          uid: user?.uid,
          displayName: user?.displayName ?? "",
          photoURL: user?.photoURL ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "초대 수락에 실패했어요");
      setAcceptedCoupleId(data.coupleId);
      // 초대 수락 즉시 coupleData 갱신 — 이름 저장 전에도 앱이 정상 작동하도록
      await refetchCouple();
      setStatus("naming");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "오류가 발생했어요";
      setError(msg);
      setStatus("error");
    }
  }

  async function handleSaveName() {
    if (!displayName.trim() || !user || !acceptedCoupleId) return;
    setStatus("saving");
    setNameError("");
    try {
      await updateDoc(
        doc(db, "couples", acceptedCoupleId, "members", user.uid),
        { displayName: displayName.trim() }
      );
      await refetchCouple();
      router.replace("/");
    } catch (e) {
      console.error("이름 저장 실패:", e);
      setNameError("저장에 실패했어요. 다시 시도해 주세요.");
      setStatus("naming");
    }
  }

  // 로딩 / 처리 중
  if (loading || status === "processing") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-paper">
        <div className="text-[14px] text-ink-3">연결 중…</div>
      </div>
    );
  }

  // 로그인 필요
  if (!user) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper gap-6 px-8">
        <div className="font-heading text-[22px] text-center">초대 링크로 왔군요!</div>
        <div className="text-[14px] text-ink-2 text-center leading-[1.6]">
          Google 계정으로 로그인하면 바로 연결될 거예요.
        </div>
        <button
          onClick={signInWithGoogle}
          className="h-[54px] w-full max-w-[320px] rounded-[12px] border border-chip-off-bd bg-polaroid flex items-center justify-center gap-[10px] text-[16px] text-ink cursor-pointer"
        >
          <span className="w-[22px] h-[22px] rounded-full border-[1.5px] border-ink-2 flex items-center justify-center font-[600] text-[12px] text-ink-2">
            G
          </span>
          Google로 계속하기
        </button>
      </div>
    );
  }

  // 이름 입력
  if (status === "naming" || status === "saving") {
    return (
      <div
        className="absolute inset-0 bg-paper flex flex-col animate-ola-fade"
        style={{ padding: "80px 24px 40px" }}
      >
        <div className="flex flex-col gap-[10px]">
          <div className="text-[13px] text-sage">연결됐어요</div>
          <div className="font-heading text-[29px] leading-[1.35]">
            어떻게 불러드릴까요?
          </div>
          <div className="text-[14px] leading-[1.6] text-ink-2">
            파트너에게 보일 이름이에요.
          </div>
        </div>

        <div className="mt-[32px] flex flex-col gap-[8px]">
          <div className="text-[13px] text-ink-2">내 이름</div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="예: 애칭"
            autoFocus
            className="w-full h-[50px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[16px] text-ink outline-none focus:border-sage"
          />
        </div>

        <div className="flex-1" />

        {nameError && (
          <div className="mb-3 text-[13px] text-clay-deep text-center">{nameError}</div>
        )}

        <button
          onClick={handleSaveName}
          disabled={!displayName.trim() || status === "saving"}
          className="h-[54px] rounded-[12px] border-0 bg-sage-deep text-paper-2 text-[16px] cursor-pointer disabled:opacity-60"
        >
          {status === "saving" ? "저장 중…" : "기록 시작하기"}
        </button>
      </div>
    );
  }

  // 오류
  if (status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper gap-6 px-8">
        <div className="p-[18px] rounded-[14px] bg-clay-tint flex flex-col gap-2">
          <div className="font-heading text-[17px]" style={{ color: "#7A4A33" }}>
            초대를 수락할 수 없어요
          </div>
          <div className="text-[14px] leading-[1.55]" style={{ color: "#6B5246" }}>
            {error}
          </div>
        </div>
        <button
          onClick={() => router.replace("/login")}
          className="h-[50px] w-full max-w-[320px] rounded-[12px] border border-chip-off-bd bg-transparent text-[15px] text-ink cursor-pointer"
        >
          처음으로
        </button>
      </div>
    );
  }

  return <div className="absolute inset-0 bg-paper" />;
}
