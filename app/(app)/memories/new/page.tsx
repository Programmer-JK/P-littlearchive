"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { resizeImage } from "@/lib/image-utils";
import { toDateString, today } from "@/lib/utils";
import { useToast } from "@/components/toast";
import type { Category, WishlistItem } from "@/lib/types";

const CATEGORIES: Category[] = ["음식", "여행", "전시", "일상", "기타"];

interface PhotoPreview {
  localUrl: string;
  file: File;
}

export default function NewMemoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;

  const fromWishId = searchParams.get("fromWish");

  const [wishItem, setWishItem] = useState<WishlistItem | null>(null);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toDateString(today()));
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<Category>("일상");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!fromWishId || !coupleId) return;
    getDoc(doc(db, "couples", coupleId, "wishlist", fromWishId)).then((snap) => {
      if (snap.exists()) {
        const item = { id: snap.id, ...snap.data() } as WishlistItem;
        setWishItem(item);
        setTitle(item.title);
        setPlace(item.place ?? "");
        setCategory(item.category);
      }
    });
  }, [fromWishId, coupleId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const localUrl = URL.createObjectURL(file);
      setPhotos((prev) => [...prev, { localUrl, file }]);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].localUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSave() {
    if (!coupleId || !myUid) return;
    if (!title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!date) {
      setError("날짜를 선택해 주세요.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const memoryId = doc(collection(db, "couples", coupleId, "memories")).id;

      // Upload photos
      let coverPath: string | null = null;
      const uploadedPhotos: Array<{
        storagePath: string;
        thumbPath: string;
        photoUrl: string;
        thumbUrl: string;
        sortOrder: number;
      }> = [];

      for (let i = 0; i < photos.length; i++) {
        const { file } = photos[i];
        const photoId = `${Date.now()}-${i}`;

        // Full-size (max 1600px)
        const fullBlob = await resizeImage(file, 1600);
        const fullPath = `couples/${coupleId}/memories/${memoryId}/${photoId}.jpg`;
        const fullRef = ref(storage, fullPath);
        await uploadBytes(fullRef, fullBlob, { contentType: "image/jpeg" });
        const photoUrl = await getDownloadURL(fullRef);

        // Thumbnail (max 400px)
        const thumbBlob = await resizeImage(file, 400);
        const thumbPath = `couples/${coupleId}/memories/${memoryId}/${photoId}_thumb.jpg`;
        const thumbRef = ref(storage, thumbPath);
        await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
        const thumbUrl = await getDownloadURL(thumbRef);

        if (i === 0) coverPath = fullPath;
        uploadedPhotos.push({ storagePath: fullPath, thumbPath, photoUrl, thumbUrl, sortOrder: i });
      }

      const batch = writeBatch(db);

      // Memory doc
      const memRef = doc(db, "couples", coupleId, "memories", memoryId);
      batch.set(memRef, {
        title: title.trim(),
        date,
        place: place.trim() || null,
        category,
        content: content.trim(),
        photoCount: uploadedPhotos.length,
        coverPath,
        wishlistId: fromWishId ?? null,
        createdBy: myUid,
        updatedBy: myUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Photo sub-docs
      for (const p of uploadedPhotos) {
        const pRef = doc(
          collection(db, "couples", coupleId, "memories", memoryId, "photos")
        );
        batch.set(pRef, {
          ...p,
          caption: "",
          uploadedBy: myUid,
          createdAt: serverTimestamp(),
        });
      }

      // Update wishlist status to done
      if (fromWishId) {
        const wRef = doc(db, "couples", coupleId, "wishlist", fromWishId);
        batch.update(wRef, {
          status: "done",
          memoryId,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();

      showToast("추억이 저장됐어요");
      router.replace(`/memories/${memoryId}`);
    } catch (e) {
      console.error(e);
      setError("저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
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
        <div className="text-center font-heading text-[17px]">추억 남기기</div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-[18px] flex flex-col gap-5 pb-10">
        {/* From wish banner */}
        {wishItem && (
          <div
            className="p-[12px_14px] rounded-[10px] text-[13px] leading-[1.5]"
            style={{ background: "#E4E9DB", color: "#3F5139" }}
          >
            '{wishItem.title}'에서 이어서 기록해요. 저장하면 이 항목은 완료로 바뀌어요.
          </div>
        )}

        {/* Photos */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">사진</div>
          <div className="flex gap-[10px] overflow-x-auto pb-1">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex-none w-[86px] h-[86px] rounded-[8px] cursor-pointer flex flex-col items-center justify-center gap-1 text-ink-2 text-[12px]"
              style={{ border: "1.5px dashed #BFB4A1", background: "#FBF8F1" }}
            >
              <span className="text-[22px] leading-none">+</span>
              사진 추가
            </button>
            {photos.map((p, i) => (
              <div
                key={i}
                className="relative flex-none w-[86px] h-[86px] rounded-[8px] overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.localUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <button
                  onClick={() => removePhoto(i)}
                  aria-label="사진 빼기"
                  className="absolute right-[3px] top-[3px] w-[26px] h-[26px] rounded-full border-0 text-white text-[15px] leading-none cursor-pointer flex items-center justify-center"
                  style={{ background: "rgba(47,43,37,.6)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">제목</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="그날을 한 줄로"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </div>

        {/* Date + Place */}
        <div className="grid gap-[10px]" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">날짜</div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-[48px] px-[10px] rounded-[10px] border border-line bg-paper-2 text-[14px] text-ink outline-none focus:border-sage"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[13px] text-ink-2">장소</div>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder="어디에서"
              className="w-full h-[48px] px-3 rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
            />
          </div>
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">데이트 유형</div>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="h-[38px] px-[15px] rounded-full text-[14px] cursor-pointer"
                style={{
                  background: category === c ? "#50634A" : "transparent",
                  color: category === c ? "#FBF8F1" : "#6E665A",
                  border: `1px solid ${category === c ? "#50634A" : "#D9CFBE"}`,
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">그날의 짧은 후기</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="기억하고 싶은 장면, 나눈 이야기"
            className="w-full px-[14px] rounded-[10px] border border-line text-[16px] text-ink outline-none resize-none lined-paper focus:border-sage"
            style={{ paddingTop: "4px" }}
          />
        </div>

        {error && <div className="text-[14px] text-clay-deep">{error}</div>}
      </div>
    </div>
  );
}
