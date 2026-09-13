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
        {/* Glowing badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2a303c] bg-[#0a0d14]/80 px-4 py-1.5 font-mono text-xs text-[#5dcea0] backdrop-blur-md shadow-[0_0_20px_rgba(93,206,160,0.15)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0] animate-ping" />
          <span className="h-1.5 w-1.5 -ml-2 rounded-full bg-[#5dcea0]" />
          <span>SQUADRONS OPERATOR HARNESS</span>
        </div>

        {/* Big Bold Climax Headline */}
        <h2 className="font-[family-name:var(--font-hero)] text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-[#f4f4f5] leading-[1.08]">
          Ready to deploy your first squadron?
        </h2>

        {/* Subtext */}
        <p className="mx-auto mt-6 max-w-xl text-base sm:text-lg md:text-xl text-[#a1a1aa] leading-relaxed font-normal">
          Launch autonomous onchain trading desks in seconds. Non-custodial, safety-capped, and ready out of the box.
        </p>

        {/* High-Impact CTA Button */}
        <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
          <button
            type="button"
            onClick={onLogin}
            className="group relative inline-flex cursor-pointer items-center justify-center gap-3 rounded-full bg-[#f4f4f5] px-10 py-4 text-base font-bold text-[#050608] shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-all duration-300 hover:bg-white hover:scale-105 active:scale-95"
          >
            <span>Launch Operator Desk</span>
            <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
          </button>
        </div>

        {/* Security & Guardrail Trust Badges */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 font-mono text-xs text-[#71717a]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
            <span>Non-Custodial Keys</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
            <span>Hard Spend Caps</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
            <span>1-Click Kill Switch</span>
          </div>
        </div>
      </div>

      {/* Bottom Footer Bar */}
      <div className="relative z-10 mx-auto w-full max-w-6xl border-t border-[#1a1c23] pt-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-4">
            <BrandMark
              className="pt-0 cursor-pointer"
              textClassName="text-[1.15rem] font-medium tracking-tight"
              orbSize={22}
            />
            <span className="hidden sm:inline text-xs text-[#52525b]">|</span>
            <span className="hidden sm:inline font-mono text-xs text-[#71717a]">
              The Agent Harness for DeFi
            </span>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-2 font-mono text-xs text-[#5dcea0] rounded-full border border-[#1f2923] bg-[#0c1410] px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#5dcea0] animate-pulse" />
            <span>ALL SYSTEMS NOMINAL</span>
          </div>

          {/* Monospace Links */}
          <div className="flex items-center gap-6 font-mono text-xs text-[#a1a1aa]">
            <a
              href="https://github.com/Ayushjain2205/squadrons.trade"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#f4f4f5] transition"
            >
              GitHub
            </a>
            <a
              href="https://x.com/squadronstrade"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#f4f4f5] transition"
            >
              Twitter / X
            </a>
            <button
              type="button"
              onClick={onLogin}
              className="hover:text-[#5dcea0] transition cursor-pointer"
            >
              Launch App
            </button>
          </div>
        </div>

        {/* Sub-footer Copyright */}
        <div className="mt-8 text-center text-[11px] font-mono text-[#52525b]">
          © {new Date().getFullYear()} Squadrons. Built for autonomous DeFi operators.
        </div>
      </div>
    </footer>
  );
}
