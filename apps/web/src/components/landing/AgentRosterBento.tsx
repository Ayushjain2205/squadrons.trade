"use client";

import Image from "next/image";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

interface AgentArchetype {
  id: string;
  name: string;
  role: string;
  chainName: string;
  chainLogo: string;
  avatarId: AvatarId;
  colorId: OrbColorId;
  mandate: string;
  skills: string[];
  tools: string[];
  metrics: { label: string; value: string };
  gridSpan: string;
  accentBorderHover: string;
  accentBg: string;
  glowColor: string;
}

const ARCHETYPES: AgentArchetype[] = [
  {
    id: "base-lp",
    name: "Base LP Harvester",
    role: "Concentrated Liquidity Operator",
    chainName: "Base",
    chainLogo: "/chains/base.png",
    avatarId: "03",
    colorId: "blue",
    mandate:
      "Active tick-range manager on Aerodrome. Continuously shifts liquidity bounds to maximize swap fee capture and auto-compound yield.",
    skills: ["market-analyser", "lp-scout"],
    tools: ["search", "quote"],
    metrics: { label: "30D Fee APY", value: "+28.4%" },
    gridSpan: "md:col-span-2",
    accentBorderHover: "hover:border-[#60a5fa]/60",
    accentBg: "bg-[#0b1320]",
    glowColor: "rgba(96,165,250,0.15)",
  },
  {
    id: "arb-scout",
    name: "Arbitrum Arb Scout",
    role: "Cross-Venue Route Finder",
    chainName: "Arbitrum",
    chainLogo: "/chains/arbitrum.png",
    avatarId: "06",
    colorId: "red",
    mandate:
      "Monitors tick discrepancies between Camelot and Uniswap v3 with zero inventory risk.",
    skills: ["arbitrage-hunter"],
    tools: ["mempool", "quote"],
    metrics: { label: "Avg Latency", value: "<120ms" },
    gridSpan: "md:col-span-1",
    accentBorderHover: "hover:border-[#e07a7a]/60",
    accentBg: "bg-[#180f11]",
    glowColor: "rgba(224,122,122,0.15)",
  },
  {
    id: "eth-alpha",
    name: "CT Alpha Sentinel",
    role: "Social Sentiment & Flow Scanner",
    chainName: "Ethereum",
    chainLogo: "/chains/ethereum.png",
    avatarId: "08",
    colorId: "orange",
    mandate:
      "Scans Crypto Twitter velocity and correlates social alpha with smart-money DEX accumulation.",
    skills: ["token-screener"],
    tools: ["pulse", "search"],
    metrics: { label: "Scan Velocity", value: "340/min" },
    gridSpan: "md:col-span-1",
    accentBorderHover: "hover:border-[#e0b35a]/60",
    accentBg: "bg-[#16120b]",
    glowColor: "rgba(224,179,90,0.15)",
  },
  {
    id: "perp-basis",
    name: "Delta-Neutral Basis Sentinel",
    role: "Perp Funding Arbitrageur",
    chainName: "Optimism",
    chainLogo: "/chains/optimism.png",
    avatarId: "04",
    colorId: "yellow",
    mandate:
      "Harvests perpetual funding rate skews while maintaining automated spot delta hedges protected by safety spend ceilings.",
    skills: ["funding-rate-monitor", "yield-optimizer"],
    tools: ["backtest", "safety"],
    metrics: { label: "Basis Yield", value: "16.2% APR" },
    gridSpan: "md:col-span-2",
    accentBorderHover: "hover:border-[#5dcea0]/60",
    accentBg: "bg-[#0b1712]",
    glowColor: "rgba(93,206,160,0.15)",
  },
];

export function AgentRosterBento() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.07)_0%,rgba(96,165,250,0.05)_40%,transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
              05
            </span>
            <span>Squadron Roster</span>
          </div>

          <h2 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
            Deploy specialized operators out of the box
          </h2>
        </div>

        {/* Dynamic Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {ARCHETYPES.map((agent) => (
            <div
              key={agent.id}
              className={`group relative rounded-3xl border border-[#262626] bg-[#090a0d] p-6 sm:p-7 shadow-2xl transition-all duration-300 ${agent.gridSpan} ${agent.accentBorderHover} flex flex-col justify-between overflow-hidden`}
            >
              {/* Subtle dynamic hover background glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
                style={{
                  background: `radial-gradient(400px circle at top right, ${agent.glowColor}, transparent 70%)`,
                }}
              />

              <div className="relative z-10 space-y-5">
                {/* Top Bar: Chain & Avatar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full border border-[#22232b] bg-[#101117] px-3 py-1">
                    <div className="relative h-4 w-4 overflow-hidden rounded-md">
                      <Image
                        src={agent.chainLogo}
                        alt={agent.chainName}
                        width={16}
                        height={16}
                        className="object-cover"
                      />
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#a1a1aa]">
                      {agent.chainName}
                    </span>
                  </div>

                  <div className="shrink-0 group-hover:scale-105 transition-transform duration-300">
                    <AgentOrb
                      id={agent.avatarId}
                      colorId={agent.colorId}
                      size={54}
                      animate={true}
                    />
                  </div>
                </div>

                {/* Identity & Mandate */}
                <div className="space-y-2">
                  <h3 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] tracking-tight">
                    {agent.name}
                  </h3>
                  <p className="text-xs text-[#8a8a93] leading-relaxed line-clamp-3">
                    {agent.mandate}
                  </p>
                </div>
              </div>

              {/* Bottom: Skills, Tools & Key Metric */}
              <div className="relative z-10 mt-6 pt-5 border-t border-[#1f1f23] flex flex-wrap items-center justify-between gap-3">
                {/* Equipped Skills & Tools */}
                <div className="flex flex-wrap items-center gap-1.5">
                  {agent.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-[#22232b] bg-[#0e0f14] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#5dcea0]"
                    >
                      /{skill}
                    </span>
                  ))}
                  {agent.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-md border border-[#22232b] bg-[#0e0f14] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#e0b35a]"
                    >
                      @{tool}
                    </span>
                  ))}
                </div>

                {/* Key Metric Pill */}
                <div className="flex items-center gap-2 rounded-lg bg-[#14151c] px-3 py-1 font-mono text-xs">
                  <span className="text-[#8a8a93] text-[10px] uppercase">
                    {agent.metrics.label}
                  </span>
                  <span className="font-bold text-[#5dcea0]">
                    {agent.metrics.value}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
