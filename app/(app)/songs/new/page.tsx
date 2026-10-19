"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/toast";
import { gwa } from "@/lib/utils";

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    // music.youtube.com/watch?v=ID 또는 www.youtube.com/watch?v=ID
    if (
      (u.hostname === "music.youtube.com" || u.hostname === "www.youtube.com") &&
      u.pathname === "/watch"
    ) {
      return u.searchParams.get("v");
    }
    // youtu.be/ID
    if (u.hostname === "youtu.be") {
      return u.pathname.slice(1) || null;
    }
    // youtube.com/embed/ID
    if (u.hostname === "www.youtube.com" && u.pathname.startsWith("/embed/")) {
      return u.pathname.split("/embed/")[1] || null;
    }
  } catch {
    // invalid URL
  }
  return null;
}

interface OEmbedResult {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

async function fetchOEmbed(videoId: string): Promise<OEmbedResult | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function SongNewPage() {
  const router = useRouter();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const partnerUid = coupleData?.partnerUid ?? null;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "파트너")
    : "파트너";

  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ title: string; artist: string; thumbnailUrl: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [urlError, setUrlError] = useState("");
  const [sending, setSending] = useState(false);

  async function handleUrlBlur() {
    if (!url.trim()) return;
    const id = extractVideoId(url.trim());
    if (!id) {
      setUrlError("유튜브 또는 유튜브 뮤직 링크를 붙여 넣어 주세요.");
      setVideoId(null);
      setMeta(null);
      return;
    }
    setUrlError("");
    setVideoId(id);
    setFetching(true);
    const data = await fetchOEmbed(id);
    setFetching(false);
    if (data) {
      setMeta({
        title: data.title,
        artist: data.author_name,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      });
    } else {
      setMeta({ title: "", artist: "", thumbnailUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg` });
    }
  }

  async function handleSend() {
    if (!videoId || !coupleData || !user || !partnerUid) return;
    setSending(true);
    try {
      await addDoc(
        collection(db, "couples", coupleData.coupleId, "songs"),
        {
          from: user.uid,
          to: partnerUid,
          videoId,
          title: meta?.title ?? "",
          artist: meta?.artist ?? "",
          thumbnailUrl: meta?.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
          message: message.trim(),
          seenAt: null,
          createdAt: serverTimestamp(),
        }
      );
      showToast(`${partnerName}에게 보냈어요`);
      router.back();
    } catch {
      setSending(false);
    }
  }

  const canSend = !!videoId && !fetching;

  return (
    <div className="absolute inset-0 z-30 bg-paper flex flex-col animate-ola-in">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5"
        style={{ height: 60, borderBottom: "1px solid #E3DACB" }}
      >
        <button
          onClick={() => router.back()}
          className="text-[15px] text-ink-2 cursor-pointer"
        >
          취소
        </button>
        <span className="font-heading text-[17px]">노래 공유하기</span>
        <button
          onClick={handleSend}
          disabled={!canSend || sending}
          className="text-[15px] font-heading cursor-pointer disabled:opacity-40"
          style={{ color: "#50634A" }}
        >
          {sending ? "보내는 중…" : "보내기"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-5">
        {/* URL input */}
        <div className="flex flex-col gap-[6px]">
          <label className="text-[13px] text-ink-2">유튜브 / 유튜브 뮤직 링크</label>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setUrlError(""); }}
            onBlur={handleUrlBlur}
            placeholder="https://music.youtube.com/watch?v=..."
            className="h-[48px] px-[14px] rounded-[10px] border bg-paper-2 text-[14px] text-ink outline-none focus:border-sage"
            style={{ borderColor: urlError ? "#A4583C" : "#E3DACB" }}
          />
          {urlError && (
            <div className="text-[12px]" style={{ color: "#A4583C" }}>{urlError}</div>
          )}
          {fetching && (
            <div className="text-[12px] text-ink-3">곡 정보를 가져오는 중…</div>
          )}
        </div>

        {/* Preview */}
        {videoId && meta && (
          <div
            className="rounded-[14px] overflow-hidden border border-line-soft bg-paper-2 flex flex-col gap-3 pb-3"
          >
            {/* Thumbnail */}
            <div className="relative w-full" style={{ aspectRatio: "16/9", background: "#D6CEC1" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meta.thumbnailUrl}
                alt={meta.title}
                className="w-full h-full object-cover"
              />
              {/* Play overlay */}
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(0,0,0,.15)" }}
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
            </div>

            <div className="px-4 flex flex-col gap-[3px]">
              {meta.title && (
                <div className="font-heading text-[16px] text-ink leading-tight">{meta.title}</div>
              )}
              {meta.artist && (
                <div className="text-[13px] text-ink-3">{meta.artist}</div>
              )}
              <div className="text-[11px] text-ink-3 mt-[2px]">
                유튜브에서 재생돼요
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        <div className="flex flex-col gap-[6px]">
          <label className="text-[13px] text-ink-2">
            한 마디 <span className="text-ink-3">(선택)</span>
          </label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={60}
            placeholder={`${partnerName}에게 전하고 싶은 말`}
            className="h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[14px] text-ink outline-none focus:border-sage"
          />
        </div>

        {/* Notice */}
        <div
          className="px-4 py-3 rounded-[10px] text-[13px] leading-[1.55]"
          style={{ background: "#E4E9DB", color: "#3F5139" }}
        >
          {partnerName}{gwa(partnerName)} 앱에서 바로 볼 수 있어요. 공유한 노래는 사진첩의 '공유한 노래'에 남아요.
        </div>
      </div>
    </div>
  );
}
