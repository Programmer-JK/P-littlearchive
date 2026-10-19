"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { useMemoryPhotos } from "@/lib/firestore-hooks";
import {
  getPlaceholderGradient,
  getTilt,
  formatDot,
  formatLong,
  formatYMD,
} from "@/lib/utils";
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";
import type { Memory, WishlistItem } from "@/lib/types";

export default function MemoryDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const members = coupleData?.members ?? {};

  const [memory, setMemory] = useState<Memory | null>(null);
  const [wishItem, setWishItem] = useState<WishlistItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);

  const { photos } = useMemoryPhotos(coupleId, id);

  useEffect(() => {
    if (!coupleId || !id) return;
    getDoc(doc(db, "couples", coupleId, "memories", id)).then((snap) => {
      if (snap.exists()) {
        const m = { id: snap.id, ...snap.data() } as Memory;
        setMemory(m);
        if (m.wishlistId) {
          getDoc(doc(db, "couples", coupleId, "wishlist", m.wishlistId)).then(
            (ws) => {
              if (ws.exists())
                setWishItem({ id: ws.id, ...ws.data() } as WishlistItem);
            }
          );
        }
      }
      setLoading(false);
    });
  }, [coupleId, id]);

  async function handleDelete() {
    if (!coupleId || !id) return;
    try {
      // Delete photos from Storage
      for (const photo of photos) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
          if (photo.thumbPath) {
            await deleteObject(ref(storage, photo.thumbPath));
          }
        } catch {
          // ignore individual file errors
        }
      }

      // Delete photo sub-docs
      const photoSnap = await getDocs(
        collection(db, "couples", coupleId, "memories", id, "photos")
      );
      for (const d of photoSnap.docs) {
        await deleteDoc(d.ref);
      }

      // Unlink wishlist
      if (memory?.wishlistId) {
        await updateDoc(
          doc(db, "couples", coupleId, "wishlist", memory.wishlistId),
          { memoryId: null, updatedAt: serverTimestamp() }
        );
      }

      // Delete memory doc
      await deleteDoc(doc(db, "couples", coupleId, "memories", id));

      showToast("추억이 삭제됐어요");
      router.back();
    } catch {
      showToast("삭제에 실패했어요");
    }
  }

  if (loading) {
    return <div className="absolute inset-0 bg-paper" />;
  }

  if (!memory) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-[14px] text-ink-3">추억을 찾을 수 없어요</div>
      </div>
    );
  }

  const tilt = getTilt(id);
  const coverBg = getPlaceholderGradient(id);
  const currentPhoto = photos[currentPhotoIdx];

  const authorName = members[memory.createdBy]?.displayName ?? "?";
  const updaterName = members[memory.updatedBy]?.displayName ?? "?";
  const updatedAt = memory.updatedAt?.toDate ? memory.updatedAt.toDate() : null;

  return (
    <div className="absolute inset-0 z-30 bg-paper overflow-y-auto animate-ola-in" style={{ paddingTop: "54px", paddingBottom: "40px" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3">
        <button
          onClick={() => router.back()}
          aria-label="뒤로"
          className="w-[44px] h-[44px] border-0 bg-transparent cursor-pointer text-ink flex items-center justify-center"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => router.push(`/memories/${id}/edit`)}
            className="h-[44px] px-3 border-0 bg-transparent text-[14px] text-sage-deep cursor-pointer"
          >
            수정
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="h-[44px] px-3 border-0 bg-transparent text-[14px] text-clay-deep cursor-pointer"
          >
            삭제
          </button>
        </div>
      </div>

      {/* Big polaroid */}
      <div className="px-[30px] pt-[10px]">
        <div
          className="relative flex flex-col"
          style={{
            padding: "12px 12px 16px",
            background: "#FFFDF8",
            boxShadow: "0 16px 30px -18px rgba(60,40,20,.5)",
            transform: `rotate(${tilt}deg)`,
          }}
        >
          {/* Tape */}
          <div
            className="absolute top-[-10px] left-1/2 w-[84px] h-[22px] z-10"
            style={{
              background: "rgba(222,208,170,.8)",
              transform: "translateX(-50%) rotate(2deg)",
            }}
          />
          <div
            className="relative overflow-hidden"
            style={{
              aspectRatio: "4/5",
              background: currentPhoto?.thumbPath ? undefined : coverBg,
            }}
          >
            {currentPhoto?.thumbPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentPhoto.thumbPath}
                alt={memory.title}
                className="w-full h-full object-cover"
              />
            )}
            {photos.length > 1 && (
              <span
                className="absolute right-2 top-2 px-2 py-[2px] rounded-full text-[12px]"
                style={{ background: "rgba(251,248,241,.88)", color: "#4A443B" }}
              >
                {currentPhotoIdx + 1} / {photos.length}
              </span>
            )}
          </div>
          <div className="font-hand text-[26px] leading-none text-ink-hand text-center pt-3">
            {formatDot(memory.date)}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 justify-center px-5 pt-[18px] flex-wrap">
          {photos.map((p, i) => (
            <button
              key={p.id!}
              onClick={() => setCurrentPhotoIdx(i)}
              className="w-[52px] h-[52px] rounded-[6px] overflow-hidden cursor-pointer p-0 border-2"
              style={{
                background: getPlaceholderGradient(`${id}-${i}`),
                borderColor: i === currentPhotoIdx ? "#50634A" : "transparent",
              }}
            >
              {p.thumbPath && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.thumbPath}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="px-6 pt-[26px] flex flex-col gap-[14px]">
        <div className="flex flex-col gap-[6px]">
          <div className="text-[13px] text-ink-2">{formatLong(memory.date)}</div>
          <div
            className="font-heading text-[27px] leading-[1.3]"
            style={{ textWrap: "pretty" } as React.CSSProperties}
          >
            {memory.title}
          </div>
        </div>

        <div className="flex gap-[6px] flex-wrap">
          {memory.place && (
            <span
              className="px-[11px] py-[5px] rounded-full text-[13px]"
              style={{ background: "#E4E9DB", color: "#3F5139" }}
            >
              {memory.place}
            </span>
          )}
          <span
            className="px-[11px] py-[5px] rounded-full text-[13px]"
            style={{ background: "#EFE8DC", color: "#6E665A" }}
          >
            {memory.category}
          </span>
        </div>

        {memory.content && (
          <div
            className="px-4 py-[6px] rounded-[6px] text-[16px] text-ink-hand whitespace-pre-wrap lined-paper"
            style={{ border: "1px solid #EAE2D4" }}
          >
            {memory.content}
          </div>
        )}

        {/* Wishlist link */}
        {wishItem && (
          <div
            className="flex items-center gap-[10px] p-[12px_14px] rounded-[10px]"
            style={{ border: "1px dashed #B9C3AC", background: "#EEF1E7" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#50634A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h14v17l-7-4-7 4z" />
            </svg>
            <div className="flex flex-col gap-[2px]">
              <span className="text-[12px]" style={{ color: "#6E7A66" }}>하고 싶은 것에서 이어진 기록</span>
              <span className="text-[14px] text-ink">{wishItem.title}</span>
            </div>
          </div>
        )}

        {/* Author */}
        <div className="flex flex-col gap-[3px] text-[12px] text-ink-3 pt-1">
          <span>{authorName} 작성</span>
          {updatedAt && (
            <span>
              마지막 수정 {updatedAt.getMonth() + 1}월 {updatedAt.getDate()}일{" "}
              {String(updatedAt.getHours()).padStart(2, "0")}:{String(updatedAt.getMinutes()).padStart(2, "0")} · {updaterName}
            </span>
          )}
        </div>
      </div>

      {/* Confirm delete */}
      {showConfirm && (
        <ConfirmModal
          title="이 추억을 지울까요?"
          body={`연결된 사진 ${photos.length}장도 함께 지워져요. 되돌릴 수 없어요.`}
          onConfirm={handleDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
