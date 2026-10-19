import type { Metadata, Viewport } from "next";
import {
  Gowun_Batang,
  Gowun_Dodum,
  Nanum_Pen_Script,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

const gowunBatang = Gowun_Batang({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const gowunDodum = Gowun_Dodum({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const nanumPenScript = Nanum_Pen_Script({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-hand",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Our Little Archive",
  description: "우리의 작은 기록 보관함",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Our Archive",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#F2EDE1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`
        ${gowunBatang.variable}
        ${gowunDodum.variable}
        ${nanumPenScript.variable}
        ${instrumentSerif.variable}
        h-full antialiased
      `}
    >
      <body className="h-full">
        <AuthProvider>
          <div className="min-h-full flex justify-center bg-paper">
            <div className="relative w-full max-w-[480px] min-h-screen bg-paper overflow-hidden">
              {children}
              <PaperTexture />
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}

function PaperTexture() {
  return (
    <svg
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 90,
        mixBlendMode: "multiply",
        opacity: 0.55,
      }}
    >
      <filter id="olaGrain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency=".85"
          numOctaves="2"
          stitchTiles="stitch"
        />
        <feColorMatrix values="0 0 0 0 .42  0 0 0 0 .35  0 0 0 0 .25  0 0 0 .09 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#olaGrain)" />
    </svg>
  );
}
