"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { Couple, Member, UserDoc } from "./types";

interface CoupleData {
  coupleId: string;
  couple: Couple;
  members: Record<string, Member>;
  myUid: string;
  partnerUid: string | null;
}

interface AuthContextValue {
  user: User | null;
  coupleData: CoupleData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refetchCouple: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [coupleData, setCoupleData] = useState<CoupleData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCoupleData = async (uid: string) => {
    try {
      const userSnap = await getDoc(doc(db, "users", uid));
      if (!userSnap.exists()) return null;

      const userDoc = userSnap.data() as UserDoc;
      if (!userDoc.coupleId) return null;

      const coupleSnap = await getDoc(doc(db, "couples", userDoc.coupleId));
      if (!coupleSnap.exists()) return null;

      const couple = coupleSnap.data() as Couple;

      // Fetch members
      const membersData: Record<string, Member> = {};
      for (const memberUid of couple.memberUids) {
        const memberSnap = await getDoc(
          doc(db, "couples", userDoc.coupleId, "members", memberUid)
        );
        if (memberSnap.exists()) {
          membersData[memberUid] = memberSnap.data() as Member;
        }
      }

      const partnerUid =
        couple.memberUids.find((uid2) => uid2 !== uid) ?? null;

      return {
        coupleId: userDoc.coupleId,
        couple,
        members: membersData,
        myUid: uid,
        partnerUid,
      };
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const data = await fetchCoupleData(firebaseUser.uid);
        setCoupleData(data);
      } else {
        setCoupleData(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOutUser = async () => {
    await signOut(auth);
    setCoupleData(null);
  };

  const refetchCouple = async () => {
    if (!user) return;
    const data = await fetchCoupleData(user.uid);
    setCoupleData(data);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        coupleData,
        loading,
        signInWithGoogle,
        signOutUser,
        refetchCouple,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
