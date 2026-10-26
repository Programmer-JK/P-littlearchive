"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMemories } from "@/lib/firestore-hooks";
import { getPlaceholderGradient, parseLocalDate } from "@/lib/utils";
import type { Memory } from "@/lib/types";

// ── Book spine palette ────────────────────────────────────────────────────────
const PALETTE: [string, string, number][] = [
  ["#6E7F63", "#F2EDE1", 86],
  ["#C9A86A", "#23201C", 80],
  ["#3E4A5C", "#EFE7D8", 90],
  ["#7A5C4E", "#F2EDE1", 84],
  ["#3E4A5C", "#EFE7D8", 89],
  ["#C9A86A", "#23201C", 81],
  ["#6E7F63", "#F2EDE1", 87],
  ["#A4583C", "#F7EFDD", 85],
];

interface ShelfBook {
  key: string; // YYYY-MM
  year: number;
  month: number;
  memories: Memory[];
  color: string;
  fg: string;
  height: number;
}

interface ShelfYear {
  year: number;
  books: ShelfBook[];
}

function buildShelf(memories: Memory[]): ShelfBook[] {
  const map = new Map<string, Memory[]>();
  for (const m of memories) {
    const key = m.date.slice(0, 7);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return [...map.keys()].sort().map((key, i) => {
    const [color, fg, height] = PALETTE[i % PALETTE.length];
    const [y, mo] = key.split("-");
    return {
      key,
      year: +y,
      month: +mo,
      memories: map.get(key)!.sort((a, b) => a.date.localeCompare(b.date)),
      color,
      fg,
      height,
    };
  });
}

// ── Page layout ───────────────────────────────────────────────────────────────
const TOC_FIRST = 5;  // entries on first TOC page
const TOC_CONT = 7;  // entries on continuation TOC pages

type PageData =
  | { kind: "toc"; tocPage: number; start: number; end: number }
  | { kind: "memory"; memory: Memory; memIndex: number };

function buildPages(mems: Memory[]): { pages: PageData[]; tocCount: number } {
  const buckets: { start: number; end: number }[] = [];
  if (mems.length === 0) {
    buckets.push({ start: 0, end: 0 });
  } else {
    buckets.push({ start: 0, end: Math.min(TOC_FIRST, mems.length) });
    let i = TOC_FIRST;
    while (i < mems.length) {
      const end = Math.min(i + TOC_CONT, mems.length);
      buckets.push({ start: i, end });
      i = end;
    }
  }

  return {
    pages: [
      ...buckets.map((b, idx) => ({
        kind: "toc" as const,
        tocPage: idx,
        start: b.start,
        end: b.end,
      })),
      ...mems.map((m, idx) => ({
        kind: "memory" as const,
        memory: m,
        memIndex: idx,
      })),
    ],
    tocCount: buckets.length,
  };
}

const NUMK = ["", "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열"];
const DOW_KR = "일월화수목금토";
const p2 = (n: number) => String(n).padStart(2, "0");

// ── Component ─────────────────────────────────────────────────────────────────
export default function AlbumPage() {
  const router = useRouter();
  const { coupleData } = useAuth();
  const coupleId = coupleData?.coupleId ?? null;
  const members = coupleData?.members ?? {};
  const { memories } = useMemories(coupleId);

  const shelf = buildShelf(memories);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [page, setPage] = useState(0);
  const [angles, setAngles] = useState<Record<number, number>>({});
  const [bookOut, setBookOut] = useState(false);
  const [animating, setAnimating] = useState(false);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Initialise / re-sync selected month
  useEffect(() => {
    if (shelf.length > 0) {
      const found = shelf.find((b) => b.key === selectedKey);
      if (!found) {
        setSelectedKey(shelf[shelf.length - 1].key);
        setPage(0);
        setAngles({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelf.length]);

  const currentBook = shelf.find((b) => b.key === selectedKey) ?? shelf[shelf.length - 1];
  const mems = currentBook?.memories ?? [];
  const { pages, tocCount } = buildPages(mems);
  const NB = pages.length;

  const shelfYears: ShelfYear[] = [];
  for (const book of shelf) {
    const yr = shelfYears.find((y) => y.year === book.year);
    if (yr) yr.books.push(book);
    else shelfYears.push({ year: book.year, books: [book] });
  }

  function pickMonth(key: string) {
    if (key === selectedKey || bookOut) return;
    setBookOut(true);
    setTimeout(() => {
      setSelectedKey(key);
      setPage(0);
      setAngles({});
      setBookOut(false);
    }, 260);
  }

  function angleOf(i: number) {
    return angles[i] ?? (i < page ? -180 : 0);
  }

  function startFlip() {
    setAnimating(true);
    clearTimeout(animTimerRef.current);
    animTimerRef.current = setTimeout(() => setAnimating(false), 500);
  }

  function flipNext() {
    if (page >= NB) return;
    startFlip();
    setAngles((prev) => ({ ...prev, [page]: -180 }));
    setPage((p) => p + 1);
  }

  function flipPrev() {
    if (page <= 0) return;
    startFlip();
    setAngles((prev) => ({ ...prev, [page - 1]: 0 }));
    setPage((p) => p - 1);
  }

  function goTo(target: number) {
    startFlip();
    const next: Record<number, number> = {};
    for (let k = 0; k < target; k++) next[k] = -180;
    for (let k = target; k < NB; k++) next[k] = 0;
    setAngles(next);
    setPage(target);
  }

  const pageLbl = (() => {
    if (page < tocCount)
      return tocCount === 1 ? "목차" : `목차 ${page + 1} / ${tocCount}`;
    if (page < NB)
      return `${page - tocCount + 1} / ${mems.length}`;
    return "끝";
  })();

  // Touch swipe
  const touchStartX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) {
      e.preventDefault();
      dx < 0 ? flipNext() : flipPrev();
    }
  };

  // Tap to flip (position-based)
  const onBookClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.clientX - rect.left > rect.width * 0.4 ? flipNext() : flipPrev();
  };

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-5 gap-3 text-center">
        <div className="font-heading text-[22px] text-ink-2">아직 비어 있는 앨범</div>
        <div className="text-[13px] text-ink-3">추억을 남기면 여기에 정리돼요</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ userSelect: "none" }}>

      {/* Header */}
      <div className="px-5 flex items-center justify-between" style={{ height: 46 }}>
        <div className="flex flex-col gap-[1px]">
          <span className="font-heading text-[20px] leading-none">우리의 순간들</span>
          <span className="text-[12px]" style={{ color: "#9A9182" }}>
            {currentBook ? `${currentBook.year}년 ${currentBook.month}월` : ""}
          </span>
        </div>
        <button
          onClick={() => router.push("/timeline")}
          className="flex items-center gap-[4px] h-[36px] px-[12px] rounded-full border-0 cursor-pointer"
          style={{
            background: "rgba(125,146,118,.12)",
            color: "#50634A",
            fontSize: 13,
            fontFamily: "'Gowun Dodum', sans-serif",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          타임라인
        </button>
      </div>

      {/* Bookshelf */}
      <div className="relative" style={{ height: 130 }}>
        {/* Shelf board */}
        <div
          className="absolute left-[12px] right-[12px] top-[79px] rounded-[1px]"
          style={{
            bottom: 23,
            height: 7,
            background: "#CDBFA6",
            boxShadow: "0 4px 6px -3px rgba(35,32,28,.35)",
          }}
        />
        <div className="absolute inset-0 overflow-x-auto" style={{ paddingBottom: 0 }}>
          <div
            className="flex gap-[14px] items-end h-full"
            style={{ paddingLeft: 22, paddingRight: 22, paddingBottom: 23 }}
          >
            {shelfYears.map((yr) => (
              <div key={yr.year} className="flex-none flex flex-col">
                <div className="flex items-end gap-[3px]" style={{ height: 100 }}>
                  {yr.books.map((book) => {
                    const isActive = book.key === selectedKey;
                    return (
                      <button
                        key={book.key}
                        onClick={() => pickMonth(book.key)}
                        aria-label={`${book.year}년 ${book.month}월 앨범`}
                        className="flex-none flex flex-col items-center justify-between cursor-pointer border-0"
                        style={{
                          width: 36,
                          height: book.height,
                          background: book.color,
                          borderRadius: "2px 2px 0 0",
                          transform: `translateY(${isActive ? -14 : 0}px)`,
                          transition: "transform 0.35s cubic-bezier(.3,1.4,.5,1)",
                          boxShadow:
                            "inset -3px 0 0 rgba(0,0,0,.14), inset 2px 0 0 rgba(255,255,255,.14)",
                          padding: "9px 0 7px",
                        }}
                      >
                        <span style={{ width: "60%", height: 1, background: book.fg, opacity: 0.5, display: "block" }} />
                        <span
                          style={{
                            writingMode: "vertical-rl",
                            fontFamily: "'Gowun Batang', serif",
                            fontWeight: 500,
                            fontSize: 13,
                            letterSpacing: ".06em",
                            color: book.fg,
                          }}
                        >
                          {book.month}월
                        </span>
                        <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 9, color: book.fg, opacity: 0.85 }}>
                          {book.memories.length}
                        </span>
                      </button>
                    );
                  })}
                  {/* Year divider */}
                  <span className="flex-none rounded-[1px]" style={{ width: 5, height: 44, marginLeft: 3, background: "#8C7B60" }} />
                </div>
                <div style={{ height: 7 }} />
                <div
                  style={{
                    paddingTop: 4,
                    fontSize: 11,
                    letterSpacing: ".08em",
                    fontVariantNumeric: "tabular-nums",
                    color: yr.year === currentBook?.year ? "#23201C" : "#8C7B60",
                    fontWeight: yr.year === currentBook?.year ? 600 : 400,
                  }}
                >
                  {yr.year}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Book */}
      <div style={{ position: "relative", height: 460, perspective: "1500px", perspectiveOrigin: "20% 50%" }}>
        <div
          style={{
            position: "absolute",
            left: 20,
            right: 0,
            top: 6,
            height: 460,
            transform: bookOut ? "translateY(-36px) scale(.94)" : "none",
            opacity: bookOut ? 0 : 1,
            transition: "transform .26s ease, opacity .26s ease",
            cursor: "pointer",
          }}
          onClick={onBookClick}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Shadow pages */}
          <div
            style={{
              position: "absolute", left: 30, top: 6,
              width: "calc(100% - 50px)", maxWidth: 340, height: 460,
              background: "#E8E8E8", border: "1px solid #D3D3D3", borderRadius: "0 3px 3px 0",
            }}
          />
          <div
            style={{
              position: "absolute", left: 27, top: 3,
              width: "calc(100% - 47px)", maxWidth: 340, height: 460,
              background: "#F0F0F0", border: "1px solid #D3D3D3", borderRadius: "0 3px 3px 0",
            }}
          />

          {/* End page */}
          <div
            style={{
              position: "absolute", left: 24, top: 0,
              width: "calc(100% - 44px)", maxWidth: 340, height: 460,
              background: "#FFFFFF", borderRadius: "0 3px 3px 0",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 18, textAlign: "center", padding: "20px 22px",
            }}
          >
            <div style={{ fontFamily: "'Gowun Batang', serif", fontWeight: 500, fontSize: 20, lineHeight: 1.6, wordBreak: "keep-all" }}>
              {currentBook?.month}월은 여기까지.
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); goTo(0); }}
              style={{
                height: 44, padding: "0 18px", borderRadius: 8,
                border: "1px solid #23201C", background: "transparent",
                fontFamily: "'Gowun Dodum', sans-serif", fontSize: 14,
                color: "#23201C", cursor: "pointer",
              }}
            >
              목차로
            </button>
          </div>

          {/* Actual pages */}
          {pages.map((p, i) => {
            const angle = angleOf(i);
            const t = -angle / 180;
            const lift = Math.sin(t * Math.PI);
            // Disable 3D when page is at rest (angle=0, not animating)
            // so the GPU doesn't composite at sub-retina resolution
            const isAtRest = !animating && angle === 0;

            return (
              <div
                key={i}
                style={{
                  position: "absolute", left: 24, top: 0,
                  width: "calc(100% - 44px)", maxWidth: 340, height: 460,
                  transformStyle: isAtRest ? "flat" : "preserve-3d",
                  transformOrigin: "left center",
                  transform: isAtRest
                    ? "none"
                    : `rotateY(${angle.toFixed(2)}deg) translateZ(${(lift * 8).toFixed(1)}px)`,
                  transition: "transform 0.45s cubic-bezier(.3,1,.4,1)",
                  zIndex: angle > -90 ? 200 - i : 100 + i,
                  willChange: "transform",
                }}
              >
                {/* Front */}
                <div
                  style={{
                    position: "absolute", inset: 0,
                    backfaceVisibility: isAtRest ? "visible" : "hidden",
                    WebkitBackfaceVisibility: isAtRest ? "visible" : "hidden",
                    background: "#FFFFFF",
                    borderRadius: "0 3px 3px 0",
                    boxShadow: "0 1px 2px rgba(35,32,28,.12)",
                    padding: "20px 22px",
                    display: "flex", flexDirection: "column",
                    overflow: "hidden",
                  } as React.CSSProperties}
                >
                  {p.kind === "toc" ? (
                    <TocPage
                      book={currentBook!}
                      allMemories={mems}
                      start={p.start}
                      end={p.end}
                      tocPage={p.tocPage}
                      tocCount={tocCount}
                      memOffset={tocCount}
                      onGoTo={goTo}
                    />
                  ) : (
                    <MemoryPage
                      memory={p.memory}
                      pageNo={p.memIndex + 1}
                      totalPages={mems.length}
                      members={members}
                      onDetail={() => router.push(`/memories/${p.memory.id}`)}
                    />
                  )}
                  {/* Left binding shadow */}
                  <div
                    style={{
                      position: "absolute", top: 0, bottom: 0, left: 0, width: 22,
                      background: "linear-gradient(90deg,rgba(35,32,28,.10),transparent)",
                      pointerEvents: "none",
                    }}
                  />
                </div>

                {/* Back */}
                <div
                  style={{
                    position: "absolute", inset: 0,
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: "#F0F0F0",
                    borderRadius: "3px 0 0 3px",
                  } as React.CSSProperties}
                >
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,rgba(35,32,28,.24),rgba(35,32,28,.04) 70%)" }} />
                  <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 24, background: "linear-gradient(270deg,rgba(35,32,28,.12),transparent)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4" style={{ height: 56 }}>
        <button
          onClick={flipPrev}
          aria-label="이전 페이지"
          className="w-[44px] h-[44px] flex items-center justify-center border-0 bg-transparent cursor-pointer"
          style={{ opacity: page === 0 ? 0.25 : 1 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23201C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-[13px] tabular-nums" style={{ color: "#6B6152" }}>{pageLbl}</span>
        <button
          onClick={flipNext}
          aria-label="다음 페이지"
          className="w-[44px] h-[44px] flex items-center justify-center border-0 bg-transparent cursor-pointer"
          style={{ opacity: page >= NB ? 0.25 : 1 }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#23201C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── TOC Page ──────────────────────────────────────────────────────────────────

function TocPage({
  book,
  allMemories,
  start,
  end,
  tocPage,
  tocCount,
  memOffset,
  onGoTo,
}: {
  book: ShelfBook;
  allMemories: Memory[];
  start: number;
  end: number;
  tocPage: number;
  tocCount: number;
  memOffset: number;
  onGoTo: (pageIdx: number) => void;
}) {
  const isFirst = tocPage === 0;
  const isLast = tocPage === tocCount - 1;
  const slice = allMemories.slice(start, end);
  const numKr = NUMK[allMemories.length] || String(allMemories.length);

  return (
    <div className="flex flex-col h-full">
      {isFirst ? (
        <>
          <div style={{ fontSize: 11, letterSpacing: ".12em", color: "#6B6152", fontVariantNumeric: "tabular-nums" }}>
            {book.year}.{p2(book.month)}
          </div>
          <div style={{ marginTop: 28, fontFamily: "'Gowun Batang', serif", fontWeight: 600, fontSize: 26, lineHeight: 1.35 }}>
            {book.month}월의 순간들
          </div>
          <div style={{ marginTop: 6, fontSize: 14, color: "#6B6152" }}>
            둘이서 · {numKr} 번의 날
          </div>
          <div style={{ marginTop: 20, fontSize: 11, letterSpacing: ".2em", color: "#6B6152", paddingBottom: 8, borderBottom: "1px solid #23201C" }}>
            차례
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, letterSpacing: ".12em", color: "#6B6152" }}>
            차례 계속 · {tocPage + 1}/{tocCount}
          </div>
          <div style={{ marginTop: 10, fontSize: 11, letterSpacing: ".2em", color: "#6B6152", paddingBottom: 8, borderBottom: "1px solid #23201C" }}>
            차례
          </div>
        </>
      )}

      <div style={{ flex: 1, overflowY: "hidden" }}>
        {slice.map((m, k) => {
          const globalIdx = start + k;
          const pageTarget = memOffset + globalIdx;
          const [, mo, dd] = m.date.split("-");
          return (
            <button
              key={m.id}
              onClick={(e) => { e.stopPropagation(); onGoTo(pageTarget); }}
              style={{
                width: "100%", height: 46, padding: 0, border: "none",
                borderBottom: "1px solid #DACCB8", background: "transparent",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer", textAlign: "left", fontFamily: "inherit", color: "#23201C",
              }}
            >
              <span style={{ width: 22, flexShrink: 0, fontSize: 12, color: "#6B6152", fontVariantNumeric: "tabular-nums" }}>
                {p2(globalIdx + 1)}
              </span>
              <span style={{ fontFamily: "'Gowun Batang', serif", fontWeight: 500, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {m.title}
              </span>
              <span style={{ flexShrink: 0, marginBottom: 3, borderBottom: "1px dotted #A8977A", width: 16 }} />
              <span style={{ flexShrink: 0, fontSize: 13, color: "#6B6152", fontVariantNumeric: "tabular-nums" }}>
                {parseInt(mo)}.{parseInt(dd)}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ paddingTop: 8, fontSize: 12, color: "#6B6152", textAlign: "right" }}>
        {isLast ? "넘겨서 보기 →" : "계속 →"}
      </div>
    </div>
  );
}

// ── Memory Page ───────────────────────────────────────────────────────────────

function MemoryPage({
  memory,
  pageNo,
  totalPages,
  members,
  onDetail,
}: {
  memory: Memory;
  pageNo: number;
  totalPages: number;
  members: Record<string, { displayName: string }>;
  onDetail: () => void;
}) {
  const [y, mo, dd] = memory.date.split("-");
  const d = parseLocalDate(memory.date);
  const dow = DOW_KR[d.getDay()];
  const authorName = members[memory.createdBy]?.displayName ?? "?";
  const imprint = `'${y.slice(2)} ${mo} ${dd}`;

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, letterSpacing: ".12em", color: "#6B6152", fontVariantNumeric: "tabular-nums" }}>
        <span>{y}.{mo}</span>
        <span>p. {p2(pageNo)} / {p2(totalPages)}</span>
      </div>

      {/* Photo */}
      <div
        style={{
          position: "relative", width: "100%", aspectRatio: "4/3",
          marginTop: 14, borderRadius: 2, overflow: "hidden", flexShrink: 0,
          border: "1px solid #E3DACB",
          background: getPlaceholderGradient(memory.id ?? memory.title),
        }}
      >
        {memory.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={memory.coverUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <span
          style={{
            position: "absolute", right: 10, bottom: 8,
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 15, letterSpacing: ".06em",
            color: "#F07A2B", textShadow: "0 0 4px rgba(240,122,43,.55)",
            pointerEvents: "none",
          }}
        >
          {imprint}
        </span>
      </div>

      {/* Title */}
      <div style={{ fontFamily: "'Gowun Batang', serif", fontWeight: 600, fontSize: 19, lineHeight: 1.4, marginTop: 14, wordBreak: "keep-all", color: "#23201C" }}>
        {memory.title}
      </div>

      {/* Meta */}
      <div style={{ fontSize: 13, marginTop: 4, color: "#6B6152" }}>
        {[memory.place, `${dow}요일`].filter(Boolean).join(" · ")}
      </div>

      {/* Body */}
      {memory.content && (
        <div
          style={{
            fontSize: 14, lineHeight: 1.75, marginTop: 10,
            wordBreak: "keep-all", color: "#23201C", overflow: "hidden",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          } as React.CSSProperties}
        >
          {memory.content}
        </div>
      )}

      {/* Footer — "자세히 보기" */}
      <button
        onClick={(e) => { e.stopPropagation(); onDetail(); }}
        style={{
          marginTop: "auto", paddingTop: 8,
          fontSize: 12, color: "#6B6152",
          textAlign: "right", alignSelf: "flex-end",
          background: "transparent", border: "none",
          cursor: "pointer", padding: 0,
        }}
      >
        자세히 보기 →
      </button>
    </div>
  );
}
