// Headlines from free RSS feeds, grouped for the News screen.
// To swap a source, edit FEEDS below (any RSS or Atom feed URL works).
import { getKey, setKey } from "./store.js";

export const FEEDS = {
  local: [
    { name: "Prince George Citizen", url: "https://www.princegeorgecitizen.com/rss" },
    { name: "CKPG Today", url: "https://ckpgtoday.ca/feed" },
    { name: "Google News", url: "https://news.google.com/rss/search?q=%22Prince+George%22+BC&hl=en-CA&gl=CA&ceid=CA:en" },
    { name: "CBC British Columbia", url: "https://www.cbc.ca/webfeed/rss/rss-canada-britishcolumbia" },
  ],
  world: [
    { name: "CBC News", url: "https://www.cbc.ca/webfeed/rss/rss-topstories" },
    { name: "CBC Canada", url: "https://www.cbc.ca/webfeed/rss/rss-canada" },
    { name: "CBC World", url: "https://www.cbc.ca/webfeed/rss/rss-world" },
  ],
};

const FRESH_MS = 15 * 60 * 1000;
const PER_GROUP = 15;
let memo = null; // per-instance cache on top of Redis

function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
function tag(block, name) {
  const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i"));
  return m ? m[1] : "";
}

export function parseFeed(xml, feedName) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    let title = decode(tag(b, "title"));
    let link = decode(tag(b, "link"));
    if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); if (m) link = m[1]; }
    const when = decode(tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date"));
    let source = decode(tag(b, "source")) || feedName;
    // Google News puts the outlet at the end of the title: "Headline - Outlet"
    if (feedName === "Google News") {
      const m = title.match(/^(.*) - ([^-]{2,60})$/);
      if (m) { title = m[1]; if (source === feedName) source = m[2]; }
    }
    const t = Date.parse(when);
    if (title && /^https?:\/\//.test(link)) items.push({ title, link, source, time: isNaN(t) ? 0 : t });
  }
  return items;
}

async function fetchFeed(f) {
  try {
    const r = await fetch(f.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FamilyBoard RSS reader)", Accept: "application/rss+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(7000),
    });
    if (!r.ok) return { items: [], error: f.name + ": HTTP " + r.status };
    return { items: parseFeed(await r.text(), f.name) };
  } catch (e) {
    return { items: [], error: f.name + ": " + (e.name === "TimeoutError" ? "timed out" : e.message) };
  }
}

function norm(t) { return t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").slice(0, 70); }

async function buildGroup(feeds) {
  const results = await Promise.all(feeds.map(fetchFeed));
  const seen = new Set(), all = [];
  for (const r of results) for (const it of r.items) {
    const k = norm(it.title);
    if (seen.has(k)) continue;
    seen.add(k); all.push(it);
  }
  all.sort((a, b) => b.time - a.time);
  return { items: all.slice(0, PER_GROUP), errors: results.map((r) => r.error).filter(Boolean) };
}

export async function getNews(force = false) {
  if (!force && memo && Date.now() - memo.fetchedAt < FRESH_MS) return memo;
  if (!force) {
    const cached = await getKey("news", null).catch(() => null);
    if (cached && Date.now() - cached.fetchedAt < FRESH_MS) return (memo = cached);
  }
  const [local, world] = await Promise.all([buildGroup(FEEDS.local), buildGroup(FEEDS.world)]);
  const out = { fetchedAt: Date.now(), local: local.items, world: world.items, errors: local.errors.concat(world.errors) };
  // Keep the last good headlines if every feed in a group failed this time.
  const prev = memo || (await getKey("news", null).catch(() => null));
  if (prev) {
    if (!out.local.length) out.local = prev.local || [];
    if (!out.world.length) out.world = prev.world || [];
  }
  if (!out.local.length && !out.world.length) return out; // nothing worked: don't cache, try again next time
  memo = out;
  await setKey("news", out).catch(() => {});
  return out;
}
