// GET /api/news -> { fetchedAt, local:[{title,link,source,time}], world:[...], errors:[] }
// Headlines are cached for 15 minutes.
import { send, checkAuth } from "../lib/http.js";
import { getNews } from "../lib/news.js";

export default async function handler(req, res) {
  if (!checkAuth(req, res)) return;
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" });
  try {
    send(res, 200, await getNews());
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "Couldn't load the news" });
  }
}
