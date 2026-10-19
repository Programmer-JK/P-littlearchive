"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { user, coupleData, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (coupleData) {
      router.replace("/");
    } else {
      router.replace("/onboarding");
    }
  }, [user, coupleData, loading, router]);

  const handleSignIn = async () => {
    setSigningIn(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "로그인에 실패했어요.";
      setError(msg);
      setSigningIn(false);
    }
  };

  if (loading) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  return (
    <div
      className="absolute inset-0 flex flex-col animate-ola-fade"
      style={{ padding: "72px 28px 44px" }}
    >
      {/* Illustration */}
      <div style={{ margin: "4px -14px 0" }}>
        <Image
          src="/assets/login-polaroids.png"
          alt="함께하는 시간 — 커플 폴라로이드 일러스트"
          width={1397}
          height={1126}
          className="w-full h-auto"
          priority
        />
      </div>

      {/* Logo */}
      <div className="mt-[18px] flex flex-col gap-[6px] text-center">
        <div
          className="font-display text-[42px] leading-none"
          style={{ fontStyle: "italic" }}
        >
          Our Little Archive
        </div>
        <div className="font-heading text-[15px] text-ink-2">
          우리의 작은 기록 보관함
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-[14px]">
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="h-[54px] rounded-[12px] border border-chip-off-bd bg-polaroid flex items-center justify-center gap-[10px] text-[16px] text-ink cursor-pointer disabled:opacity-60"
        >
          <span
            className="w-[22px] h-[22px] rounded-full border-[1.5px] border-ink-2 flex items-center justify-center"
            style={{ font: "600 12px system-ui,sans-serif", color: "#6E665A" }}
          >
            G
          </span>
          {signingIn ? "로그인 중…" : "Google로 계속하기"}
        </button>
        {error && (
          <div className="text-[13px] text-clay-deep text-center">{error}</div>
        )}
      </div>
    </div>
  );
}
