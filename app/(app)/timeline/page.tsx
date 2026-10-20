"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useMemories, useMemoryPhotos } from "@/lib/firestore-hooks";
import { getPlaceholderGradient, parseLocalDate, formatDot } from "@/lib/utils";
import type { Memory } from "@/lib/types";

const DOW = "일월화수목금토";

export default function TimelinePage() {
  const router = useRouter();
  const { coupleData } = useAuth();
  const coupleId = coupleData?.coupleId ?? null;

  const { memories } = useMemories(coupleId);

  // Group by year-month
  type Group = { label: string; ym: string; items: Memory[] };
  const groups: Group[] = [];
  for (const m of memories) {
    const [y, mon] = m.date.split("-");
    const ym = `${y}-${mon}`;
    const label = `${y}년 ${parseInt(mon)}월`;
    const g = groups.find((g) => g.ym === ym);
    if (g) {
      g.items.push(m);
    } else {
      groups.push({ label, ym, items: [m] });
    }
  }

  const firstDate = memories.length > 0
    ? formatDot(memories[memories.length - 1].date)
    : null;

  const sub = memories.length > 0 && firstDate
    ? `${memories.length}개의 기록 · ${firstDate}부터`
    : "기록이 없어요";

  return (
    <div className="flex flex-col gap-[18px]">
      {/* Title */}
      <div className="px-5 pt-[6px] flex flex-col gap-1">
        <div className="font-heading text-[26px]">함께했던 날</div>
        <div className="text-[13px] text-ink-3">{sub}</div>
      </div>

      {memories.length === 0 ? (
        <div className="px-5 py-10 text-center text-[13px] text-ink-3">
          아직 추억이 없어요. 첫 기억을 남겨 보세요.
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.ym} className="px-5 flex flex-col gap-1">
            <div
              className="font-heading text-[15px] text-sage-deep py-[6px]"
            >
              {g.label}
            </div>
            <div className="flex flex-col gap-1">
              {g.items.map((m) => (
                <TimelineRow
                  key={m.id!}
                  memory={m}
                  coupleId={coupleId}
                  onClick={() => router.push(`/memories/${m.id}`)}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function TimelineRow({
  memory,
  coupleId,
  onClick,
}: {
  memory: Memory;
  coupleId: string | null;
  onClick: () => void;
}) {
  const d = parseLocalDate(memory.date);
  const day = d.getDate();
  const dow = DOW[d.getDay()];

  // Load actual photos from subcollection
  const { photos } = useMemoryPhotos(
    coupleId,
    memory.photoCount > 0 ? (memory.id ?? null) : null
  );

  // Thumbs (up to 4) — use loaded photo thumbs, fall back to placeholder
  const thumbCount = Math.min(memory.photoCount, 4);
  const thumbs = Array.from({ length: thumbCount }, (_, i) => ({
    bg: getPlaceholderGradient(`${memory.id}-${i}`),
    url: photos[i]?.thumbUrl ?? (i === 0 ? memory.coverUrl : null),
  }));

  return (
    <div className="grid" style={{ gridTemplateColumns: "44px minmax(0,1fr)" }}>
      {/* Date column */}
      <div className="flex flex-col items-center pt-3">
        <span className="font-display text-[28px] leading-none">{day}</span>
        <span className="text-[11px] text-ink-3">{dow}</span>
      </div>

      {/* Timeline line + card */}
      <div
        className="relative border-l border-line pb-[18px] pl-4 ml-[6px]"
      >
        {/* Dot */}
        <span
          className="absolute left-[-5px] top-5 w-[9px] h-[9px] rounded-full border-2"
          style={{ background: "#7D9276", borderColor: "#F2EDE1" }}
        />

        <button
          onClick={onClick}
          className="w-full border border-line-soft bg-paper-2 rounded-[12px] p-[14px] text-left cursor-pointer flex flex-col gap-2 hover:border-chip-off-bd transition-colors"
        >
          <span className="font-heading text-[17px] text-ink">{memory.title}</span>
          <span className="text-[12px] text-ink-3">
            {[memory.place, memory.category].filter(Boolean).join(" · ")}
          </span>
          {thumbs.length > 0 && (
            <span className="flex gap-[6px]">
              {thumbs.map((t, i) => (
                <span
                  key={i}
                  className="relative w-[58px] h-[58px] rounded-[4px] overflow-hidden"
                  style={{ background: t.url ? undefined : t.bg }}
                >
                  {t.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.url} alt="" className="w-full h-full object-cover" />
                  )}
                </span>
              ))}
            </span>
          )}
          {memory.content && (
            <span
              className="text-[14px] leading-[1.55] text-[#4A443B]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              } as React.CSSProperties}
            >
              {memory.content}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
