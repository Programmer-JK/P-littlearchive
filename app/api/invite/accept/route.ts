import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { code, uid, displayName, photoURL } = await req.json();

    if (!code || !uid) {
      return NextResponse.json({ error: "코드 또는 UID가 없어요." }, { status: 400 });
    }

    const db = getAdminDb();
    const codeHash = createHash("sha256").update(code).digest("hex");

    // 해당 코드를 가진 커플 문서 조회
    const couplesSnap = await db
      .collection("couples")
      .where("invite.codeHash", "==", codeHash)
      .limit(1)
      .get();

    if (couplesSnap.empty) {
      return NextResponse.json({ error: "유효하지 않은 초대 링크예요." }, { status: 404 });
    }

    const coupleDoc = couplesSnap.docs[0];
    const coupleId = coupleDoc.id;
    const data = coupleDoc.data();
    const invite = data.invite;

    // 만료 여부 확인
    if (!invite || invite.expiresAt.toMillis() < Date.now()) {
      return NextResponse.json({ error: "초대 링크가 만료됐어요. 새 링크를 요청해 주세요." }, { status: 410 });
    }

    // 이미 사용된 링크 확인
    if (invite.usedBy !== null) {
      return NextResponse.json({ error: "이미 사용된 초대 링크예요." }, { status: 409 });
    }

    // 멤버 수 확인 (최대 2명)
    if (data.memberUids && data.memberUids.length >= 2) {
      return NextResponse.json({ error: "이미 두 명이 연결된 공간이에요." }, { status: 409 });
    }

    // 이미 이 커플에 속해 있는지 확인
    if (data.memberUids?.includes(uid)) {
      return NextResponse.json({ coupleId }, { status: 200 });
    }

    const batch = db.batch();
    const now = Timestamp.now();

    // 커플 문서 업데이트: memberUids 추가 + invite.usedBy 기록
    batch.update(coupleDoc.ref, {
      memberUids: FieldValue.arrayUnion(uid),
      "invite.usedBy": uid,
      updatedAt: now,
    });

    // users/{uid} 문서 생성/업데이트
    batch.set(db.collection("users").doc(uid), {
      coupleId,
    });

    // couples/{coupleId}/members/{uid} 문서 생성
    batch.set(coupleDoc.ref.collection("members").doc(uid), {
      displayName: displayName || "파트너",
      photoURL: photoURL || null,
      role: "partner",
      joinedAt: now,
    });

    await batch.commit();

    return NextResponse.json({ coupleId });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "서버 오류가 발생했어요." }, { status: 500 });
  }
}
