import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { chainSearchLastPath } from "./paths.js";

/** Cordis plugin id / package export name. */
export const name = "squadrons-chain-search";
export const inject = ["tools"];

const HIT_KINDS = new Set([
  "subgraph",
  "pool",
  "token",
  "contract",
  "entity",
  "other",
]);

/**
 * First-party GenUI publisher for Chain Search (The Graph).
 * Keep parameter schemas flat — nested object arrays have broken Cordis/dsh startup.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "publish_chain_search",
      description:
        "Publish structured onchain search results as a chat card (kind: squadrons.chain-search). Call AFTER live The Graph queries. Prefer when the user @mentions @search or @graph. hitsJson is a JSON array of {title, kind, subtitle?, chainId?, subgraphId?, metrics?, url?}. Never invent data.",
      parameters: {
        query: {
          type: "string",
          description: "Natural-language query the user asked.",
        },
        title: {
          type: "string",
          description: "Short card title (e.g. Uniswap V3 · Ethereum).",
        },
        summary: {
          type: "string",
          description: "One-line operator summary of the hits.",
        },
        hitsJson: {
          type: "string",
          description:
            'JSON array of hits: [{"title":"...","kind":"subgraph|pool|token|contract|entity|other","subtitle":"...","metrics":["..."],"subgraphId":"...","url":"..."}]',
        },
        notesJson: {
          type: "string",
          description: "Optional JSON string array of caveat strings.",
        },
      },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [
          {
            type: "text",
            text:
              typeof value?.summary === "string"
                ? `${value.summary}\n\n${JSON.stringify(value)}`
                : JSON.stringify(value),
          },
        ],
      },
      timeoutMs: 5_000,
      isConcurrencySafe: () => true,
      async execute(args) {
        const query =
          typeof args.query === "string" && args.query.trim()
            ? args.query.trim()
            : "Onchain search";
        const title =
          typeof args.title === "string" && args.title.trim()
            ? args.title.trim()
            : "Chain Search";
        const summary =
          typeof args.summary === "string" && args.summary.trim()
            ? args.summary.trim()
            : "Results from The Graph";

        let rawHits = [];
        if (typeof args.hitsJson === "string" && args.hitsJson.trim()) {
          try {
            const parsed = JSON.parse(args.hitsJson);
            if (Array.isArray(parsed)) rawHits = parsed;
          } catch {
            throw new Error("hitsJson must be valid JSON array");
          }
        } else if (Array.isArray(args.hits)) {
          rawHits = args.hits;
        }

        const hits = rawHits
          .slice(0, 12)
          .map((row) => {
            if (!row || typeof row !== "object") return null;
            const r = /** @type {Record<string, unknown>} */ (row);
            const hitTitle =
              typeof r.title === "string" ? r.title.trim() : "";
            if (!hitTitle) return null;
            const kindRaw =
              typeof r.kind === "string" ? r.kind.trim().toLowerCase() : "other";
            const kind = HIT_KINDS.has(kindRaw) ? kindRaw : "other";
            const hit = { title: hitTitle, kind };
            if (typeof r.subtitle === "string" && r.subtitle.trim()) {
              hit.subtitle = r.subtitle.trim();
            }
            if (typeof r.chainId === "number" && Number.isFinite(r.chainId)) {
              hit.chainId = r.chainId;
            }
            if (typeof r.subgraphId === "string" && r.subgraphId.trim()) {
              hit.subgraphId = r.subgraphId.trim();
            }
            if (Array.isArray(r.metrics)) {
              hit.metrics = r.metrics
                .filter((m) => typeof m === "string" && m.trim())
                .map((m) => String(m).trim())
                .slice(0, 4);
            }
            if (typeof r.url === "string" && r.url.trim()) {
              hit.url = r.url.trim();
            }
            return hit;
          })
          .filter(Boolean);

        if (hits.length === 0) {
          throw new Error(
            "publish_chain_search requires at least one hit from The Graph",
          );
        }

        let notes;
        if (typeof args.notesJson === "string" && args.notesJson.trim()) {
          try {
            const parsed = JSON.parse(args.notesJson);
            if (Array.isArray(parsed)) {
              notes = parsed
                .filter((n) => typeof n === "string" && n.trim())
                .map((n) => String(n).trim())
                .slice(0, 6);
            }
          } catch {
            // ignore bad notes
          }
        }

        const artifact = {
          kind: "squadrons.chain-search",
          version: 1,
          engine: "the-graph",
          query,
          title,
          summary,
          hits,
          ...(notes && notes.length > 0 ? { notes } : {}),
        };

        const file = chainSearchLastPath();
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, JSON.stringify(artifact), "utf8");
        return artifact;
      },
    }),
  );
}
