import type { Timestamp } from "firebase/firestore";

export type Category = "음식" | "여행" | "전시" | "일상" | "기타";
export type Priority = "보통" | "하고 싶음" | "꼭 하기";
export type WishStatus = "wish" | "planned" | "done";

// couples/{coupleId}
export interface Couple {
  name: string;
  memberUids: string[];
  startDate: string; // YYYY-MM-DD
  invite: {
    codeHash: string;
    expiresAt: Timestamp;
    usedBy: string | null;
  } | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// couples/{coupleId}/members/{uid}
export interface Member {
  displayName: string;
  photoURL: string | null;
  role: "owner" | "partner";
  joinedAt: Timestamp;
}

// couples/{coupleId}/memories/{memoryId}
export interface Memory {
  id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  place: string | null;
  category: Category;
  content: string;
  photoCount: number;
  coverPath: string | null;
  wishlistId: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// couples/{coupleId}/memories/{memoryId}/photos/{photoId}
export interface Photo {
  id?: string;
  storagePath: string;
  thumbPath: string;
  caption: string;
  sortOrder: number;
  uploadedBy: string;
  createdAt: Timestamp;
}

// couples/{coupleId}/wishlist/{wishlistId}
export interface WishlistItem {
  id?: string;
  title: string;
  category: Category;
  place: string | null;
  estimatedCost: number | null;
  priority: Priority;
  status: WishStatus;
  targetDate: string | null; // YYYY-MM-DD
  memoryId: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// couples/{coupleId}/anniversaries/{id}
export interface Anniversary {
  id?: string;
  title: string;
  date: string; // YYYY-MM-DD
  repeatYearly: boolean;
  createdBy: string;
  createdAt: Timestamp;
}

// couples/{coupleId}/notes/{noteId}
export interface Note {
  id?: string;
  from: string;
  to: string;
  storagePath: string;
  thumbPath: string;
  message: string;
  seenAt: Timestamp | null;
  createdAt: Timestamp;
}

// couples/{coupleId}/songs/{songId}
export interface Song {
  id?: string;
  from: string;
  to: string;
  videoId: string;
  title: string;
  artist: string;
  thumbnailUrl: string;
  message: string;
  seenAt: Timestamp | null;
  createdAt: Timestamp;
}

// users/{uid}
export interface UserDoc {
  coupleId: string | null;
}
