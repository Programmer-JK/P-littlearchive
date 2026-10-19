import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

async function verifyIdToken(idToken: string): Promise<{ uid: string; picture: string | null }> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Firebase API key not configured");
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message || "Token verification failed");
  }
  const data = await res.json() as { users?: Array<{ localId: string; photoUrl?: string }> };
  const u = data.users?.[0];
  if (!u) throw new Error("User not found");
  return { uid: u.localId, picture: u.photoUrl ?? null };
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, selfName } = await req.json();

    if (!idToken || !selfName) {
      return NextResponse.json({ error: "필수 항목이 없어요." }, { status: 400 });
    }

    let uid: string;
    let photoURL: string | null = null;
    try {
      const decoded = await verifyIdToken(idToken);
      uid = decoded.uid;
      photoURL = decoded.picture;
    } catch {
      return NextResponse.json({ error: "인증 오류가 발생했어요." }, { status: 401 });
    }

    const db = getAdminDb();

    // 이미 커플이 있으면 상황에 따라 처리
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists && userSnap.data()?.coupleId) {
      const existingCoupleId = userSnap.data()!.coupleId as string;

      // 파트너가 이미 연결된 경우(2명) 초대 코드 재발급 안 함
      const coupleSnap = await db.collection("couples").doc(existingCoupleId).get();
      const existingMemberUids: string[] = coupleSnap.data()?.memberUids ?? [];
      if (existingMemberUids.length >= 2) {
        return NextResponse.json({ coupleId: existingCoupleId, code: null });
      }

      // 파트너 미연결 상태: 새 초대 코드 재발급
      const code = randomBytes(16).toString("hex");
      const codeHash = createHash("sha256").update(code).digest("hex");
      const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
      await db.collection("couples").doc(existingCoupleId).update({
        invite: { codeHash, expiresAt, usedBy: null },
        updatedAt: Timestamp.now(),
      });
      return NextResponse.json({ coupleId: existingCoupleId, code });
    }

    // 새 커플 생성
    const code = randomBytes(16).toString("hex");
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);

    const coupleRef = db.collection("couples").doc();
    const coupleId = coupleRef.id;
    const now = Timestamp.now();

    const batch = db.batch();

    batch.set(coupleRef, {
      name: `${selfName}의 작은 기록 보관함`,
      memberUids: [uid],
      startDate: "",
      invite: { codeHash, expiresAt, usedBy: null },
      createdAt: now,
      updatedAt: now,
    });

    batch.set(coupleRef.collection("members").doc(uid), {
      displayName: selfName,
      photoURL: photoURL,
      role: "owner",
      joinedAt: now,
    });

    batch.set(db.collection("users").doc(uid), { coupleId });

    await batch.commit();

    return NextResponse.json({ coupleId, code });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
