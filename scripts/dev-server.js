// Local test server: serves /public and runs the /api functions the same way Vercel does.
// Run with:  npm install && npm run dev   then open http://localhost:3000
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("public");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".pv": "application/octet-stream", ".mjs": "text/javascript", ".wasm": "application/wasm", ".onnx": "application/octet-stream", ".webmanifest": "application/manifest+json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    const name = url.pathname.slice(5).replace(/[^a-z]/g, "");
    const file = path.resolve("api", name + ".js");
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end("no such api"); }
    try {
      const mod = await import(file + "?t=" + Date.now());
      return await mod.default(req, res);
    } catch (e) {
      console.error(e); res.statusCode = 500; return res.end("error");
    }
  }
  let p = path.join(root, decodeURIComponent(url.pathname));
  if (!p.startsWith(root)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end("not found"); }
  res.setHeader("Content-Type", types[path.extname(p)] || "application/octet-stream");
  fs.createReadStream(p).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("Silly Milly on http://localhost:" + (process.env.PORT || 3000)));
