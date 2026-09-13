"use client";

import { BrandMark } from "@/components/BrandMark";

export interface LandingFooterProps {
  onLogin: () => void;
}

export function LandingFooter({ onLogin }: LandingFooterProps) {
  return (
    <footer className="relative min-h-screen flex flex-col justify-between border-t border-[#1a1c23] bg-[#020306] px-6 pt-24 pb-12 text-[#f4f4f5] overflow-hidden">
      {/* Ambient background glow & plasma */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[650px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.14)_0%,rgba(168,85,247,0.12)_35%,rgba(59,130,246,0.06)_65%,transparent_80%)] blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#020306_90%)]" />
      </div>

      {/* Center Grand CTA */}
      <div className="relative z-10 mx-auto my-auto flex w-full max-w-4xl flex-col items-center text-center">
        <h2 className="font-[family-name:var(--font-hero)] text-5xl sm:text-7xl md:text-8xl font-bold tracking-tight text-[#f4f4f5] leading-[1.04]">
          Deploy your squadron
        </h2>

        {/* High-Impact CTA Button */}
        <div className="mt-10">
          <button
            type="button"
            onClick={onLogin}
            className="group relative inline-flex cursor-pointer items-center justify-center gap-3 rounded-full bg-[#f4f4f5] px-10 py-4 text-base font-bold text-[#050608] shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-all duration-300 hover:bg-white hover:scale-105 active:scale-95"
          >
            <span>Open Desk</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </div>
      </div>

      {/* Minimal Bottom Bar */}
      <div className="relative z-10 mx-auto w-full max-w-6xl border-t border-[#1a1c23] pt-8 flex items-center justify-between">
        <BrandMark
          className="pt-0 cursor-pointer"
          textClassName="text-[1.15rem] font-medium tracking-tight"
          orbSize={22}
        />
        <div className="font-mono text-xs text-[#52525b]">
          © {new Date().getFullYear()} Squadrons
        </div>
      </div>
    </footer>
  );
}
