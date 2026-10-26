"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { TabBar } from "@/components/tab-bar";
import { ToastProvider } from "@/components/toast";
import { PageTransition } from "@/components/page-transition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, coupleData, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!coupleData) {
      router.replace("/onboarding");
    }
  }, [user, coupleData, loading, router]);

  if (loading || !user || !coupleData) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="relative h-full">
        <main className="absolute inset-0 overflow-y-auto pt-[60px] pb-[120px]">
          <PageTransition>{children}</PageTransition>
        </main>
        <TabBar />
      </div>
    </ToastProvider>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full px-5">
      {[0.8, 0.6, 0.9].map((opacity, i) => (
        <div
          key={i}
          className="bg-paper-2 rounded-xl"
          style={{
            height: i === 0 ? "160px" : "80px",
            opacity,
          }}
        />
      ))}
    </div>
  );
}
