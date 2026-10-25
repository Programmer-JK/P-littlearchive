"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { useMemories, useNotes, useSongs } from "@/lib/firestore-hooks";
import { db } from "@/lib/firebase";
import {
  getPlaceholderGradient,
  formatRelativeTime,
} from "@/lib/utils";
import type { Memory, Note, Song } from "@/lib/types";

type TabKey = "together" | "notes" | "songs";

export default function AlbumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { coupleData, user } = useAuth();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;
  const partnerUid = coupleData?.partnerUid;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "파트너")
    : "파트너";

  const tab = (searchParams.get("tab") as TabKey) ?? "together";

  const { memories } = useMemories(coupleId);
  const { notes } = useNotes(coupleId);
  const { songs } = useSongs(coupleId);

  const [query, setQuery] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Mark notes as read when entering notes tab
  useEffect(() => {
    if (tab !== "notes" || !coupleId || !myUid) return;
    notes
      .filter((n) => n.to === myUid && n.seenAt === null)
      .forEach((n) => {
        if (n.id) {
          updateDoc(doc(db, "couples", coupleId, "notes", n.id), {
            seenAt: serverTimestamp(),
          }).catch(() => {});
        }
      });
  }, [tab, notes, coupleId, myUid]);

  // Mark songs as read when entering songs tab
  useEffect(() => {
    if (tab !== "songs" || !coupleId || !myUid) return;
    songs
      .filter((s) => s.to === myUid && s.seenAt === null)
      .forEach((s) => {
        if (s.id) {
          updateDoc(doc(db, "couples", coupleId, "songs", s.id), {
            seenAt: serverTimestamp(),
          }).catch(() => {});
        }
      });
  }, [tab, songs, coupleId, myUid]);

  // Unread counts for badges
  const unreadCount = notes.filter(
    (n) => n.to === myUid && n.seenAt === null
  ).length;
  const unreadSongCount = songs.filter(
    (s) => s.to === myUid && s.seenAt === null
  ).length;

  // Filter memories
  const filtered = memories.filter((m) => {
    const matchQuery =
      !query ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      (m.place ?? "").toLowerCase().includes(query.toLowerCase());
    const matchMonth =
      selectedMonth === "all" || m.date.startsWith(selectedMonth);
    return matchQuery && matchMonth;
  });

  // Month chips
  const months = Array.from(
    new Set(memories.map((m) => m.date.slice(0, 7)))
  ).sort((a, b) => b.localeCompare(a));

  const thisYear = new Date().getFullYear().toString();
  const monthLabel = (ym: string) => {
    const [y, m] = ym.split("-");
    if (y === thisYear) return `${parseInt(m)}월`;
    return `${y.slice(2)}년 ${parseInt(m)}월`;
  };

  // Group by month
  type Group = { label: string; yearMonth: string; items: Memory[] };
  const groups: Group[] = [];
  for (const m of filtered) {
    const ym = m.date.slice(0, 7);
    const [y, mon] = ym.split("-");
    const label = `${y}년 ${parseInt(mon)}월`;
    const existing = groups.find((g) => g.yearMonth === ym);
    if (existing) {
      existing.items.push(m);
    } else {
      groups.push({ label, yearMonth: ym, items: [m] });
    }
  }

  // Total photo count
  const totalPhotos = memories.reduce((s, m) => s + (m.photoCount ?? 0), 0);

  // Sequential numbers: oldest memory = No.0001
  const memoryNumbers = useMemo(() => {
    const sorted = [...memories].sort((a, b) => a.date.localeCompare(b.date));
    const map = new Map<string, number>();
    sorted.forEach((m, i) => { if (m.id) map.set(m.id, i + 1); });
    return map;
  }, [memories]);

  const members = coupleData?.members ?? {};

  return (
    <div className="flex flex-col gap-4">
      {/* Title */}
      <div className="px-5 pt-[6px] flex flex-col gap-1">
        <div className="font-heading text-[26px]">우리의 순간들</div>
        <div className="text-[13px] text-ink-3">
          {tab === "together"
            ? `${memories.length}개의 추억 · 사진 ${totalPhotos}장`
            : `${partnerName}과/와 주고받은 사진 ${notes.length}장`}
        </div>
      </div>

      {/* Segment */}
      <div className="mx-5 p-1 rounded-[12px] bg-seg-track grid grid-cols-3 gap-1">
        <SegBtn
          active={tab === "together"}
          label="함께한 순간"
          onClick={() => router.push("/album?tab=together")}
        />
        <SegBtn
          active={tab === "notes"}
          label="주고받은 사진"
          badge={unreadCount > 0 ? unreadCount : undefined}
          onClick={() => router.push("/album?tab=notes")}
        />
        <SegBtn
          active={tab === "songs"}
          label="공유한 노래"
          badge={unreadSongCount > 0 ? unreadSongCount : undefined}
          onClick={() => router.push("/album?tab=songs")}
        />
      </div>

      {/* Together tab */}
      {tab === "together" && (
        <div className="flex flex-col gap-4">
          {/* Search */}
          <div className="px-5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="제목, 장소, 메모로 찾기"
              className="w-full h-[46px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
            />
          </div>

          {/* Month chips */}
          <div className="flex gap-2 overflow-x-auto px-5">
            <Chip
              active={selectedMonth === "all"}
              label="전체"
              onClick={() => setSelectedMonth("all")}
            />
            {months.map((ym) => (
              <Chip
                key={ym}
                active={selectedMonth === ym}
                label={monthLabel(ym)}
                onClick={() => setSelectedMonth(ym)}
              />
            ))}
          </div>

          {/* Card list */}
          {groups.length === 0 ? (
            <div className="px-5 py-10 text-center flex flex-col gap-[6px]">
              <div className="font-heading text-[22px] text-ink-2">아직 비어 있는 페이지</div>
              <div className="text-[13px] text-ink-3">조건에 맞는 추억이 없어요</div>
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.yearMonth} className="px-5 pt-2 flex flex-col gap-[10px]">
                <div className="flex items-baseline gap-2 pb-1">
                  <span className="font-heading text-[16px]">{g.label}</span>
                  <span className="text-[12px] text-ink-3">{g.items.length}개</span>
                </div>
                {g.items.map((m) => (
                  <AlbumCard
                    key={m.id!}
                    memory={m}
                    num={memoryNumbers.get(m.id!) ?? 0}
                    members={members}
                    onClick={() => router.push(`/memories/${m.id}`)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {/* Songs tab */}
      {tab === "songs" && (
        <div className="px-5 pt-1 flex flex-col gap-[20px]">
          <button
            onClick={() => router.push("/songs/new")}
            className="h-[50px] rounded-[12px] text-[14px] text-sage-deep cursor-pointer bg-paper-2"
            style={{ border: "1.5px dashed #BFB4A1" }}
          >
            + {partnerName}에게 노래 보내기
          </button>

          {songs.length === 0 ? (
            <div className="py-[30px] text-center text-[13px] text-ink-3">
              아직 공유한 노래가 없어요
            </div>
          ) : (
            songs.map((s) => (
              <SongCard
                key={s.id!}
                song={s}
                myUid={myUid ?? ""}
                members={coupleData?.members ?? {}}
              />
            ))
          )}
        </div>
      )}

      {/* Notes tab */}
      {tab === "notes" && (
        <div className="px-5 pt-1 flex flex-col gap-[26px]">
          <button
            onClick={() => router.push("/notes/new")}
            className="h-[50px] rounded-[12px] text-[14px] text-sage-deep cursor-pointer bg-paper-2"
            style={{ border: "1.5px dashed #BFB4A1" }}
          >
            + {partnerName}에게 사진 보내기
          </button>

          {notes.length === 0 ? (
            <div className="py-[30px] text-center text-[13px] text-ink-3">
              아직 주고받은 사진이 없어요
            </div>
          ) : (
            notes.map((n) => (
              <NoteCard
                key={n.id!}
                note={n}
                myUid={myUid ?? ""}
                members={coupleData?.members ?? {}}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SegBtn({
  active,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  label: string;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="h-[40px] border-0 rounded-[9px] text-[14px] cursor-pointer flex items-center justify-center gap-[6px]"
      style={{
        background: active ? "#FBF8F1" : "transparent",
        color: active ? "#2F2B25" : "#9A9182",
        boxShadow: active ? "0 1px 3px rgba(60,40,20,.1)" : "none",
      }}
    >
      {label}
      {badge !== undefined && (
        <span
          className="min-w-[18px] h-[18px] px-[5px] rounded-full text-[11px] flex items-center justify-center text-paper-2"
          style={{ background: "#A4583C" }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-none h-[36px] px-[14px] rounded-full text-[13px] cursor-pointer"
      style={{
        background: active ? "#50634A" : "transparent",
        color: active ? "#FBF8F1" : "#6E665A",
        border: `1px solid ${active ? "#50634A" : "#D9CFBE"}`,
      }}
    >
      {label}
    </button>
  );
}

const DOW_KO = ['일', '월', '화', '수', '목', '금', '토'];

function AlbumCard({
  memory,
  num,
  members,
  onClick,
}: {
  memory: Memory;
  num: number;
  members: Record<string, { displayName: string }>;
  onClick: () => void;
}) {
  const [y, mo, d] = memory.date.split('-');
  const dow = DOW_KO[new Date(parseInt(y), parseInt(mo) - 1, parseInt(d)).getDay()];
  const dateStr = `${y}.${mo}.${d} ${dow}`;
  const authorName = members[memory.createdBy]?.displayName ?? '?';

  return (
    <button
      onClick={onClick}
      className="w-full text-left cursor-pointer border-0 bg-paper-2 rounded-[4px] overflow-hidden"
      style={{
        border: "1px solid #E3DACB",
        boxShadow: "0 1px 0 rgba(60,40,20,.04), 0 4px 14px -8px rgba(60,40,20,.18)",
      }}
    >
      {/* Cover photo with OLA overlay */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: '4/5',
          background: getPlaceholderGradient(memory.id ?? memory.title),
        }}
      >
        {memory.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={memory.coverUrl} alt="" className="w-full h-full object-cover" />
        )}
        {/* Film-frame label overlay */}
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-[14px] py-[9px]"
          style={{ background: "rgba(251,248,241,.72)" }}
        >
          <span
            className="font-display text-[10px] tracking-[.14em] uppercase"
            style={{ color: "#6E665A" }}
          >
            Our Little Archive
          </span>
          <span className="font-mono text-[11px]" style={{ color: "#6E665A" }}>
            No.{String(num).padStart(4, '0')}
          </span>
        </div>
      </div>

      <div className="mx-[18px] mt-0" style={{ height: "1px", background: "#E3DACB" }} />

      {/* Meta */}
      <div className="grid py-[10px]" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
        <div className="px-[18px] py-[2px]" style={{ borderRight: "1px solid #E3DACB" }}>
          <div className="text-[10px] mb-[3px]" style={{ color: "#9A9182" }}>날짜</div>
          <div className="font-heading text-[13px] text-ink leading-tight">{dateStr}</div>
        </div>
        <div className="px-[14px] py-[2px]" style={{ borderRight: "1px solid #E3DACB" }}>
          <div className="text-[10px] mb-[3px]" style={{ color: "#9A9182" }}>장소</div>
          <div className="text-[13px] text-ink leading-tight truncate">{memory.place || '—'}</div>
        </div>
        <div className="px-[14px] py-[2px]">
          <div className="text-[10px] mb-[3px]" style={{ color: "#9A9182" }}>매수</div>
          <div className="text-[13px] text-ink leading-tight">{memory.photoCount}</div>
        </div>
      </div>

      <div className="mx-[18px]" style={{ height: "1px", background: "#E3DACB" }} />

      {/* Body */}
      <div className="px-[18px] pt-[14px] pb-[16px]">
        <div className="font-heading text-[21px] leading-[1.25] text-ink mb-[8px]">
          {memory.title}
        </div>
        {memory.content && (
          <div
            className="text-[13px] text-ink-2 leading-[1.75] mb-[10px] overflow-hidden"
            style={{
              display: '-webkit-box' as const,
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical' as const,
            }}
          >
            {memory.content}
          </div>
        )}
        <div className="text-[11px] text-right" style={{ color: "#9A9182" }}>
          {authorName} 남김
        </div>
      </div>
    </button>
  );
}

function SongCard({
  song,
  myUid,
  members,
}: {
  song: Song;
  myUid: string;
  members: Record<string, { displayName: string }>;
}) {
  const [playing, setPlaying] = useState(false);
  const isMine = song.from === myUid;
  const fromName = members[song.from]?.displayName ?? "?";
  const toName = members[song.to]?.displayName ?? "?";
  const avBg = song.from === myUid ? "#E2C6B2" : "#C5CDB6";
  const fromInitial = fromName[0] ?? "?";
  const isNew = !isMine && song.seenAt === null;
  const hasSeen = isMine && song.seenAt !== null;
  const timeStr = song.createdAt?.toDate ? formatRelativeTime(song.createdAt.toDate()) : "";

  return (
    <div className="flex flex-col gap-[10px]">
      {/* Meta */}
      <div className="flex items-center gap-[6px] text-[12px] text-ink-3">
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center font-heading text-[11px]"
          style={{ background: avBg }}
        >
          {fromInitial}
        </span>
        <span>{fromName} → {toName} · {timeStr}</span>
        {isNew && (
          <span
            className="px-[7px] py-[1px] rounded-full text-[10px] tracking-[.04em] text-paper-2"
            style={{ background: "#A4583C" }}
          >
            NEW
          </span>
        )}
        {hasSeen && <span className="text-sage">봤어요</span>}
      </div>

      {/* Card */}
      <div
        className="rounded-[14px] overflow-hidden border border-line-soft bg-paper-2 flex flex-col"
      >
        {playing ? (
          <iframe
            src={`https://www.youtube.com/embed/${song.videoId}?autoplay=1`}
            title={song.title}
            allow="autoplay; encrypted-media"
            allowFullScreen
            className="w-full"
            style={{ aspectRatio: "16/9", border: 0 }}
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="relative w-full cursor-pointer border-0 p-0"
            style={{ aspectRatio: "16/9", background: "#D6CEC1" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={song.thumbnailUrl || `https://i.ytimg.com/vi/${song.videoId}/mqdefault.jpg`}
              alt={song.title}
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,.12)" }}
            >
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center"
                style={{ background: "rgba(255,255,255,.9)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#2F2B25">
                  <path d="M5 3l14 9-14 9V3z" />
                </svg>
              </div>
            </div>
          </button>
        )}

        <div className="px-4 py-3 flex flex-col gap-[2px]">
          {song.title && (
            <div className="font-heading text-[15px] text-ink leading-tight">{song.title}</div>
          )}
          {song.artist && (
            <div className="text-[12px] text-ink-3">{song.artist}</div>
          )}
          {song.message && (
            <div className="text-[15px] leading-snug text-ink-2 mt-[4px]">
              {song.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NoteCard({
  note,
  myUid,
  members,
}: {
  note: Note;
  myUid: string;
  members: Record<string, { displayName: string }>;
}) {
  const isMine = note.from === myUid;
  const bg = getPlaceholderGradient(note.id ?? note.from);
  const fromName = members[note.from]?.displayName ?? "?";
  const toName = members[note.to]?.displayName ?? "?";
  const fromInitial = fromName[0] ?? "?";
  const avBg = note.from === myUid ? "#E2C6B2" : "#C5CDB6";

  const isNew = !isMine && note.seenAt === null;
  const hasSeen = isMine && note.seenAt !== null;

  const timeStr = note.createdAt?.toDate
    ? formatRelativeTime(note.createdAt.toDate())
    : "";

  const noteDate = note.createdAt?.toDate
    ? (() => {
        const d = note.createdAt.toDate();
        const y = String(d.getFullYear()).slice(2);
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `'${y} ${m} ${day}`;
      })()
    : null;

  return (
    <div
      className="flex flex-col gap-2"
      style={{ alignItems: isMine ? "flex-end" : "flex-start" }}
    >
      {/* Meta */}
      <div className="flex items-center gap-[6px] text-[12px] text-ink-3">
        <span
          className="w-[22px] h-[22px] rounded-full flex items-center justify-center font-heading text-[11px]"
          style={{ background: avBg }}
        >
          {fromInitial}
        </span>
        <span>{fromName} → {toName} · {timeStr}</span>
        {isNew && (
          <span
            className="px-[7px] py-[1px] rounded-full text-[10px] tracking-[.04em] text-paper-2"
            style={{ background: "#A4583C" }}
          >
            NEW
          </span>
        )}
        {hasSeen && (
          <span className="text-sage">봤어요</span>
        )}
      </div>

      {/* Photo card */}
      <div
        className="relative flex flex-col gap-2"
        style={{
          width: "76%",
          padding: "8px 8px 12px",
          background: "#FFFDF8",
          boxShadow: "0 12px 24px -14px rgba(60,40,20,.45)",
        }}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "4/5", background: note.thumbUrl ? undefined : bg }}
        >
          {note.thumbUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={note.thumbUrl} alt="" className="w-full h-full object-cover" />
          )}
          {noteDate && (
            <span
              className="absolute bottom-[6px] right-[7px] font-mono text-[11px] leading-none select-none"
              style={{ color: "#FF8C00", textShadow: "0 0 6px rgba(0,0,0,.5)" }}
            >
              {noteDate}
            </span>
          )}
        </div>
        {note.message && (
          <div className="text-[15px] leading-[1.4] text-ink-2 px-1">
            {note.message}
          </div>
        )}
      </div>
    </div>
  );
}
