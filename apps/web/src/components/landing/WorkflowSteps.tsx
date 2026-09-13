"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

interface StepChain {
  chainId: number;
  name: string;
  shortName: string;
  logoUrl: string;
}

const STEP_CHAINS: StepChain[] = [
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    logoUrl: "/chains/base.png",
  },
  {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    logoUrl: "/chains/ethereum.png",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    logoUrl: "/chains/arbitrum.png",
  },
  {
    chainId: 10,
    name: "Optimism",
    shortName: "Optimism",
    logoUrl: "/chains/optimism.png",
  },
  {
    chainId: 130,
    name: "Unichain",
    shortName: "Unichain",
    logoUrl: "/chains/unichain.png",
  },
  {
    chainId: 480,
    name: "World Chain",
    shortName: "World Chain",
    logoUrl: "/chains/worldchain.png",
  },
  {
    chainId: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood",
    logoUrl: "/chains/robinhood.png",
  },
  {
    chainId: 9991,
    name: "Arc",
    shortName: "Arc",
    logoUrl: "/chains/arc.png",
  },
];

interface AgentPreset {
  id: string;
  chainId: number;
  avatarId: AvatarId;
  colorId: OrbColorId;
  name: string;
}

const STEP_1_PRESETS: AgentPreset[] = [
  {
    id: "base-lp",
    chainId: 8453,
    avatarId: "03",
    colorId: "blue",
    name: "Base LP Scout",
  },
  {
    id: "eth-dip",
    chainId: 1,
    avatarId: "08",
    colorId: "orange",
    name: "ETH Dip Watch",
  },
  {
    id: "arb-sentinel",
    chainId: 42161,
    avatarId: "06",
    colorId: "red",
    name: "Arbitrum Flow Watch",
  },
  {
    id: "opt-pulse",
    chainId: 10,
    avatarId: "01",
    colorId: "green",
    name: "Optimism Scout",
  },
  {
    id: "uni-rebalance",
    chainId: 130,
    avatarId: "04",
    colorId: "yellow",
    name: "Unichain Rebalancer",
  },
  {
    id: "world-alpha",
    chainId: 480,
    avatarId: "07",
    colorId: "purple",
    name: "World Alpha Scout",
  },
  {
    id: "robinhood-spot",
    chainId: 4663,
    avatarId: "05",
    colorId: "pink",
    name: "Robinhood Sentinel",
  },
  {
    id: "arc-scout",
    chainId: 9991,
    avatarId: "02",
    colorId: "blue",
    name: "Arc Liquidity Sentinel",
  },
];

// Y coordinates for each of the 8 chain rows in SVG space
const CHAIN_Y_COORDS = [16, 48, 80, 112, 144, 176, 208, 240];
const TARGET_Y = 128;

interface MarqueeItem {
  name: string;
  desc: string;
}

const SKILLS_LIST: MarqueeItem[] = [
  { name: "market-analyser", desc: "Trending pools, flow & operator brief" },
  { name: "wallet-pulse", desc: "Balances, gas headroom & desk readiness" },
  { name: "dex-radar", desc: "Real-time liquidity depth & volume spikes" },
  { name: "arbitrage-hunter", desc: "Cross-DEX routing & price divergence" },
  { name: "lp-scout", desc: "Fee APY, tick density & IL risk analysis" },
  { name: "momentum-tracker", desc: "Breakout volume, RSI velocity & MACD turns" },
  { name: "funding-rate-monitor", desc: "Perp funding skews & basis yields" },
  { name: "token-screener", desc: "Smart money inflow & holder distribution" },
  { name: "yield-optimizer", desc: "Vault compounding & rebalance loops" },
  { name: "whale-watch", desc: "Large wallet transfers & accumulation zones" },
  { name: "gas-tracker", desc: "Base fee forecasting & priority spikes" },
];

const TOOLS_LIST: MarqueeItem[] = [
  { name: "search", desc: "Onchain subgraph & pool liquidity query" },
  { name: "pulse", desc: "Crypto Twitter & CT social sentiment stream" },
  { name: "backtest", desc: "90-day vector DEX simulation engine" },
  { name: "quote", desc: "Multi-DEX aggregator route & price impact" },
  { name: "safety", desc: "Dynamic gas limits & $10 spend cap ladder" },
  { name: "arm", desc: "Deterministic trigger loop compilation" },
  { name: "mempool", desc: "Pending block transaction & MEV radar" },
  { name: "contract", desc: "Decompiled ABI, events & bytecode verification" },
  { name: "balance", desc: "Multi-token wallet reserves & allowance audit" },
  { name: "order", desc: "Atomic swap & order placement router" },
];

const PLUGINS_LIST: MarqueeItem[] = [
  { name: "Uniswap v3", desc: "Concentrated liquidity AMM protocol" },
  { name: "Aerodrome", desc: "Base native liquidity & veAERO engine" },
  { name: "Camelot DEX", desc: "Arbitrum ecosystem AMM hub" },
  { name: "CoinGecko API", desc: "Real-time price feeds & market data" },
  { name: "Hyperliquid", desc: "Onchain perpetual DEX orderbook" },
  { name: "DefiLlama", desc: "Protocol TVL, volume & yield intelligence" },
  { name: "Twitter / X API", desc: "Live social alpha & sentiment streamer" },
  { name: "Aave v3", desc: "Money market supply & borrow rates" },
  { name: "The Graph", desc: "Decentralized subgraph indexing network" },
  { name: "Birdeye", desc: "DEX token analytics & trade streams" },
  { name: "1inch", desc: "Aggregated swap routing protocol" },
  { name: "Alchemy", desc: "High-throughput RPC node infrastructure" },
  { name: "Curve Finance", desc: "Deep stableswap & pegged pools" },
];

export function WorkflowSteps() {
  const [activePresetIndex, setActivePresetIndex] = useState(1); // ETH Dip Watch
  const [isFlickering, setIsFlickering] = useState(false);
  const [strategyMode, setStrategyMode] = useState<"paper" | "live">("paper");

  // Auto-cycle through the presets every 2.4s with smooth transition
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlickering(true);
      setTimeout(() => {
        setActivePresetIndex((prev) => (prev + 1) % STEP_1_PRESETS.length);
        setIsFlickering(false);
      }, 140);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  const currentPreset = STEP_1_PRESETS[activePresetIndex];
  const activeChainIndex = STEP_CHAINS.findIndex(
    (c) => c.chainId === currentPreset.chainId
  );

  return (
    <section className="relative min-h-[85vh] flex flex-col justify-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-36 md:py-44 text-[#f4f4f5]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/3 top-1/4 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.08)_0%,transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-36">
        {/* =========================================================================
            STEP 1: Choose chain, create agent (Top-centered layout)
            ========================================================================= */}
        <div className="flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                01
              </span>
              <span>Step 1</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Choose chain, create agent
            </h3>
          </div>

          {/* Branching visual container centered below */}
          <div className="w-full">
            <div className="relative flex items-center justify-between gap-4 sm:gap-8 rounded-3xl border border-[#262626] bg-[#090a0d] p-6 sm:p-9 shadow-2xl overflow-hidden">
              {/* 1. All Supported Chains (Left) */}
              <div className="flex flex-col gap-2 w-44 sm:w-52 shrink-0">
                {STEP_CHAINS.map((chain, index) => {
                  const isActive = index === activeChainIndex;
                  return (
                    <div
                      key={chain.chainId}
                      onClick={() => {
                        const idx = STEP_1_PRESETS.findIndex((p) => p.chainId === chain.chainId);
                        if (idx !== -1) setActivePresetIndex(idx);
                      }}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2 transition-all duration-300 cursor-pointer select-none ${
                        isActive
                          ? "border-[#5dcea0] bg-[#121c17] shadow-[0_0_15px_rgba(93,206,160,0.2)] ring-1 ring-[#5dcea0]/40"
                          : "border-[#262626] bg-[#0e0f14] hover:border-[#3f3f46] hover:bg-[#14151c]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-4.5 w-4.5 overflow-hidden rounded-md bg-[#181a20]">
                          <Image
                            src={chain.logoUrl}
                            alt={chain.name}
                            width={18}
                            height={18}
                            className="object-cover"
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold transition-colors ${
                            isActive ? "text-[#f4f4f5]" : "text-[#a1a1aa]"
                          }`}
                        >
                          {chain.shortName}
                        </span>
                      </div>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0] shadow-[0_0_6px_#5dcea0]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 2. Dynamic SVG Branching Connector (Center) */}
              <div className="hidden sm:flex shrink-0 w-32 items-center justify-center">
                <svg viewBox="0 0 100 256" className="h-64 w-full">
                  <defs>
                    <linearGradient id="activeBranchGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#5dcea0" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#5dcea0" stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  {/* Background inactive dotted branch curves */}
                  {CHAIN_Y_COORDS.map((startY, i) => {
                    const isActive = i === activeChainIndex;
                    if (isActive) return null;
                    return (
                      <path
                        key={`inactive-${i}`}
                        d={`M 0 ${startY} C 50 ${startY}, 50 ${TARGET_Y}, 100 ${TARGET_Y}`}
                        fill="none"
                        stroke="#262626"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        className="transition-all duration-300"
                      />
                    );
                  })}

                  {/* Active Highlighted Branch Curve */}
                  {activeChainIndex >= 0 && (
                    <path
                      d={`M 0 ${CHAIN_Y_COORDS[activeChainIndex]} C 55 ${CHAIN_Y_COORDS[activeChainIndex]}, 45 ${TARGET_Y}, 100 ${TARGET_Y}`}
                      fill="none"
                      stroke="url(#activeBranchGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_8px_rgba(93,206,160,0.8)] transition-all duration-300"
                    />
                  )}

                  {/* Convergence endpoint dot */}
                  <circle cx="100" cy={TARGET_Y} r="3.5" fill="#5dcea0" className="shadow-[0_0_8px_#5dcea0]" />
                </svg>
              </div>

              {/* 3. Pure Avatar + Name (Spacious right container) */}
              <div className="flex flex-1 min-w-0 items-center justify-start pl-2 sm:pl-4">
                <div
                  className={`flex items-center gap-4 transition-all duration-200 select-none min-w-0 ${
                    isFlickering ? "opacity-30 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  {/* Avatar Orb */}
                  <div className="shrink-0">
                    <AgentOrb
                      id={currentPreset.avatarId}
                      colorId={currentPreset.colorId}
                      size={60}
                      animate={true}
                    />
                  </div>

                  {/* Agent Name */}
                  <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4f5] whitespace-nowrap">
                    {currentPreset.name}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            STEP 2: Research with skills, tools and plugins (3-Row Marquee)
            ========================================================================= */}
        <div className="flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                02
              </span>
              <span>Step 2</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Research with skills, tools and plugins
            </h3>
          </div>

          {/* Marquee Container with edge fade masks */}
          <div className="w-full overflow-hidden space-y-4 py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            {/* ROW 1: SKILLS (Scrolls Left) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-left flex gap-3.5 items-center">
                {[...SKILLS_LIST, ...SKILLS_LIST, ...SKILLS_LIST].map((skill, idx) => (
                  <div
                    key={`skill-${skill.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#5dcea0]/60 hover:bg-[#11141a] hover:shadow-[0_0_20px_rgba(93,206,160,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5dcea0]/15 font-mono text-xs font-bold text-[#5dcea0] group-hover:bg-[#5dcea0]/25 transition-colors">
                      /
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#5dcea0] transition-colors">
                        {skill.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {skill.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ROW 2: TOOLS (Scrolls Right) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-right flex gap-3.5 items-center">
                {[...TOOLS_LIST, ...TOOLS_LIST, ...TOOLS_LIST].map((tool, idx) => (
                  <div
                    key={`tool-${tool.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#e0b35a]/60 hover:bg-[#161410] hover:shadow-[0_0_20px_rgba(224,179,90,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e0b35a]/15 font-mono text-xs font-bold text-[#e0b35a] group-hover:bg-[#e0b35a]/25 transition-colors">
                      @
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#e0b35a] transition-colors">
                        {tool.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {tool.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ROW 3: PLUGINS (Scrolls Left) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-left flex gap-3.5 items-center">
                {[...PLUGINS_LIST, ...PLUGINS_LIST, ...PLUGINS_LIST].map((plugin, idx) => (
                  <div
                    key={`plugin-${plugin.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#60a5fa]/60 hover:bg-[#0e131d] hover:shadow-[0_0_20px_rgba(96,165,250,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 items-center justify-center rounded-md bg-[#60a5fa]/15 px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#60a5fa] group-hover:bg-[#60a5fa]/25 transition-colors">
                      MCP
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#60a5fa] transition-colors">
                        {plugin.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {plugin.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            STEP 3: Arm strategy in paper mode or live mode
            ========================================================================= */}
        <div className="flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                03
              </span>
              <span>Step 3</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Arm strategy in paper or live mode
            </h3>
          </div>

          {/* Strategy Execution Console */}
          <div className="w-full">
            <div className="rounded-3xl border border-[#262626] bg-[#090a0d] p-6 sm:p-8 shadow-2xl space-y-6">
              {/* Header Bar: Strategy & Mode Toggle */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1f1f23] pb-5">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      strategyMode === "paper"
                        ? "bg-[#e0b35a] shadow-[0_0_8px_#e0b35a]"
                        : "bg-[#5dcea0] shadow-[0_0_8px_#5dcea0]"
                    }`}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-bold text-[#f4f4f5]">
                        ETH Dip Mean-Reversion
                      </h4>
                      <span className="rounded bg-[#1c1d24] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#a1a1aa]">
                        Base · Aerodrome CL
                      </span>
                    </div>
                    <p className="text-xs text-[#8a8a93]">
                      {strategyMode === "paper"
                        ? "Simulated quotes & virtual ledger · Zero onchain risk"
                        : "Real onchain execution · $10 spend cap per cycle"}
                    </p>
                  </div>
                </div>

                {/* Interactive Mode Switcher */}
                <div className="flex items-center rounded-xl border border-[#22232b] bg-[#050608] p-1">
                  <button
                    type="button"
                    onClick={() => setStrategyMode("paper")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-all ${
                      strategyMode === "paper"
                        ? "bg-[#e0b35a]/20 text-[#e0b35a] shadow-[0_0_12px_rgba(224,179,90,0.25)] border border-[#e0b35a]/40"
                        : "text-[#8a8a93] hover:text-[#f4f4f5]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e0b35a]" />
                    Paper Mode
                  </button>
                  <button
                    type="button"
                    onClick={() => setStrategyMode("live")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono text-xs font-semibold transition-all ${
                      strategyMode === "live"
                        ? "bg-[#5dcea0]/20 text-[#5dcea0] shadow-[0_0_12px_rgba(93,206,160,0.25)] border border-[#5dcea0]/40"
                        : "text-[#8a8a93] hover:text-[#f4f4f5]"
                    }`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
                    Live Mode
                  </button>
                </div>
              </div>

              {/* Split Content: Strategy Logic (Left) & Telemetry (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Logic & Guardrails */}
                <div className="space-y-4">
                  {/* Trigger Rule */}
                  <div className="rounded-xl border border-[#1f1f23] bg-[#0e0f14] p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8a8a93]">
                        Trigger Rule
                      </span>
                      <span className="font-mono text-[10px] text-[#5dcea0]">
                        Interval: 1m
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[#f4f4f5] leading-relaxed">
                      WETH 1h drop &gt; 2.8% AND 15m DEX volume &gt; 2.5x
                    </p>
                  </div>

                  {/* Action Recipe */}
                  <div className="rounded-xl border border-[#1f1f23] bg-[#0e0f14] p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8a8a93]">
                        Action Recipe
                      </span>
                      <span className="font-mono text-[10px] text-[#60a5fa]">
                        Atomic Swap
                      </span>
                    </div>
                    <p className="font-mono text-xs text-[#f4f4f5] leading-relaxed">
                      Swap USDC &rarr; WETH on Aerodrome CL Pool (Max $10 / tick)
                    </p>
                  </div>

                  {/* Guardrails / Safety Ladder */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-[#1f1f23] bg-[#0e0f14] p-2.5 text-center">
                      <span className="block font-mono text-[9px] uppercase tracking-wider text-[#8a8a93]">
                        Spend Cap
                      </span>
                      <span className="font-mono text-xs font-bold text-[#f4f4f5]">
                        $10.00 / tick
                      </span>
                    </div>
                    <div className="rounded-lg border border-[#1f1f23] bg-[#0e0f14] p-2.5 text-center">
                      <span className="block font-mono text-[9px] uppercase tracking-wider text-[#8a8a93]">
                        Max Slippage
                      </span>
                      <span className="font-mono text-xs font-bold text-[#f4f4f5]">
                        0.50%
                      </span>
                    </div>
                    <div className="rounded-lg border border-[#1f1f23] bg-[#0e0f14] p-2.5 text-center">
                      <span className="block font-mono text-[9px] uppercase tracking-wider text-[#8a8a93]">
                        Gas Ceiling
                      </span>
                      <span className="font-mono text-xs font-bold text-[#f4f4f5]">
                        15 gwei
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Mode-Specific Telemetry Log */}
                <div className="rounded-xl border border-[#1f1f23] bg-[#050608] p-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-[#1f1f23] pb-2.5">
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#8a8a93]">
                        {strategyMode === "paper"
                          ? "Paper Execution Ledger"
                          : "Live Onchain Broadcast"}
                      </span>
                      <span
                        className={`font-mono text-[10px] font-bold ${
                          strategyMode === "paper"
                            ? "text-[#e0b35a]"
                            : "text-[#5dcea0]"
                        }`}
                      >
                        {strategyMode === "paper"
                          ? "14 Virtual Fills"
                          : "3 Settled Blocks"}
                      </span>
                    </div>

                    {/* Telemetry rows */}
                    <div className="space-y-2 font-mono text-xs">
                      {strategyMode === "paper" ? (
                        <>
                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  09:42:15
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Sim Buy 0.00318 WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#8a8a93]">
                                Quote: $3,142.20 · Slippage 0.02%
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$3.40
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  08:15:02
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Sim Buy 0.00315 WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#8a8a93]">
                                Quote: $3,174.50 · Slippage 0.04%
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$5.10
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  06:30:44
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Sim Buy 0.00322 WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#8a8a93]">
                                Quote: $3,105.00 · Slippage 0.01%
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$8.20
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  11:20:04
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Swap $10.00 USDC &rarr; WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#5dcea0]">
                                Tx: 0x8f4c...91a2 · Block #24819031
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$1.24
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  09:14:22
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Swap $10.00 USDC &rarr; WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#5dcea0]">
                                Tx: 0x3d1b...4e78 · Block #24815410
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$1.80
                            </span>
                          </div>

                          <div className="flex items-center justify-between rounded-lg bg-[#0e0f14] p-2.5">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-[#8a8a93] text-[10px]">
                                  04:02:11
                                </span>
                                <span className="font-semibold text-[#f4f4f5]">
                                  Swap $10.00 USDC &rarr; WETH
                                </span>
                              </div>
                              <span className="text-[10px] text-[#5dcea0]">
                                Tx: 0x19ae...6f04 · Block #24809223
                              </span>
                            </div>
                            <span className="text-[#5dcea0] font-semibold text-xs">
                              +$1.08
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bottom Stats Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#1f1f23] pt-3 font-mono text-xs">
                    <span className="text-[#8a8a93]">
                      {strategyMode === "paper"
                        ? "Virtual Paper PnL"
                        : "Realized Onchain PnL"}
                    </span>
                    <span className="text-[#5dcea0] font-bold text-sm">
                      {strategyMode === "paper" ? "+$184.20 (+4.8%)" : "+$4.12 (+13.7%)"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

