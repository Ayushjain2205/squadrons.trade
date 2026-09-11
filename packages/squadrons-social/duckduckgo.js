/**
 * Free, keyless web search backends for search_x.
 * Primary: DuckDuckGo HTML. Fallback: Bing RSS (mkt=en-US).
 * Optional: SQUADRONS_SEARXNG_URL (self-hosted SearXNG with format=json).
 */

const DDG_HTML = "https://html.duckduckgo.com/html/";
const BING_RSS = "https://www.bing.com/search";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * @typedef {{ url: string, title: string, snippet?: string }} SearchHit
 * @typedef {{ sources: SearchHit[], truncated: boolean, provider: string }} SearchResult
 */

/**
 * @param {string} href
 */
export function decodeDdgHref(href) {
  if (!href) return null;
  try {
    const absolute = href.startsWith("//")
      ? `https:${href}`
      : href.startsWith("http")
        ? href
        : new URL(href, DDG_HTML).href;
    const parsed = new URL(absolute);
    const uddg = parsed.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
    if (
      parsed.hostname.includes("duckduckgo.com") &&
      parsed.pathname.startsWith("/l/")
    ) {
      return null;
    }
    return absolute;
  } catch {
    return null;
  }
}

/**
 * @param {string} html
 */
function decodeEntities(html) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * @param {string} html
 */
export function isDdgChallenge(html) {
  return (
    /anomaly-modal/i.test(html) ||
    /bots use DuckDuckGo too/i.test(html) ||
    /challenge-form/i.test(html)
  );
}

/**
 * @param {string} html
 * @param {number} maxResults
 * @returns {SearchHit[]}
 */
export function parseDdgHtmlResults(html, maxResults) {
  /** @type {SearchHit[]} */
  const out = [];
  const seen = new Set();

  const linkRe =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;
  while ((match = linkRe.exec(html)) !== null && out.length < maxResults) {
    const rawHref = decodeEntities(match[1]);
    const title = decodeEntities(match[2].replace(/<[^>]+>/g, "")).trim();
    const url = decodeDdgHref(rawHref);
    if (!url || !title || seen.has(url)) continue;

    const windowHtml = html.slice(match.index, match.index + 1200);
    const snippetMatch = windowHtml.match(
      /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|span|div)>/i,
    );
    const snippet = snippetMatch
      ? decodeEntities(snippetMatch[1].replace(/<[^>]+>/g, "")).trim()
      : undefined;

    seen.add(url);
    out.push({
      url,
      title,
      ...(snippet ? { snippet } : {}),
    });
  }

  return out;
}

/**
 * @param {string} xml
 * @param {number} maxResults
 * @returns {SearchHit[]}
 */
export function parseBingRssResults(xml, maxResults) {
  /** @type {SearchHit[]} */
  const out = [];
  const seen = new Set();
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRe.exec(xml)) !== null && out.length < maxResults) {
    const block = match[1];
    const titleRaw = (block.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
    const linkRaw = (block.match(/<link>([\s\S]*?)<\/link>/i) || [])[1];
    const descRaw = (block.match(/<description>([\s\S]*?)<\/description>/i) ||
      [])[1];
    if (!linkRaw || !titleRaw) continue;
    const url = decodeEntities(linkRaw.trim());
    const title = decodeEntities(titleRaw.replace(/<[^>]+>/g, "")).trim();
    const snippet = descRaw
      ? decodeEntities(descRaw.replace(/<[^>]+>/g, "")).trim()
      : undefined;
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    out.push({
      url,
      title,
      ...(snippet ? { snippet } : {}),
    });
  }
  return out;
}

/**
 * @param {string} query
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 * @returns {Promise<SearchResult>}
 */
async function searchDuckDuckGoHtml(query, maxResults, signal) {
  const body = new URLSearchParams({
    q: query,
    kl: "us-en",
  });

  const response = await fetch(DDG_HTML, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
    body,
    signal,
    redirect: "follow",
  });

  const html = await response.text();
  if (response.status === 202 || isDdgChallenge(html)) {
    throw new Error("DuckDuckGo rate-limited this IP (bot challenge)");
  }
  if (!response.ok) {
    throw new Error(
      `DuckDuckGo search failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  const sources = parseDdgHtmlResults(html, maxResults);
  return {
    sources,
    truncated: sources.length >= maxResults,
    provider: "duckduckgo_html",
  };
}

/**
 * @param {string} query
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 * @returns {Promise<SearchResult>}
 */
async function searchBingRss(query, maxResults, signal) {
  const url = new URL(BING_RSS);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "rss");
  url.searchParams.set("setlang", "en-us");
  url.searchParams.set("cc", "us");
  url.searchParams.set("mkt", "en-US");

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/rss+xml, application/xml, text/xml, */*",
      "accept-language": "en-US,en;q=0.9",
    },
    signal,
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Bing RSS search failed with HTTP ${response.status} ${response.statusText}`,
    );
  }

  const xml = await response.text();
  const sources = parseBingRssResults(xml, maxResults);
  return {
    sources,
    truncated: sources.length >= maxResults,
    provider: "bing_rss",
  };
}

/**
 * @param {string} query
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 * @returns {Promise<SearchResult>}
 */
async function searchSearxng(query, maxResults, signal) {
  const base = process.env.SQUADRONS_SEARXNG_URL?.trim();
  if (!base) {
    throw new Error("SQUADRONS_SEARXNG_URL is not set");
  }
  const url = new URL("/search", base.endsWith("/") ? base : `${base}/`);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": USER_AGENT,
    },
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `SearXNG search failed with HTTP ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  const results = Array.isArray(data?.results) ? data.results : [];
  /** @type {SearchHit[]} */
  const sources = [];
  const seen = new Set();
  for (const row of results) {
    if (sources.length >= maxResults) break;
    const hitUrl = typeof row.url === "string" ? row.url : "";
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!hitUrl || !title || seen.has(hitUrl)) continue;
    seen.add(hitUrl);
    const snippet =
      typeof row.content === "string" ? row.content.trim() : undefined;
    sources.push({
      url: hitUrl,
      title,
      ...(snippet ? { snippet } : {}),
    });
  }
  return {
    sources,
    truncated: sources.length >= maxResults,
    provider: "searxng",
  };
}

/**
 * Keyless search with DDG → Bing → optional SearXNG fallbacks.
 * @param {string} query
 * @param {number} maxResults
 * @param {AbortSignal} [signal]
 * @returns {Promise<SearchResult>}
 */
export async function freeWebSearch(query, maxResults, signal) {
  /** @type {string[]} */
  const errors = [];

  try {
    const ddg = await searchDuckDuckGoHtml(query, maxResults, signal);
    if (ddg.sources.length > 0) return ddg;
    errors.push("duckduckgo_html returned 0 results");
  } catch (err) {
    errors.push(
      err instanceof Error ? err.message : "duckduckgo_html failed",
    );
  }

  try {
    const bing = await searchBingRss(query, maxResults, signal);
    if (bing.sources.length > 0) return bing;
    errors.push("bing_rss returned 0 results");
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "bing_rss failed");
  }

  if (process.env.SQUADRONS_SEARXNG_URL?.trim()) {
    try {
      const searx = await searchSearxng(query, maxResults, signal);
      if (searx.sources.length > 0) return searx;
      errors.push("searxng returned 0 results");
    } catch (err) {
      errors.push(err instanceof Error ? err.message : "searxng failed");
    }
  }

  throw new Error(
    `Free web search returned no results. Tried: ${errors.join("; ")}`,
  );
}

/** @deprecated Use freeWebSearch */
export async function duckDuckGoSearch(query, maxResults, signal) {
  return freeWebSearch(query, maxResults, signal);
}
