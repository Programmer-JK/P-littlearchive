"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { gwa } from "@/lib/utils";

interface AddBottomSheetProps {
  onClose: () => void;
}

export function AddBottomSheet({ onClose }: AddBottomSheetProps) {
  const router = useRouter();
  const { coupleData, user } = useAuth();

  const partnerUid = coupleData?.partnerUid;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "파트너")
    : "파트너";

  function go(path: string) {
    onClose();
    router.push(path);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 animate-ola-fade"
        style={{ background: "rgba(47,43,37,.35)" }}
        onClick={onClose}
      />
      <div
        className="relative bg-paper-2 flex flex-col gap-[10px] animate-ola-up"
        style={{
          borderRadius: "22px 22px 0 0",
          padding: "10px 20px 40px",
        }}
      >
        <div className="w-[38px] h-[5px] rounded-full bg-chip-off-bd self-center mb-[10px]" />

        <button
          onClick={() => go("/memories/new")}
          className="min-h-[72px] px-[16px] py-[14px] rounded-[14px] border border-line bg-polaroid flex items-center gap-[14px] cursor-pointer text-left hover:border-sage-line transition-colors"
        >
          <span className="w-[44px] h-[44px] flex-none rounded-[10px] bg-sage-tint flex items-center justify-center text-sage-deep">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="14" rx="2" />
              <circle cx="12" cy="13" r="3.5" />
              <path d="M8 6l1.5-2h5L16 6" />
            </svg>
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="font-heading text-[17px] text-ink">추억 남기기</span>
            <span className="text-[13px] text-ink-3">사진과 그날의 후기를 기록해요</span>
          </span>
        </button>

        <button
          onClick={() => go("/wishlist?new=1")}
          className="min-h-[72px] px-[16px] py-[14px] rounded-[14px] border border-line bg-polaroid flex items-center gap-[14px] cursor-pointer text-left hover:border-sage-line transition-colors"
        >
          <span className="w-[44px] h-[44px] flex-none rounded-[10px] bg-clay-tint flex items-center justify-center text-clay-deep">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h14v17l-7-4-7 4z" />
            </svg>
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="font-heading text-[17px] text-ink">하고 싶은 것 담기</span>
            <span className="text-[13px] text-ink-3">가고 싶은 곳, 먹고 싶은 것, 함께할 일</span>
          </span>
        </button>

        <button
          onClick={() => go("/notes/new")}
          className="min-h-[72px] px-[16px] py-[14px] rounded-[14px] border border-line bg-polaroid flex items-center gap-[14px] cursor-pointer text-left hover:border-sage-line transition-colors"
        >
          <span className="w-[44px] h-[44px] flex-none rounded-[10px] bg-line-faint flex items-center justify-center text-ink-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 3 10 14" />
              <path d="M21 3l-7 18-4-7-7-4z" />
            </svg>
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="font-heading text-[17px] text-ink">{partnerName}에게 사진 보내기</span>
            <span className="text-[13px] text-ink-3">지금 내 모습, 보여주고 싶은 것 한 장</span>
          </span>
        </button>

        <button
          onClick={() => go("/songs/new")}
          className="min-h-[72px] px-[16px] py-[14px] rounded-[14px] border border-line bg-polaroid flex items-center gap-[14px] cursor-pointer text-left hover:border-sage-line transition-colors"
        >
          <span className="w-[44px] h-[44px] flex-none rounded-[10px] flex items-center justify-center" style={{ background: "#E4E9DB", color: "#50634A" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="font-heading text-[17px] text-ink">{partnerName}에게 노래 보내기</span>
            <span className="text-[13px] text-ink-3">유튜브 뮤직 링크로 공유해요</span>
          </span>
        </button>
      </div>
    </div>
  );
}
