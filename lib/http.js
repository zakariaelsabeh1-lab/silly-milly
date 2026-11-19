// Small helpers shared by the API routes.
import { storageReady } from "./store.js";

export const TZ = process.env.FAMILY_TIMEZONE || "America/Vancouver";

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "string") {
      try { return JSON.parse(req.body || "{}"); } catch { return {}; }
    }
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString("utf8") || "{}"); } catch { return {}; }
    }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

export function query(req) {
  return Object.fromEntries(new URL(req.url, "http://x").searchParams);
}

// Every API call must carry the family PIN (set as FAMILY_PIN on Vercel).
// Returns true if the request may continue.
export function checkAuth(req, res) {
  if (!storageReady()) {
    send(res, 500, { error: "Storage isn't connected yet. Add the Upstash Redis store in Vercel (see SETUP.md)." });
    return false;
  }
  const pin = process.env.FAMILY_PIN;
  if (!pin) {
    if (process.env.VERCEL) {
      send(res, 500, { error: "Add a FAMILY_PIN environment variable in Vercel (see SETUP.md)." });
      return false;
    }
    return true; // local testing without a PIN
  }
  const given = req.headers["x-family-pin"] || "";
  if (given !== pin) {
    send(res, 401, { error: "PIN needed" });
    return false;
  }
  return true;
}

// Current date/time in the family's time zone.
export function nowLocal(tz = TZ) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", weekday: "long", hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
    weekday: parts.weekday,
  };
}
