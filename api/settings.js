// Tablet settings that should survive a browser reset (wake word key + file).
// GET  /api/settings          -> { picovoiceKey, hasWakeWord, sensitivity, voiceName }
// GET  /api/settings?wake=1   -> also includes wakeWordBase64
// POST /api/settings {picovoiceKey?, wakeWordBase64?, sensitivity?, voiceName?, timeZone?, wakeMode?}
// wakeMode: "" (automatic: Picovoice if set up, otherwise Chrome's built-in listening), "chrome", "picovoice", "off"
import { send, readBody, query, checkAuth } from "../lib/http.js";
import { getKey, setKey } from "../lib/store.js";

function validZone(z) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return true; } catch { return false; }
}

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  try {
    const s = await getKey("settings", {});
    if (req.method === "GET") {
      const out = {
        picovoiceKey: s.picovoiceKey || "",
        hasWakeWord: Boolean(s.wakeWordBase64),
        sensitivity: s.sensitivity ?? 0.6,
        voiceName: s.voiceName || "",
        timeZone: s.timeZone || "",
        wakeMode: s.wakeMode || "",
        assistantReady: Boolean(process.env.ANTHROPIC_API_KEY),
      };
      if (query(req).wake) out.wakeWordBase64 = s.wakeWordBase64 || "";
      return send(res, 200, out);
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      if (typeof b.picovoiceKey === "string") s.picovoiceKey = b.picovoiceKey.trim().slice(0, 200);
      if (typeof b.wakeWordBase64 === "string") {
        if (b.wakeWordBase64.length > 200000) return send(res, 400, { error: "That file is too big for a wake word file." });
        s.wakeWordBase64 = b.wakeWordBase64;
      }
      if (typeof b.sensitivity === "number") s.sensitivity = Math.min(Math.max(b.sensitivity, 0.1), 0.95);
      if (typeof b.voiceName === "string") s.voiceName = b.voiceName.slice(0, 120);
      if (typeof b.timeZone === "string") {
        const z = b.timeZone.trim();
        if (z === "" || z === "auto" || validZone(z)) s.timeZone = z;
        else return send(res, 400, { error: "Unknown time zone" });
      }
      if (typeof b.wakeMode === "string" && ["", "chrome", "picovoice", "off"].includes(b.wakeMode)) s.wakeMode = b.wakeMode;
      await setKey("settings", s);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Storage error" });
  }
}
