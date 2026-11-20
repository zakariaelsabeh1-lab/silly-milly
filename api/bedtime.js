// GET  /api/bedtime?days=14[&routine=morning]           -> recent history
// POST /api/bedtime {date,kid,task,done,time,routine?}   -> tick or untick one task
// routine is "bedtime" (default) or "morning".
import { send, readBody, query, checkAuth } from "../lib/http.js";
import { recentDays, setTask } from "../lib/routine.js";

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  try {
    if (req.method === "GET") {
      const n = Math.min(Math.max(parseInt(query(req).days || "14", 10) || 14, 1), 400);
      return send(res, 200, { days: await recentDays(n, query(req).routine) });
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      const r = await setTask(b.date, b.kid, b.task, Boolean(b.done), b.time, b.routine);
      return send(res, r.error ? 400 : 200, r);
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Storage error" });
  }
}
