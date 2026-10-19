"use client";

import { useState, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  type Query,
  type DocumentData,
} from "firebase/firestore";
import { db } from "./firebase";
import type {
  Memory,
  WishlistItem,
  Anniversary,
  Note,
  Photo,
  Song,
} from "./types";

// ── Memories ─────────────────────────────────────────────────────────────────

export function useMemories(coupleId: string | null) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "memories"),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMemories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory))
      );
      setLoading(false);
    });
    return unsub;
  }, [coupleId]);

  return { memories, loading };
}

export function useRecentMemories(coupleId: string | null, count = 4) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "memories"),
      orderBy("date", "desc"),
      limit(count)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMemories(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Memory))
      );
      setLoading(false);
    });
    return unsub;
  }, [coupleId, count]);

  return { memories, loading };
}

export function useMemoryPhotos(coupleId: string | null, memoryId: string | null) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId || !memoryId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "memories", memoryId, "photos"),
      orderBy("sortOrder", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPhotos(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Photo)));
      setLoading(false);
    });
    return unsub;
  }, [coupleId, memoryId]);

  return { photos, loading };
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export function useWishlist(coupleId: string | null) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "wishlist"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WishlistItem)));
      setLoading(false);
    });
    return unsub;
  }, [coupleId]);

  return { items, loading };
}

// ── Anniversaries ─────────────────────────────────────────────────────────────

export function useAnniversaries(coupleId: string | null) {
  const [anniversaries, setAnniversaries] = useState<Anniversary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "anniversaries"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setAnniversaries(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Anniversary))
      );
      setLoading(false);
    });
    return unsub;
  }, [coupleId]);

  return { anniversaries, loading };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function useNotes(coupleId: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "notes"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
      setLoading(false);
    });
    return unsub;
  }, [coupleId]);

  return { notes, loading };
}

export function useUnreadNotes(coupleId: string | null, myUid: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!coupleId || !myUid) return;
    const q = query(
      collection(db, "couples", coupleId, "notes"),
      where("to", "==", myUid),
      where("seenAt", "==", null)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.size);
    });
    return unsub;
  }, [coupleId, myUid]);

  return count;
}

// ── Songs ─────────────────────────────────────────────────────────────────────

export function useSongs(coupleId: string | null) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coupleId) { setLoading(false); return; }
    const q = query(
      collection(db, "couples", coupleId, "songs"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Song)));
      setLoading(false);
    });
    return unsub;
  }, [coupleId]);

  return { songs, loading };
}

export function useUnreadSongs(coupleId: string | null, myUid: string | null) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!coupleId || !myUid) return;
    const q = query(
      collection(db, "couples", coupleId, "songs"),
      where("to", "==", myUid),
      where("seenAt", "==", null)
    );
    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.size);
    });
    return unsub;
  }, [coupleId, myUid]);

  return count;
}
