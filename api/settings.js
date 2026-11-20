// Tablet settings that should survive a browser reset.
// GET  /api/settings              -> { wakeMode, wakeSens, voiceName, timeZone, assistantReady }
// GET  /api/settings?templates=1  -> also wakeTemplates (the family's recorded "Hey Silly Milly" samples)
// POST /api/settings {wakeMode?, wakeSens?, voiceName?, timeZone?, wakeTemplates?}
// wakeMode: "" (listen on the tablet, default), "chrome" (Chrome speech, beeps on Android), "off"
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
        wakeSens: s.wakeSens ?? 5,
        voiceName: s.voiceName || "",
        timeZone: s.timeZone || "",
        wakeMode: s.wakeMode || "",
        assistantReady: Boolean(process.env.ANTHROPIC_API_KEY),
      };
      if (query(req).templates) out.wakeTemplates = await getKey("wakeTemplates", []);
      return send(res, 200, out);
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      if (typeof b.wakeSens === "number") s.wakeSens = Math.min(Math.max(Math.round(b.wakeSens), 1), 10);
      if (Array.isArray(b.wakeTemplates)) {
        const ok = b.wakeTemplates.length <= 40 && b.wakeTemplates.every((t) =>
          t && typeof t.who === "string" && t.who.length <= 30 && Array.isArray(t.frames) &&
          t.frames.length >= 3 && t.frames.length <= 30 &&
          t.frames.every((f) => Array.isArray(f) && f.length === 96 && f.every((v) => typeof v === "number" && isFinite(v))));
        if (!ok) return send(res, 400, { error: "Those voice recordings don't look right." });
        await setKey("wakeTemplates", b.wakeTemplates.map((t) => ({ who: t.who, frames: t.frames })));
      }
      if (typeof b.voiceName === "string") s.voiceName = b.voiceName.slice(0, 120);
      if (typeof b.timeZone === "string") {
        const z = b.timeZone.trim();
        if (z === "" || z === "auto" || validZone(z)) s.timeZone = z;
        else return send(res, 400, { error: "Unknown time zone" });
      }
      if (typeof b.wakeMode === "string" && ["", "chrome", "off"].includes(b.wakeMode)) s.wakeMode = b.wakeMode;
      await setKey("settings", s);
      return send(res, 200, { ok: true });
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Storage error" });
  }
}
