"use client";

import { useEffect, useId, useRef } from "react";
import type { AgentPluginView } from "@squadrons/shared";
import { PluginBrandIcon } from "./PluginBrandIcon";

export function PluginAtMenu({
  plugins,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose,
}: {
  plugins: readonly AgentPluginView[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (plugin: AgentPluginView) => void;
  onClose: () => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-plugin-index="${activeIndex}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (target && listRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onClose]);

  if (plugins.length === 0) {
    return (
      <div
        className="plugin-at-menu absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-3 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        role="listbox"
        id={listId}
      >
        <p className="type-meta text-[var(--muted)]">
          No enabled plugins. Open Plugins in the right rail to connect one.
        </p>
      </div>
    );
  }

  return (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      aria-label="Plugins"
      className="plugin-at-menu absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-20 max-h-56 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
    >
      {plugins.map((plugin, index) => {
        const active = index === activeIndex;
        return (
          <li key={plugin.id} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={active}
              data-plugin-index={index}
              onMouseEnter={() => onActiveIndexChange(index)}
              onClick={() => onSelect(plugin)}
              className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition ${
                active
                  ? "bg-[var(--panel-2)] text-[var(--ink)]"
                  : "text-[var(--ink-soft)] hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
              }`}
            >
              <PluginBrandIcon
                catalogId={plugin.catalogId}
                name={plugin.name}
                size={22}
              />
              <span className="type-data shrink-0 text-[var(--link)]">
                @{plugin.serverName}
              </span>
              <span className="type-meta min-w-0 truncate text-[var(--muted)]">
                {plugin.description || "MCP plugin"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
