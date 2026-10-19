"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function RootPage() {
  const { user, coupleData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!coupleData) {
      router.replace("/onboarding");
    } else {
      router.replace("/home");
    }
  }, [user, coupleData, loading, router]);

  return <div className="absolute inset-0 bg-paper" />;
}
