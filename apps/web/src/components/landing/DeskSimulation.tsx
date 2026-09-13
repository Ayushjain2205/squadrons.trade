"use client";

import { AgentOrb } from "@/components/AgentOrb";
import { BrandMark } from "@/components/BrandMark";

export function DeskSimulation() {
  return (
    <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-[#262626] bg-[#000000] shadow-[0_30px_120px_rgba(0,0,0,0.95)] ring-1 ring-white/10 text-left">
      {/* Window Titlebar */}
      <div className="flex h-10 items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
          <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
          <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
        </div>
        <div className="font-mono text-xs text-[#71717a]">
          app.squadrons.trade/desk
        </div>
        <div className="w-12" />
      </div>

      {/* The 3-Column Desk Interface */}
      <div className="grid h-[700px] grid-cols-12 overflow-hidden bg-[#000000] text-[#f4f4f5] font-sans">
        {/* =========================================================================
            LEFT RAIL: Agent List & Desk Nav (Col 1-3, 25%)
            ========================================================================= */}
        <div className="col-span-3 hidden flex-col border-r border-[#1f1f1f] bg-[#000000] p-4 md:flex">
          {/* Brand Mark */}
          <div className="mb-4 px-1">
            <BrandMark
              className="pt-0"
              textClassName="text-[1.45rem] font-medium"
              orbSize={28}
            />
          </div>

          {/* Search Input */}
          <div className="mb-4 flex items-center gap-2 rounded-full border border-[#262626] bg-[#141414] px-3.5 py-2 text-xs text-[#71717a]">
            <span>🔍</span>
            <span className="text-xs">Search</span>
          </div>

          {/* Agent Roster List */}
          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {/* Active Selected Agent: Eth testing agent */}
            <div className="flex items-center gap-3 rounded-xl border border-[#262626] bg-[#1c1c1c] p-2.5 shadow-sm">
              <AgentOrb id="01" colorId="green" size={36} animate={true} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-semibold text-[#f4f4f5]">
                    Eth testing agent
                  </span>
                  <span className="text-[10px] font-mono text-[#71717a]">4h</span>
                </div>
                <p className="truncate text-[11px] text-[#a1a1aa] mt-0.5">
                  Find ETH price
                </p>
              </div>
            </div>

            {/* Inactive Agent 2: Base token scout */}
            <div className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[#141414]">
              <AgentOrb id="08" colorId="orange" size={36} animate={false} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium text-[#a1a1aa]">
                    Base token scout
                  </span>
                  <span className="text-[10px] font-mono text-[#71717a]">1d</span>
                </div>
                <p className="truncate text-[11px] text-[#71717a] mt-0.5">
                  Find new tokens on base
                </p>
              </div>
            </div>

            {/* Inactive Agent 3: Eth scout */}
            <div className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-[#141414]">
              <AgentOrb id="03" colorId="blue" size={36} animate={false} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="truncate text-xs font-medium text-[#a1a1aa]">
                    Eth scout
                  </span>
                  <span className="text-[10px] font-mono text-[#71717a]">2d</span>
                </div>
                <p className="truncate text-[11px] text-[#71717a] mt-0.5">
                  Find opportunities on Ethereum
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Left Nav */}
          <div className="mt-auto space-y-2 border-t border-[#1f1f1f] pt-4 text-xs text-[#a1a1aa]">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 transition hover:bg-[#141414] hover:text-[#f4f4f5]"
            >
              <span className="text-base font-bold">+</span>
              <span className="text-xs font-medium">New agent</span>
            </button>
            <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs text-[#71717a]">
              <span className="text-base">💼</span>
              <div className="flex flex-col text-left">
                <span className="font-mono text-xs text-[#a1a1aa]">0x50b6...7021</span>
                <span className="text-[10px] text-[#71717a]">Wallet</span>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            CENTER COLUMN: Agent Header + Chat & Backtest Graph + Composer (Col 4-9, 50%)
            ========================================================================= */}
        <div className="col-span-12 flex flex-col bg-[#000000] md:col-span-6 lg:col-span-6">
          {/* Agent Header */}
          <div className="flex h-14 items-center gap-3 border-b border-[#1f1f1f] px-5">
            <AgentOrb id="01" colorId="green" size={28} animate={true} />
            <div>
              <div className="text-xs font-bold text-[#f4f4f5]">
                Eth testing agent
              </div>
              <div className="text-[11px] text-[#71717a]">Find ETH price</div>
            </div>
          </div>

          {/* Chat Stream with Graph and Backtest Results */}
          <div className="desk-scroll flex-1 space-y-4 overflow-y-auto p-5 text-xs">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-[#3a3a3a] px-4 py-2.5 text-xs text-[#f4f4f5] leading-relaxed">
                <span className="font-mono font-medium text-[#60a5fa]">@backtest</span>{" "}
                run a 90 day backtest of eth mean reversion
              </div>
            </div>

            {/* Assistant Response Card with Equity Curve Graph */}
            <div className="space-y-3.5 rounded-2xl bg-[#141414] p-4 text-[#f4f4f5] border border-[#262626] shadow-md">
              {/* Card Title & Engine Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-[#f4f4f5]">
                  <span className="text-sm">📊</span>
                  <span>ETH Mean Reversion — 90-Day Backtest</span>
                </div>
                <span className="rounded-full bg-[#1c1c1c] border border-[#262626] px-2 py-0.5 font-mono text-[9px] text-[#71717a]">
                  Tenderly Sim
                </span>
              </div>

              {/* Equity Curve SVG Graph */}
              <div className="relative rounded-xl border border-[#1f1f1f] bg-[#000000]/80 p-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-[#71717a] mb-1">
                  <span>Peak: <strong className="text-[#5dcea0]">$11,323 (+13.2%)</strong></span>
                  <span>End: <strong className="text-[#e07a7a]">$8,741 (-12.6%)</strong></span>
                </div>

                <svg viewBox="0 0 360 100" className="h-28 w-full overflow-visible">
                  <defs>
                    <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e07a7a" stopOpacity="0.3" />
                      <stop offset="60%" stopColor="#5dcea0" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#5dcea0" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Gridlines */}
                  <line x1="0" y1="20" x2="360" y2="20" stroke="#262626" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1="50" x2="360" y2="50" stroke="#262626" strokeDasharray="3 3" strokeWidth="0.8" />
                  <line x1="0" y1="80" x2="360" y2="80" stroke="#262626" strokeDasharray="3 3" strokeWidth="0.8" />

                  {/* Shaded Area under Curve */}
                  <path
                    d="M 0 50 C 30 45, 60 15, 110 12 C 160 10, 190 35, 230 42 C 270 50, 300 85, 360 88 L 360 100 L 0 100 Z"
                    fill="url(#curveGradient)"
                  />

                  {/* The Equity Curve Line */}
                  <path
                    d="M 0 50 C 30 45, 60 15, 110 12 C 160 10, 190 35, 230 42 C 270 50, 300 85, 360 88"
                    fill="none"
                    stroke="#5dcea0"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(93,206,160,0.5)]"
                  />
                  {/* Danger dip section overlay */}
                  <path
                    d="M 230 42 C 270 50, 300 85, 360 88"
                    fill="none"
                    stroke="#e07a7a"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_8px_rgba(224,122,122,0.6)]"
                  />

                  {/* Peak Marker Dot */}
                  <circle cx="110" cy="12" r="3.5" fill="#5dcea0" className="animate-pulse" />
                  {/* Low Marker Dot */}
                  <circle cx="360" cy="88" r="3.5" fill="#e07a7a" />
                </svg>

                {/* Graph Timeline Labels */}
                <div className="flex justify-between font-mono text-[9px] text-[#71717a] mt-1 pt-1 border-t border-[#1f1f1f]">
                  <span>Day 1 ($10K)</span>
                  <span>Day 30 (Jan Peak)</span>
                  <span>Day 60 (Feb Drift)</span>
                  <span>Day 90 ($8.7K)</span>
                </div>
              </div>

              {/* Stats Strip */}
              <div className="grid grid-cols-4 gap-2 font-mono text-[10.5px] border-t border-[#1f1f1f] pt-2.5">
                <div className="rounded-lg bg-[#000000]/60 p-2 border border-[#1f1f1f]">
                  <div className="text-[9px] text-[#71717a]">Return</div>
                  <div className="font-bold text-[#e07a7a]">-12.58%</div>
                </div>
                <div className="rounded-lg bg-[#000000]/60 p-2 border border-[#1f1f1f]">
                  <div className="text-[9px] text-[#71717a]">Win Rate</div>
                  <div className="font-bold text-[#5dcea0]">81.08%</div>
                </div>
                <div className="rounded-lg bg-[#000000]/60 p-2 border border-[#1f1f1f]">
                  <div className="text-[9px] text-[#71717a]">Max DD</div>
                  <div className="font-bold text-[#f4f4f5]">25.31%</div>
                </div>
                <div className="rounded-lg bg-[#000000]/60 p-2 border border-[#1f1f1f]">
                  <div className="text-[9px] text-[#71717a]">Sharpe</div>
                  <div className="font-bold text-[#f4f4f5]">-1.65</div>
                </div>
              </div>

              {/* Takeaway Box */}
              <div className="rounded-xl bg-[#1c1c1c] p-3 text-[11px] text-[#a1a1aa] border border-[#262626] leading-relaxed">
                <div className="font-semibold text-[#f4f4f5] mb-1">📌 Takeaway</div>
                30 of 37 trades won (+81% win rate), but deep drawdowns destroyed gains. Your <strong className="text-[#f4f4f5]">existing draft</strong> (hourly alert if ETH &lt; $2,400) is the smarter play. Want me to <strong className="text-[#5dcea0]">arm that alert</strong>?
              </div>
            </div>

            {/* Follow-up User Message */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-[#3a3a3a] px-4 py-2.5 text-xs text-[#f4f4f5]">
                <span className="font-mono font-medium text-[#60a5fa]">@search</span>{" "}
                Uniswap V3 pools on Ethereum
              </div>
            </div>
          </div>

          {/* Pill Composer */}
          <div className="border-t border-[#1f1f1f] p-4">
            <div className="flex items-center justify-between rounded-full border border-[#262626] bg-[#141414] px-5 py-2.5 text-xs">
              <div className="flex items-center gap-2.5 text-[#71717a]">
                <span className="text-base font-bold">+</span>
                <span className="text-xs">
                  Message Eth testing agent... · <span className="text-[#a1a1aa]">@ plugins</span> · <span className="text-[#a1a1aa]">/ skills</span>
                </span>
              </div>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3a3a3a] text-xs text-[#f4f4f5]"
              >
                ▲
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT RAIL: Desk Identity, Strategy Armed Box & Activity (Col 10-12, 25%)
            ========================================================================= */}
        <div className="col-span-3 hidden flex-col border-l border-[#1f1f1f] bg-[#000000] p-4 lg:flex">
          {/* Top Header with Action icons */}
          <div className="flex items-center justify-between border-b border-[#1f1f1f] pb-3.5">
            <span className="font-bold text-xs text-[#f4f4f5]">Desk</span>
            <div className="flex items-center gap-2.5 text-xs text-[#71717a]">
              <span className="cursor-pointer hover:text-[#f4f4f5]">🧩</span>
              <span className="cursor-pointer hover:text-[#f4f4f5]">⚙️</span>
              <span className="cursor-pointer hover:text-[#f4f4f5]">»</span>
            </div>
          </div>

          {/* Chain Logo + Run Mode Switcher */}
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#627eea]/20 text-[#627eea] font-mono text-xs font-bold">
              Ξ
            </div>
            {/* Pill Toggle */}
            <div className="flex items-center rounded-full bg-[#141414] p-0.5 text-[11px] border border-[#262626]">
              <span className="rounded-full bg-[#f4f4f5] px-3 py-1 font-bold text-[#000000]">
                Observe
              </span>
              <span className="px-2.5 py-1 text-[#71717a] cursor-pointer hover:text-[#f4f4f5]">Paper</span>
              <span className="px-2.5 py-1 text-[#71717a] cursor-pointer hover:text-[#f4f4f5]">Live</span>
            </div>
          </div>

          {/* Strategy Box */}
          <div className="mt-5 space-y-2.5 border-b border-[#1f1f1f] pb-5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#f4f4f5]">Strategy</span>
              <span className="text-[10px] text-[#71717a]">Draft</span>
            </div>

            <p className="text-xs font-medium text-[#f4f4f5]">
              Alert when ETH crosses below US$2,400
            </p>

            <div className="text-[10px] text-[#71717a]">
              Checks every hour · Last check 1d ago
            </div>

            {/* Arm Button */}
            <button
              type="button"
              className="w-full rounded-full bg-[#f4f4f5] py-2.5 text-xs font-bold text-[#000000] shadow-md transition hover:opacity-90 active:scale-98"
            >
              Arm
            </button>

            <div className="flex items-center justify-between pt-1 text-[11px] text-[#71717a]">
              <div className="flex gap-2">
                <span className="hover:text-[#f4f4f5] cursor-pointer">Templates</span>
                <span>·</span>
                <span className="hover:text-[#f4f4f5] cursor-pointer">Remove</span>
              </div>
              <span className="hover:text-[#f4f4f5] cursor-pointer">Details</span>
            </div>
          </div>

          {/* Strategy Activity */}
          <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-[#f4f4f5]">Strategy activity</span>
              <span className="text-[10px] text-[#71717a]">checked 28h</span>
            </div>

            <div className="space-y-3 text-[11px]">
              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#71717a]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[#a1a1aa]">
                    <span className="font-medium text-[#f4f4f5]">Saved strategy draft</span>
                    <span className="text-[10px] text-[#71717a]">5h</span>
                  </div>
                  <p className="truncate text-[10px] text-[#71717a] mt-0.5">
                    Alert when ETH crosses below $2,400
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#71717a]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[#a1a1aa]">
                    <span className="font-medium text-[#f4f4f5]">Disarmed strategy</span>
                    <span className="text-[10px] text-[#71717a]">28h</span>
                  </div>
                  <p className="truncate text-[10px] text-[#71717a] mt-0.5">
                    Alert when ETH crosses below $2,8...
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#71717a]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[#a1a1aa]">
                    <span className="font-medium text-[#f4f4f5]">Armed strategy</span>
                    <span className="text-[10px] text-[#71717a]">28h</span>
                  </div>
                  <p className="truncate text-[10px] text-[#71717a] mt-0.5">
                    Alert when ETH crosses below $2,8...
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#71717a]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[#a1a1aa]">
                    <span className="font-medium text-[#f4f4f5]">Imported template</span>
                    <span className="text-[10px] text-[#71717a]">28h</span>
                  </div>
                  <p className="truncate text-[10px] text-[#71717a] mt-0.5">
                    ETH dip watch
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-2 text-xs text-[#71717a] hover:text-[#f4f4f5] cursor-pointer">
              Show more
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
