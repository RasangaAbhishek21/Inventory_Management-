import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";
import { RegisterSW } from "@/components/pwa/RegisterSW";
import { t } from "@/strings";
import "./globals.css";

const appSans = Geist({
  variable: "--font-app-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: t.appName,
  description: "Finished-goods stock for Home 47 — record movements, check availability.",
  applicationName: t.appName,
  appleWebApp: { capable: true, title: "Home 47", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${appSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-page text-ink">
        <RegisterSW />
        {children}
        <Toaster
          position="top-center"
          richColors
          toastOptions={{ style: { fontSize: "1rem" } }}
        />
      </body>
    </html>
  );
}
