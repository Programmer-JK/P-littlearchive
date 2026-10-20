"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage } from "@/lib/firebase";
import { resizeImage } from "@/lib/image-utils";
import { useToast } from "@/components/toast";
import { getPlaceholderGradient } from "@/lib/utils";
import type { Category, Memory, Photo } from "@/lib/types";

const CATEGORIES: Category[] = ["음식", "여행", "전시", "일상", "기타"];

interface ExistingPhoto extends Photo {
  markedForDeletion: boolean;
}

interface NewPhoto {
  file: File;
  localUrl: string;
}

export default function EditMemoryPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();
  const { coupleData, user } = useAuth();
  const { showToast } = useToast();

  const coupleId = coupleData?.coupleId ?? null;
  const myUid = user?.uid ?? null;

  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [place, setPlace] = useState("");
  const [category, setCategory] = useState<Category>("일상");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Photo state
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);
  const [newPhotos, setNewPhotos] = useState<NewPhoto[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!coupleId || !id) return;
    // Load memory doc
    getDoc(doc(db, "couples", coupleId, "memories", id)).then((snap) => {
      if (snap.exists()) {
        const m = snap.data() as Memory;
        setTitle(m.title);
        setDate(m.date);
        setPlace(m.place ?? "");
        setCategory(m.category);
        setContent(m.content);
      }
    });
    // Load photos
    getDocs(
      collection(db, "couples", coupleId, "memories", id, "photos")
    ).then((snap) => {
      const loaded = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Photo))
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({ ...p, markedForDeletion: false }));
      setExistingPhotos(loaded);
      setLoading(false);
    });
  }, [coupleId, id]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const localUrl = URL.createObjectURL(file);
      setNewPhotos((prev) => [...prev, { localUrl, file }]);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleDeleteExisting(photoId: string) {
    setExistingPhotos((prev) =>
      prev.map((p) =>
        p.id === photoId ? { ...p, markedForDeletion: !p.markedForDeletion } : p
      )
    );
  }

  function removeNewPhoto(index: number) {
    setNewPhotos((prev) => {
      URL.revokeObjectURL(prev[index].localUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  const activeExisting = existingPhotos.filter((p) => !p.markedForDeletion);
  const totalPhotoCount = activeExisting.length + newPhotos.length;

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

    const uploadedPaths: string[] = [];

    try {
      // 1. Delete photos marked for deletion
      for (const photo of existingPhotos.filter((p) => p.markedForDeletion)) {
        try {
          await deleteObject(ref(storage, photo.storagePath));
        } catch {}
        try {
          if (photo.thumbPath) await deleteObject(ref(storage, photo.thumbPath));
        } catch {}
        await deleteDoc(
          doc(db, "couples", coupleId, "memories", id, "photos", photo.id!)
        );
      }

      // 2. Upload new photos
      const remainingSortMax = activeExisting.length > 0
        ? Math.max(...activeExisting.map((p) => p.sortOrder))
        : -1;

      const uploadedPhotos: Array<{
        storagePath: string;
        thumbPath: string;
        photoUrl: string;
        thumbUrl: string;
        sortOrder: number;
      }> = [];

      for (let i = 0; i < newPhotos.length; i++) {
        const { file } = newPhotos[i];
        const photoId = `${Date.now()}-${i}`;

        const fullBlob = await resizeImage(file, 1600);
        const fullPath = `couples/${coupleId}/memories/${id}/${photoId}.jpg`;
        const fullRef = ref(storage, fullPath);
        await uploadBytes(fullRef, fullBlob, { contentType: "image/jpeg" });
        uploadedPaths.push(fullPath);
        const photoUrl = await getDownloadURL(fullRef);

        const thumbBlob = await resizeImage(file, 400);
        const thumbPath = `couples/${coupleId}/memories/${id}/${photoId}_thumb.jpg`;
        const thumbRef = ref(storage, thumbPath);
        await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
        uploadedPaths.push(thumbPath);
        const thumbUrl = await getDownloadURL(thumbRef);

        uploadedPhotos.push({
          storagePath: fullPath,
          thumbPath,
          photoUrl,
          thumbUrl,
          sortOrder: remainingSortMax + 1 + i,
        });

        // Save photo sub-doc
        const pRef = doc(collection(db, "couples", coupleId, "memories", id, "photos"));
        await setDoc(pRef, {
          storagePath: fullPath,
          thumbPath,
          photoUrl,
          thumbUrl,
          caption: "",
          sortOrder: remainingSortMax + 1 + i,
          uploadedBy: myUid,
          createdAt: serverTimestamp(),
        });
      }

      // 3. Determine new cover
      const allActiveSorted = [
        ...activeExisting,
        ...uploadedPhotos.map((p, i) => ({ ...p, id: `new-${i}`, markedForDeletion: false } as ExistingPhoto)),
      ].sort((a, b) => a.sortOrder - b.sortOrder);

      const newCoverPath = allActiveSorted[0]?.storagePath ?? null;
      const newCoverUrl = allActiveSorted[0]?.photoUrl ?? null;

      // 4. Update memory doc
      await updateDoc(doc(db, "couples", coupleId, "memories", id), {
        title: title.trim(),
        date,
        place: place.trim() || null,
        category,
        content: content.trim(),
        photoCount: totalPhotoCount,
        coverPath: newCoverPath,
        coverUrl: newCoverUrl,
        updatedBy: myUid,
        updatedAt: serverTimestamp(),
      });

      // Cleanup local object URLs
      newPhotos.forEach((p) => URL.revokeObjectURL(p.localUrl));

      showToast("추억이 수정됐어요");
      router.replace(`/memories/${id}`);
    } catch (e) {
      for (const path of uploadedPaths) {
        try { await deleteObject(ref(storage, path)); } catch {}
      }
      console.error(e);
      setError("저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="absolute inset-0 bg-paper" />;

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col animate-ola-up max-w-[480px] mx-auto left-1/2 -translate-x-1/2 w-full">
      {/* Header */}
      <div
        className="pt-[54px] px-2 pb-[6px] grid items-center border-b border-line"
        style={{ gridTemplateColumns: "72px 1fr 72px" }}
      >
        <button
          onClick={() => router.back()}
          disabled={saving}
          className="h-[44px] border-0 bg-transparent text-[15px] text-ink-2 cursor-pointer disabled:opacity-40"
        >
          취소
        </button>
        <div className="text-center font-heading text-[17px]">추억 수정</div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="h-[44px] border-0 bg-transparent text-[15px] text-sage-deep font-bold cursor-pointer disabled:opacity-60"
        >
          저장
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-[18px] flex flex-col gap-5 pb-10">
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

            {/* Existing photos */}
            {existingPhotos.map((p) => (
              <div
                key={p.id}
                className="relative flex-none w-[86px] h-[86px] rounded-[8px] overflow-hidden"
                style={{ opacity: p.markedForDeletion ? 0.35 : 1 }}
              >
                <div
                  className="w-full h-full"
                  style={{ background: getPlaceholderGradient(p.id ?? "") }}
                >
                  {p.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbUrl} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <button
                  onClick={() => toggleDeleteExisting(p.id!)}
                  aria-label={p.markedForDeletion ? "삭제 취소" : "사진 빼기"}
                  className="absolute right-[3px] top-[3px] w-[26px] h-[26px] rounded-full border-0 text-white text-[15px] leading-none cursor-pointer flex items-center justify-center"
                  style={{
                    background: p.markedForDeletion
                      ? "rgba(80,99,74,.8)"
                      : "rgba(47,43,37,.6)",
                  }}
                >
                  {p.markedForDeletion ? "↩" : "×"}
                </button>
              </div>
            ))}

            {/* New photos */}
            {newPhotos.map((p, i) => (
              <div
                key={i}
                className="relative flex-none w-[86px] h-[86px] rounded-[8px] overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.localUrl} alt="" className="w-full h-full object-cover" />
                <div
                  className="absolute left-[3px] top-[3px] w-[18px] h-[18px] rounded-full flex items-center justify-center"
                  style={{ background: "#7D9276" }}
                >
                  <span className="text-[9px] text-white font-bold">NEW</span>
                </div>
                <button
                  onClick={() => removeNewPhoto(i)}
                  aria-label="사진 빼기"
                  className="absolute right-[3px] top-[3px] w-[26px] h-[26px] rounded-full border-0 text-white text-[15px] leading-none cursor-pointer flex items-center justify-center"
                  style={{ background: "rgba(47,43,37,.6)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {existingPhotos.filter((p) => p.markedForDeletion).length > 0 && (
            <div className="text-[12px] text-ink-3">
              흐리게 표시된 사진은 저장 시 삭제돼요. 다시 누르면 취소할 수 있어요.
            </div>
          )}
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

      {/* Progress overlay */}
      {saving && (
        <div
          className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3"
          style={{ background: "rgba(242,237,225,.88)" }}
        >
          <div
            className="w-9 h-9 rounded-full border-[3px] border-sage-tint"
            style={{ borderTopColor: "#50634A", animation: "spin 0.8s linear infinite" }}
          />
          <span className="text-[14px] text-ink-2">저장 중이에요…</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
