import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/register-sw";

export const metadata: Metadata = {
  title: "Better Expense",
  description:
    "A savings tracker that gamifies setting money aside and rewards you for it.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Better",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#059669",
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900 selection:bg-emerald-200">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
