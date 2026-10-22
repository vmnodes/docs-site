// server.js: serves the built docs (./dist) for docs.vmnodes.com. No
// dependencies. Every response carries a strict content security policy: the
// site serves only its own files, runs no script, and frames nothing.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000); // VMnodes routes to 3000 and sets no PORT
const DIST = path.join(__dirname, "dist");
const BUILD_COMMIT = process.env.BUILD_COMMIT || null; // set at image build; never guessed
const VERSION = require("./package.json").version;

const TYPES = {
  ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json", ".gz": "application/gzip", ".tgz": "application/gzip",
};
const HEADERS = {
  "content-security-policy": "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

/** The file a URL path names inside DIST, or null. Never anything outside DIST. */
function resolve(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split("?")[0]); } catch { return null; }
  if (p.includes("\0")) return null;
  const candidates = p.endsWith("/") ? [path.join(p, "index.html")] : [p, `${p}.html`, path.join(p, "index.html")];
  for (const c of candidates) {
    const full = path.join(DIST, path.normalize(c));
    if (full !== DIST && !full.startsWith(DIST + path.sep)) return null;
    try { if (fs.statSync(full).isFile()) return full; } catch { /* next */ }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405, { allow: "GET, HEAD", ...HEADERS }); return res.end(); }
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json", ...HEADERS });
    return res.end(JSON.stringify({ status: "ok", app: process.env.VMNODES_APP_NAME || "docs", version: VERSION, buildCommit: BUILD_COMMIT }));
  }
  const file = resolve(req.url);
  if (!file) {
    const notFound = resolve("/404");
    res.writeHead(404, { "content-type": "text/html; charset=utf-8", ...HEADERS });
    return res.end(notFound ? fs.readFileSync(notFound) : "Not found");
  }
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "public, max-age=300", ...HEADERS });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
});

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html is missing: run `node build.mjs` before starting");
  process.exit(1);
}
server.listen({ port: PORT, host: process.env.LISTEN_ADDRESS || undefined }, () => console.log(`docs listening on :${server.address().port}`));
