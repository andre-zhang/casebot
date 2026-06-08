import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Management Consulting Prep Program — Case Practice",
  description: "MBB-style case interview practice with voice and written feedback.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#002a5c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${openSans.variable} h-full scroll-smooth antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
