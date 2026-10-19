"use client";

export const dynamic = "force-dynamic";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import { useToast } from "@/components/toast";
import type { Category, Memory } from "@/lib/types";

const CATEGORIES: Category[] = ["음식", "여행", "전시", "일상", "기타"];

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

  useEffect(() => {
    if (!coupleId || !id) return;
    getDoc(doc(db, "couples", coupleId, "memories", id)).then((snap) => {
      if (snap.exists()) {
        const m = snap.data() as Memory;
        setTitle(m.title);
        setDate(m.date);
        setPlace(m.place ?? "");
        setCategory(m.category);
        setContent(m.content);
      }
      setLoading(false);
    });
  }, [coupleId, id]);

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
      await updateDoc(doc(db, "couples", coupleId, "memories", id), {
        title: title.trim(),
        date,
        place: place.trim() || null,
        category,
        content: content.trim(),
        updatedBy: myUid,
        updatedAt: serverTimestamp(),
      });
      showToast("추억이 수정됐어요");
      router.replace(`/memories/${id}`);
    } catch {
      setError("저장에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="absolute inset-0 bg-paper" />;

  return (
    <div className="fixed inset-0 z-40 bg-paper flex flex-col animate-ola-up max-w-[480px] mx-auto left-1/2 -translate-x-1/2 w-full">
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
        <div className="flex flex-col gap-2">
          <div className="text-[13px] text-ink-2">제목</div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="그날을 한 줄로"
            className="w-full h-[48px] px-[14px] rounded-[10px] border border-line bg-paper-2 text-[15px] text-ink outline-none focus:border-sage"
          />
        </div>

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
