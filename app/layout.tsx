import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { PWAInstall } from "@/components/PWAInstall";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "FabSimple — Steel Fabrication Management",
  description:
    "End-to-end structural steel fabrication management: estimating, production tracking, QC compliance, and billing.",
  manifest: "/manifest.json",
  applicationName: "FabSimple",
  appleWebApp: { capable: true, title: "FabSimple", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.svg", apple: "/icons/icon-192.svg" },
};

export const viewport: Viewport = {
  themeColor: "#4F46E5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <PWAInstall />
      </body>
    </html>
  );
}
