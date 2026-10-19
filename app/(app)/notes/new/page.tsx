"use client";

export const dynamic = "force-dynamic";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  setDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { resizeImage } from "@/lib/image-utils";
import { getTilt, getPlaceholderGradient } from "@/lib/utils";
import { useToast } from "@/components/toast";

export default function NewNotePage() {
  const router = useRouter();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;
  const partnerUid = coupleData?.partnerUid;
  const partnerName = partnerUid
    ? (coupleData?.members[partnerUid]?.displayName ?? "파트너")
    : "파트너";

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const tilt = getTilt("note-form");

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
  }

  async function handleSend() {
    if (!coupleId || !myUid || !partnerUid) return;
    if (!photoFile) {
      setError("사진을 선택해 주세요.");
      return;
    }
    setSending(true);
    setError("");

    try {
      const noteId = doc(collection(db, "couples", coupleId, "notes")).id;

      // Upload full
      const fullBlob = await resizeImage(photoFile, 1600);
      const storagePath = `couples/${coupleId}/notes/${noteId}.jpg`;
      const fullRef = ref(storage, storagePath);
      await uploadBytes(fullRef, fullBlob, { contentType: "image/jpeg" });
      const photoUrl = await getDownloadURL(fullRef);

      // Upload thumb
      const thumbBlob = await resizeImage(photoFile, 400);
      const thumbPath = `couples/${coupleId}/notes/${noteId}_thumb.jpg`;
      const thumbRef = ref(storage, thumbPath);
      await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
      const thumbUrl = await getDownloadURL(thumbRef);

      await setDoc(doc(db, "couples", coupleId, "notes", noteId), {
        from: myUid,
        to: partnerUid,
        storagePath,
        thumbPath,
        photoUrl,
        thumbUrl,
        message: message.trim(),
        seenAt: null,
        createdAt: serverTimestamp(),
      });

      showToast(`${partnerName}에게 보냈어요`);
      router.replace("/album?tab=notes");
    } catch {
      setError("보내기에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col animate-ola-up max-w-[480px] mx-auto left-1/2 -translate-x-1/2 w-full">
      {/* Header */}
      <div
        className="pt-[54px] px-2 pb-[6px] grid items-center border-b border-line"
        style={{ gridTemplateColumns: "72px 1fr 72px" }}
      >
        <button
          onClick={() => router.back()}
          className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer"
        >
          취소
        </button>
        <div className="text-center font-heading text-[17px]">사진 보내기</div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
        >
          {sending ? "보내는 중…" : "보내기"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-[22px] flex flex-col gap-[18px]">
        {/* Polaroid */}
        <div
          className="flex flex-col gap-[10px]"
          style={{
            padding: "10px 10px 14px",
            background: "#FFFDF8",
            boxShadow: "0 14px 28px -16px rgba(60,40,20,.5)",
            transform: `rotate(${tilt}deg)`,
          }}
        >
          {/* Photo area */}
          {!photoUrl ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full cursor-pointer flex flex-col items-center justify-center gap-[6px] text-ink-2 text-[14px]"
              style={{
                aspectRatio: "4/5",
                border: "1.5px dashed #BFB4A1",
                background: "#F7F2E9",
              }}
            >
              <span className="text-[28px] leading-none">+</span>
              사진 고르기
            </button>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="다시 고르기"
              className="w-full cursor-pointer border-0 p-0"
              style={{ aspectRatio: "4/5" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          )}

          {/* Message */}
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="한 줄 메모 (선택)"
            className="w-full h-[40px] px-1 border-0 bg-transparent font-hand text-[23px] text-ink-hand outline-none"
            style={{ color: "#3A352E" }}
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="text-[13px] leading-[1.55] text-ink-3 text-center">
          {partnerName}에게 바로 보여요. 보낸 사진은 사진첩의 '주고받은 사진'에 남아요.
        </div>

        {error && (
          <div className="text-[14px] text-clay-deep text-center">{error}</div>
        )}
      </div>
    </div>
  );
}
