export default function NotFound() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-paper gap-4 px-8">
      <div className="font-hand text-[36px] text-ink-2">페이지를 찾을 수 없어요</div>
      <div className="text-[14px] text-ink-3">주소를 다시 확인해 주세요.</div>
      <a
        href="/"
        className="mt-2 h-[50px] px-6 rounded-full bg-sage-deep text-paper-2 text-[15px] flex items-center"
      >
        홈으로
      </a>
    </div>
  );
}
