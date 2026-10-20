"use client";

export const dynamic = "force-dynamic";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  useRecentMemories,
  useWishlist,
  useAnniversaries,
  useUnreadNotes,
  useUnreadSongs,
  useRules,
} from "@/lib/firestore-hooks";
import {
  dayCount,
  formatYMD,
  computeUpcoming,
  getPlaceholderGradient,
  getTilt,
  formatDot,
  today,
  parseLocalDate,
} from "@/lib/utils";
import type { Memory, WishlistItem } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { coupleData, user } = useAuth();

  const coupleId = coupleData?.coupleId ?? null;
  const couple = coupleData?.couple;
  const myUid = user?.uid ?? null;
  const partnerUid = coupleData?.partnerUid;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "파트너")
    : "파트너";
  const myName = myUid ? (coupleData?.members[myUid]?.displayName ?? "나") : "나";

  const herInitial = partnerName[0] ?? "?";
  const meInitial = myName[0] ?? "나";

  const { memories } = useRecentMemories(coupleId, 4);
  const { items: wishItems } = useWishlist(coupleId);
  const { anniversaries } = useAnniversaries(coupleId);
  const { rules } = useRules(coupleId);
  const unreadCount = useUnreadNotes(coupleId, myUid);
  const unreadSongCount = useUnreadSongs(coupleId, myUid);

  const startDate = couple?.startDate ?? "";
  const count = startDate ? dayCount(startDate) : 0;
  const startLong = startDate ? formatYMD(startDate) : "";

  const upcoming = startDate
    ? computeUpcoming(
        startDate,
        anniversaries.map((a) => ({
          title: a.title,
          date: a.date,
          repeatYearly: a.repeatYearly,
        }))
      )
    : [];

  // Next plans: planned first, then wish by priority, max 3
  const PRIORITY_ORDER = { "꼭 하기": 0, "하고 싶음": 1, "보통": 2 };
  const nextPlans = wishItems
    .filter((w) => w.status !== "done")
    .sort((a, b) => {
      if (a.status === "planned" && b.status !== "planned") return -1;
      if (b.status === "planned" && a.status !== "planned") return 1;
      return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    })
    .slice(0, 3);

  const hasUnread = unreadCount > 0;
  const hasUnreadSong = unreadSongCount > 0;

  return (
    <div className="px-5 flex flex-col gap-7">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pt-[6px]">
        <div className="flex flex-col gap-[3px] min-w-0">
          <div className="font-display text-[28px] leading-none italic">
            Our Little Archive
          </div>
          <div className="text-[12px] text-ink-3 truncate">{couple?.name}</div>
        </div>
        <div className="flex items-center gap-[2px]">
          <button
            onClick={() => router.push("/settings")}
            aria-label="설정"
            className="w-[44px] h-[44px] border-0 bg-transparent text-ink-2 cursor-pointer flex items-center justify-center"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
          <button
            onClick={() => router.push("/settings")}
            aria-label="우리 공간 설정"
            className="h-[44px] px-1 border-0 bg-transparent flex items-center cursor-pointer"
          >
            <span className="w-[34px] h-[34px] rounded-full bg-avatar-her border-2 border-paper flex items-center justify-center font-heading text-[14px]">
              {herInitial}
            </span>
            <span className="w-[34px] h-[34px] -ml-[10px] rounded-full bg-avatar-me border-2 border-paper flex items-center justify-center font-heading text-[14px]">
              {meInitial}
            </span>
          </button>
        </div>
      </div>

      {/* D-Day card */}
      {startDate && (
        <div
          className="relative bg-paper-2 border border-line-soft rounded-[6px] p-[26px_22px_18px]"
          style={{ boxShadow: "0 1px 2px rgba(60,40,20,.06),0 14px 28px -18px rgba(60,40,20,.35)" }}
        >
          {/* Tape */}
          <div
            className="absolute top-[-11px] left-1/2 w-[78px] h-[22px] -translate-x-1/2"
            style={{ background: "rgba(222,208,170,.78)", transform: "translateX(-50%) rotate(-2deg)" }}
          />
          <div className="text-[13px] text-ink-2">함께한 지</div>
          <div className="flex items-baseline gap-[6px] mt-1">
            <span className="font-display text-[82px] leading-[.9] tracking-tight">
              {count.toLocaleString()}
            </span>
            <span className="font-heading text-[20px]">일째</span>
          </div>
          <div className="text-[13px] text-ink-3 mt-2">{startLong}부터</div>

          <div className="border-t border-dashed border-chip-off-bd mt-[18px] mb-[6px]" />

          {upcoming.map((u, i) => (
            <div key={i} className="flex items-center gap-3 min-h-[44px]">
              <div className="flex-1 min-w-0 flex items-baseline gap-2">
                <span className="font-heading text-[16px]">{u.title}</span>
                <span className="text-[12px] text-ink-3">{formatDot(u.dateStr)}</span>
              </div>
              <DdPill daysLeft={u.daysLeft} isFirst={i === 0} />
            </div>
          ))}
        </div>
      )}

      {/* Unread note card */}
      {hasUnread && (
        <button
          onClick={() => router.push("/album?tab=notes")}
          className="-mt-3 flex items-center gap-[14px] p-[12px_14px_12px_12px] rounded-[12px] cursor-pointer text-left"
          style={{ border: "1px solid #E5CFC3", background: "#F7EDE5" }}
        >
          <span
            className="flex-none w-[50px] h-[62px]"
            style={{
              padding: "3px 3px 10px",
              background: "#FFFDF8",
              boxShadow: "0 4px 10px -5px rgba(60,40,20,.45)",
              transform: "rotate(-5deg)",
            }}
          >
            <span className="block w-full h-full" style={{ background: getPlaceholderGradient("note-preview") }} />
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
            <span className="font-heading text-[16px] text-ink">
              {partnerName}이/가 사진을 보냈어요
            </span>
            <span className="text-[13px] whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: "#8A6A5A" }}>
              새 사진 {unreadCount}장
            </span>
          </span>
          <span className="text-[13px] text-clay-deep">보기 →</span>
        </button>
      )}

      {/* Unread song card */}
      {hasUnreadSong && (
        <button
          onClick={() => router.push("/album?tab=songs")}
          className="-mt-3 flex items-center gap-[14px] p-[12px_14px_12px_12px] rounded-[12px] cursor-pointer text-left"
          style={{ border: "1px solid #B9C3AC", background: "#E4E9DB" }}
        >
          <span
            className="flex-none w-[44px] h-[44px] rounded-[10px] flex items-center justify-center"
            style={{ background: "#50634A" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
            <span className="font-heading text-[16px] text-ink">
              {partnerName}이/가 노래를 보냈어요
            </span>
            <span className="text-[13px]" style={{ color: "#3F5139" }}>
              새 노래 {unreadSongCount}곡
            </span>
          </span>
          <span className="text-[13px]" style={{ color: "#50634A" }}>보기 →</span>
        </button>
      )}

      {/* Quick add */}
      <div className="grid grid-cols-2 gap-[10px]">
        <button
          onClick={() => router.push("/memories/new")}
          className="h-[52px] rounded-[10px] border-0 text-[15px] cursor-pointer font-heading"
          style={{ background: "#50634A", color: "#FBF8F1" }}
        >
          + 추억 남기기
        </button>
        <button
          onClick={() => router.push("/wishlist?new=1")}
          className="h-[52px] rounded-[10px] border text-[15px] cursor-pointer font-heading"
          style={{ background: "#FBF8F1", color: "#2F2B25", borderColor: "#D9CFBE" }}
        >
          + 하고 싶은 것
        </button>
      </div>

      {/* 우리의 약속 (Rules) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-heading text-[19px]">우리의 약속</div>
          <button
            onClick={() => router.push("/rules")}
            className="h-[36px] border-0 bg-transparent text-[13px] text-ink-2 cursor-pointer p-0"
          >
            {rules.length > 0 ? "관리 →" : "만들기 →"}
          </button>
        </div>
        {rules.length === 0 ? (
          <button
            onClick={() => router.push("/rules")}
            className="w-full text-left p-[16px_18px] rounded-[12px] border cursor-pointer"
            style={{
              background: "#FBF8F1",
              borderColor: "#EAE2D4",
              borderStyle: "dashed",
            }}
          >
            <span className="font-hand text-[20px] text-ink-3 leading-none">
              둘만의 약속을 만들어 보세요 ✏
            </span>
          </button>
        ) : (
          <div
            className="relative bg-paper-2 rounded-[12px] overflow-hidden"
            style={{
              border: "1px solid #EAE2D4",
              boxShadow: "0 1px 2px rgba(60,40,20,.04), 0 6px 16px -10px rgba(60,40,20,.18)",
            }}
          >
            {/* Pin decoration */}
            <div
              className="absolute top-[-1px] left-1/2 -translate-x-1/2 w-[8px] h-[8px] rounded-full z-10"
              style={{ background: "#C98B6B", boxShadow: "0 1px 3px rgba(60,40,20,.3)" }}
            />
            <div className="pt-[14px] pb-[4px]">
              {rules.slice(0, 5).map((r, i) => (
                <div
                  key={r.id!}
                  className="flex items-start gap-[10px] px-5 py-[9px]"
                  style={{
                    borderBottom: i < Math.min(rules.length, 5) - 1 ? "1px solid #EFE8DC" : "none",
                  }}
                >
                  <span
                    className="font-display text-[13px] flex-none mt-[1px]"
                    style={{ color: "#C98B6B" }}
                  >
                    {i + 1}.
                  </span>
                  <span className="font-hand text-[18px] text-ink-hand leading-[1.35]">{r.content}</span>
                </div>
              ))}
              {rules.length > 5 && (
                <div className="px-5 py-[8px] text-[12px] text-ink-3">
                  외 {rules.length - 5}개의 약속
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent memories */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-heading text-[19px]">최근 추억</div>
          <button
            onClick={() => router.push("/album")}
            className="h-[36px] border-0 bg-transparent text-[13px] text-ink-2 cursor-pointer p-0"
          >
            모두 보기 →
          </button>
        </div>
        {memories.length === 0 ? (
          <div className="text-[13px] text-ink-3 text-center py-4">
            아직 추억이 없어요. 첫 번째 추억을 남겨 보세요.
          </div>
        ) : (
          <div
            className="flex gap-4 overflow-x-auto -mx-5 px-5 pb-4"
            style={{ paddingTop: "8px" }}
          >
            {memories.map((m) => (
              <RecentMemoryCard
                key={m.id!}
                memory={m}
                onClick={() => router.push(`/memories/${m.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Next plans */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-heading text-[19px]">다음 계획</div>
          <button
            onClick={() => router.push("/wishlist")}
            className="h-[36px] border-0 bg-transparent text-[13px] text-ink-2 cursor-pointer p-0"
          >
            전체 →
          </button>
        </div>
        <div className="bg-paper-2 border border-line-soft rounded-[12px] overflow-hidden">
          {nextPlans.length === 0 ? (
            <div className="p-[22px_16px] text-[14px] text-ink-3 text-center">
              하고 싶은 것을 모두 해냈어요. 새로 하나 담아 볼까요?
            </div>
          ) : (
            nextPlans.map((w, i) => (
              <WishPlanRow
                key={w.id!}
                item={w}
                isLast={i === nextPlans.length - 1}
                onClick={() => router.push(`/wishlist#${w.id}`)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DdPill({ daysLeft, isFirst }: { daysLeft: number; isFirst: boolean }) {
  let bg = "#FBF8F1";
  let fg = "#6E665A";
  let bd = "#D9CFBE";

  if (daysLeft === 0) {
    bg = "#50634A"; fg = "#FBF8F1"; bd = "#50634A";
  } else if (isFirst) {
    bg = "#E4E9DB"; fg = "#3F5139"; bd = "#B9C3AC";
  }

  const label = daysLeft === 0 ? "D-DAY" : daysLeft > 0 ? `D-${daysLeft}` : `D+${-daysLeft}`;

  return (
    <span
      className="px-[10px] py-1 rounded-full text-[12px]"
      style={{ background: bg, color: fg, border: `1px solid ${bd}` }}
    >
      {label}
    </span>
  );
}

function RecentMemoryCard({
  memory,
  onClick,
}: {
  memory: Memory;
  onClick: () => void;
}) {
  const bg = getPlaceholderGradient(memory.id ?? memory.title);
  const rot = getTilt(memory.id ?? memory.title);

  return (
    <button
      onClick={onClick}
      className="flex-none w-[136px] border-0 cursor-pointer text-left flex flex-col gap-[6px]"
      style={{
        padding: "7px 7px 10px",
        background: "#FFFDF8",
        boxShadow: "0 8px 18px -10px rgba(60,40,20,.4)",
        transform: `rotate(${rot}deg)`,
      }}
    >
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: memory.coverUrl ? undefined : bg }}
      >
        {memory.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={memory.coverUrl} alt={memory.title} className="w-full h-full object-cover" />
        )}
        {memory.photoCount > 1 && (
          <span
            className="absolute right-[5px] top-[5px] px-[6px] py-[1px] rounded-full text-[11px]"
            style={{ background: "rgba(251,248,241,.85)", color: "#4A443B" }}
          >
            +{memory.photoCount - 1}
          </span>
        )}
      </div>
      <div className="font-hand text-[19px] leading-none text-ink-hand whitespace-nowrap overflow-hidden text-ellipsis">
        {memory.title}
      </div>
      <div className="text-[11px] text-ink-3">{formatDot(memory.date)}</div>
    </button>
  );
}

function WishPlanRow({
  item,
  isLast,
  onClick,
}: {
  item: WishlistItem;
  isLast: boolean;
  onClick: () => void;
}) {
  const dotColor = item.status === "planned" ? "#7D9276" : "#D9CFBE";

  const daysLeft = item.targetDate
    ? (() => {
        const target = parseLocalDate(item.targetDate);
        const n = Math.round((target.getTime() - today().getTime()) / 86400000);
        return n;
      })()
    : null;

  const ddStr = daysLeft !== null
    ? (daysLeft === 0 ? "D-DAY" : daysLeft > 0 ? `D-${daysLeft}` : `D+${-daysLeft}`)
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full min-h-[62px] px-4 py-3 border-0 bg-transparent flex items-center gap-3 cursor-pointer text-left hover:bg-paper"
      style={{ borderBottom: isLast ? "none" : "1px solid #EFE8DC" }}
    >
      <span
        className="w-[10px] h-[10px] rounded-full flex-none"
        style={{ background: dotColor }}
      />
      <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
        <span className="text-[15px] text-ink">{item.title}</span>
        <span className="text-[12px] text-ink-3">
          {[item.status === "planned" ? "계획 중" : "하고 싶은 일", item.category, item.place]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      {ddStr && (
        <span className="font-display text-[18px] text-sage-deep">{ddStr}</span>
      )}
    </button>
  );
}

