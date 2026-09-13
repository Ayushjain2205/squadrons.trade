import type { Metadata } from "next";
import { Cherry_Bomb_One, Manrope, IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { AuthGate } from "@/components/AuthGate";
import { Providers } from "@/components/Providers";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const heroFont = Space_Grotesk({
  variable: "--font-hero",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const brand = Cherry_Bomb_One({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: "400",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Squadrons",
  description:
    "Persistent crypto agents with memory — Observe, Paper, then Live.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${body.variable} ${brand.variable} ${mono.variable} ${heroFont.variable} h-full antialiased`}
      >
        <Providers>
          <AuthGate>{children}</AuthGate>
        </Providers>
      </body>
    </html>
  );
}
