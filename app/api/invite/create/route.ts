import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getAdminApp, getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { idToken, selfName } = await req.json();

    if (!idToken || !selfName) {
      return NextResponse.json({ error: "필수 항목이 없어요." }, { status: 400 });
    }

    const auth = getAuth(getAdminApp());
    let uid: string;
    let photoURL: string | null = null;
    try {
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
      photoURL = decoded.picture ?? null;
    } catch {
      return NextResponse.json({ error: "인증 오류가 발생했어요." }, { status: 401 });
    }

    const db = getAdminDb();

    // 이미 커플이 있으면 새 초대 코드만 재발급
    const userSnap = await db.collection("users").doc(uid).get();
    if (userSnap.exists && userSnap.data()?.coupleId) {
      const existingCoupleId = userSnap.data()!.coupleId as string;
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
