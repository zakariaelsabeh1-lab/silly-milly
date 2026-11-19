// GET  /api/events?start=YYYY-MM-DD&end=YYYY-MM-DD  -> occurrences in range
// POST /api/events  {title,date,start,end,who,repeat,notes}  -> add
// PUT  /api/events?id=...  {...}  -> update
// DELETE /api/events?id=...  -> delete
import { send, readBody, query, checkAuth } from "../lib/http.js";
import { eventsBetween, addEvent, updateEvent, deleteEvent } from "../lib/calendar.js";

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  const q = query(req);
  try {
    if (req.method === "GET") {
      return send(res, 200, { events: await eventsBetween(q.start, q.end) });
    }
    if (req.method === "POST") {
      const r = await addEvent(await readBody(req), "tablet");
      return send(res, r.error ? 400 : 200, r);
    }
    if (req.method === "PUT") {
      const r = await updateEvent(q.id, await readBody(req));
      return send(res, r.error ? 400 : 200, r);
    }
    if (req.method === "DELETE") {
      const r = await deleteEvent(q.id);
      return send(res, r.error ? 404 : 200, r);
    }
    send(res, 405, { error: "Method not allowed" });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Calendar storage error" });
  }
}
