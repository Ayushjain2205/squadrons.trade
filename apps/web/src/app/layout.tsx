import type { Metadata } from "next";
import { Cherry_Bomb_One, Manrope, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const display = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
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
    "Persistent crypto agents with goals, memory, and observe-first spend.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${body.variable} ${display.variable} ${brand.variable} ${mono.variable} h-full antialiased`}
      >
        {/*
          THESIS: Operator desk — agent roster left, live chat center, agent context right.
          OWN-WORLD: Near-black Grok-like rails, charcoal wells, mint status, orb faces, Cherry Bomb One wordmark.
          STORY: Pick an agent, talk to it, glance goal/spend without leaving the desk.
          FIRST VIEWPORT: Full-height three columns; selected rail; center chat + pill composer; right goal/status.
          FORM: Grok Bot desk canon (user-pinned) + Squadrons brand mark
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
        */}
        {children}
      </body>
    </html>
  );
}
