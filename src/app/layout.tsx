import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { NavWrapper } from "@/components/nav-wrapper";
import { Toaster } from "@/components/toast";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PayStables — Send & Receive USDC Instantly",
  description: "The simplest way to send and receive stablecoins on Arc Network.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#312E81",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-[100dvh] bg-bg-body flex justify-center">
        <Providers>
          <div className="relative w-full max-w-[430px] min-h-[100dvh] flex flex-col bg-bg-body overflow-x-hidden">
            <Toaster />
            <main className="flex-1 flex flex-col pb-[84px] overflow-y-auto">
              {children}
            </main>
            <NavWrapper />
          </div>
        </Providers>
      </body>
    </html>
  );
}
