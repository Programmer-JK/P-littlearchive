"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AddBottomSheet } from "./add-bottom-sheet";

export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  const isHome = pathname === "/home" || pathname === "/";
  const isAlbum = pathname.startsWith("/album");
  const isWish = pathname.startsWith("/wishlist");
  const isTimeline = pathname.startsWith("/timeline");

  const activeColor = "#50634A";
  const inactiveColor = "#9A9182";

  const tabColor = (active: boolean) => active ? activeColor : inactiveColor;

  return (
    <>
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-[88px] grid items-center z-20"
        style={{
          gridTemplateColumns: "1fr 1fr 64px 1fr 1fr",
          padding: "6px 10px 26px",
          background: "rgba(251,248,241,.94)",
          borderTop: "1px solid #E3DACB",
        }}
      >
        <button
          onClick={() => router.push("/home")}
          className="h-[52px] border-0 bg-transparent flex flex-col items-center justify-center gap-[3px] cursor-pointer"
          style={{ color: tabColor(isHome) }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
          </svg>
          <span className="text-[11px]">홈</span>
        </button>

        <button
          onClick={() => router.push("/album")}
          className="h-[52px] border-0 bg-transparent flex flex-col items-center justify-center gap-[3px] cursor-pointer"
          style={{ color: tabColor(isAlbum) }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="1" />
            <rect x="7" y="6" width="10" height="9" />
          </svg>
          <span className="text-[11px]">순간들</span>
        </button>

        <button
          onClick={() => setShowAdd(true)}
          aria-label="새로 기록하기"
          className="justify-self-center mt-[-18px] w-[54px] h-[54px] rounded-full border-[4px] border-paper text-paper-2 text-[26px] leading-none cursor-pointer flex items-center justify-center"
          style={{
            background: "#50634A",
            boxShadow: "0 8px 18px -8px rgba(60,40,20,.5)",
          }}
        >
          +
        </button>

        <button
          onClick={() => router.push("/wishlist")}
          className="h-[52px] border-0 bg-transparent flex flex-col items-center justify-center gap-[3px] cursor-pointer"
          style={{ color: tabColor(isWish) }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14v17l-7-4-7 4z" />
          </svg>
          <span className="text-[11px]">하고 싶은 것</span>
        </button>

        <button
          onClick={() => router.push("/timeline")}
          className="h-[52px] border-0 bg-transparent flex flex-col items-center justify-center gap-[3px] cursor-pointer"
          style={{ color: tabColor(isTimeline) }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3v18" />
            <circle cx="7" cy="7" r="2" />
            <circle cx="7" cy="16" r="2" />
            <path d="M11 7h9M11 16h6" />
          </svg>
          <span className="text-[11px]">타임라인</span>
        </button>
      </div>

      {showAdd && <AddBottomSheet onClose={() => setShowAdd(false)} />}
    </>
  );
}
