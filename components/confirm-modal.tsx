"use client";

interface ConfirmModalProps {
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  body,
  confirmLabel = "지우기",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-8 animate-ola-fade"
      style={{ background: "rgba(47,43,37,.38)" }}
      onClick={onCancel}
    >
      <div
        className="w-full bg-paper-2 rounded-2xl p-[22px_20px_16px] flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-heading text-lg">{title}</div>
        <div className="text-sm leading-[1.55] text-ink-2">{body}</div>
        <div className="grid grid-cols-2 gap-2 mt-[10px]">
          <button
            onClick={onCancel}
            className="h-[46px] rounded-[10px] border border-chip-off-bd bg-transparent text-[15px] text-ink cursor-pointer"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="h-[46px] rounded-[10px] border-0 bg-clay-deep text-[15px] text-paper-2 cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
