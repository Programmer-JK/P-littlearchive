"use client";

import { useRouter } from "next/navigation";

interface AddBottomSheetProps {
  onClose: () => void;
}

export function AddBottomSheet({ onClose }: AddBottomSheetProps) {
  const router = useRouter();

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
          onClick={() => go("/rules?new=1")}
          className="min-h-[72px] px-[16px] py-[14px] rounded-[14px] border border-line bg-polaroid flex items-center gap-[14px] cursor-pointer text-left hover:border-sage-line transition-colors"
        >
          <span className="w-[44px] h-[44px] flex-none rounded-[10px] bg-seg-track flex items-center justify-center text-ink-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </span>
          <span className="flex flex-col gap-[3px]">
            <span className="font-heading text-[17px] text-ink">약속 추가하기</span>
            <span className="text-[13px] text-ink-3">둘이 함께 지키고 싶은 약속을 적어요</span>
          </span>
        </button>

      </div>
    </div>
  );
}
