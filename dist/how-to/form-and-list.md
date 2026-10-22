# Build a form-and-list app

Build an app where signed-in staff fill in a form and see every entry in a list, and only people you choose can use it. Read this when a customer asks for a sign-in book, a log, or any "add a row, see the rows" tool. The example is a visitor book for the org `acme`: reception signs visitors in and out, and the entries are kept in the app's database.

You start from the starter, so do [Getting started](../getting-started.md) steps 1 to 3 first. You then have a folder with `package.json`, `vmnodes.json`, `Dockerfile`, `server.js`, `store.js`, `publish.js` and `manifest.json`, and your own git repository.

## 1. Remove what this app does not use

This app shares nothing with other apps and does not use the advanced path, so delete both files that belong to them.

```bash
rm publish.js manifest.json
ls
```

It worked when `ls` lists `Dockerfile`, `package.json`, `server.js`, `store.js` and `vmnodes.json`, and does not list `publish.js` or `manifest.json`. Leaving `manifest.json` behind makes the launch page say your app mentions roles it does not declare, because it still names the starter's role.

## 2. Declare one role and a database

Replace `vmnodes.json` with this. The role is what reception needs to be given, and `"database": true` makes VMnodes create the app's database and pass its address in `DATABASE_URL`.

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    {
      "name": "visitors.staff",
      "description": "Can sign visitors in and out, and see who is on the visitor list."
    }
  ],
  "database": true
}
```

It worked when this prints `apiVersion roles database`:

```bash
node -e 'console.log(Object.keys(require("./vmnodes.json")).join(" "))'
```

The role name must be the same string in `vmnodes.json`, in `server.js` and in `dev/mock-portal.js`. [Roles](../concepts/roles.md) explains the format.

## 3. Replace `store.js`

`store.js` keeps the visits. One decision, made from `DATABASE_URL`, picks the database or memory, and the app refuses to start when the database is set but unreachable, instead of quietly keeping visits where the next restart loses them.

```js
// store.js: where the visits are kept.
//
// ONE decision, made here from DATABASE_URL:
//   DATABASE_URL set   visits are kept in Postgres, across restarts and updates.
//   not set            visits are kept in memory and cleared on every restart.
//
// On the platform, DATABASE_URL is set for you when vmnodes.json says
// "database": true. Locally it is not set, so `npm run dev` uses memory.
//
// There is no fallback. If DATABASE_URL is set but the database cannot be
// reached, the app refuses to start rather than quietly keeping visits in
// memory, where they would be lost at the next restart.

function memoryStore() {
  const visits = [];
  return {
    kind: "memory",
    async init() {},
    async list(limit = 100) { return visits.slice(0, limit).map((v) => ({ ...v })); },
    async add(visit) { visits.unshift({ ...visit, leftAt: null }); },
    // Returns the updated visit, or null when no visit with that id is still on site.
    async markLeft(id, leftAt) {
      const v = visits.find((x) => x.id === id && x.leftAt === null);
      if (!v) return null;
      v.leftAt = leftAt;
      return { ...v };
    },
    async close() {},
  };
}

function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
  const postgres = require("postgres");
  const sql = postgres(url, { max: 3, onnotice: () => {} });
  const toVisit = (r) => ({
    id: r.id, visitor: r.visitor, company: r.company, visiting: r.visiting,
    arrivedAt: r.arrived_at.toISOString(), leftAt: r.left_at ? r.left_at.toISOString() : null,
  });
  return {
    kind: "postgres",
    async init() {
      for (let i = 1; ; i++) {
        try {
          await sql`create table if not exists visits (
            seq bigserial primary key,
            id uuid not null unique,
            visitor text not null,
            company text not null default '',
            visiting text not null,
            arrived_at timestamptz not null,
            left_at timestamptz
          )`;
          return;
        } catch (err) {
          if (i >= attempts) throw new Error(`could not reach the database after ${attempts} tries: ${err.message}`);
          log.log(`database not reachable yet (try ${i} of ${attempts}): ${err.message}`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    },
    async list(limit = 100) {
      const rows = await sql`select id, visitor, company, visiting, arrived_at, left_at from visits order by seq desc limit ${limit}`;
      return rows.map(toVisit);
    },
    async add(v) {
      await sql`insert into visits (id, visitor, company, visiting, arrived_at)
                values (${v.id}, ${v.visitor}, ${v.company}, ${v.visiting}, ${v.arrivedAt})`;
    },
    async markLeft(id, leftAt) {
      const rows = await sql`update visits set left_at = ${leftAt} where id = ${id} and left_at is null
                             returning id, visitor, company, visiting, arrived_at, left_at`;
      return rows[0] ? toVisit(rows[0]) : null;
    },
    async close() { await sql.end({ timeout: 5 }); },
  };
}

function openStore({ env = process.env, log = console } = {}) {
  return env.DATABASE_URL ? postgresStore(env.DATABASE_URL, { log }) : memoryStore();
}

module.exports = { openStore };
```

## 4. Replace `server.js`

`server.js` is the whole app: the page with its form and list, the routes, and the checks that decide who may do what.

```js
// server.js: the whole app. A visitor book: people with the "staff" role sign
// visitors in when they arrive, see who has been in, and sign them out when they leave.
//
// APP_NAME is the name the app was put online as: the platform sets VMNODES_APP_NAME.
const http = require("node:http");
const crypto = require("node:crypto");
// Sign-in checking comes from the platform's own package, @vmnodes/identity.
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");
const { openStore } = require("./store");

const APP_NAME = process.env.VMNODES_APP_NAME || "visitor-book";
// Must match the role name in vmnodes.json exactly ("visitors.staff").
const ROLE_PREFIX = "visitors";
const STAFF_ROLE = `${ROLE_PREFIX}.staff`;
const VERSION = require("./package.json").version;
// Set when the image is built (see Dockerfile). Reported as-is, never guessed.
const BUILD_COMMIT = process.env.BUILD_COMMIT || null;
// The platform does NOT set PORT: a portal launch sends traffic to port 3000, fixed.
// (PORT is only for local tests.)
const PORT = Number(process.env.PORT || 3000);
// Unset, the app listens on every address, which a container needs.
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS || undefined;

// Refuses to START if sign-in is not configured, so a misconfigured app never runs unprotected.
let identity;
try {
  identity = new VmnodesIdentity();
} catch (err) {
  console.error(`${err.message}\nThe platform sets these when your app is deployed; locally, \`npm run dev\` sets them for you.`);
  process.exit(1);
}
const store = openStore();

const KEPT = {
  postgres: "Visits are kept in this app's database, across restarts and updates.",
  memory: "Visits are kept in memory, so they are cleared when the app restarts or is updated.",
};
const LIMITS = { visitor: 100, company: 100, visiting: 100 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every piece of text a person typed goes through esc() before it goes into a page.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "content-type": type });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new IdentityError("body too large", 413)); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Reads the three fields from a form post or a JSON post. Trims, and never trusts the types.
async function readVisitFields(req) {
  const raw = await readBody(req);
  const get = (req.headers["content-type"] || "").includes("application/json")
    ? ((o) => (k) => (typeof o[k] === "string" ? o[k] : ""))(JSON.parse(raw || "{}"))
    : ((p) => (k) => p.get(k) || "")(new URLSearchParams(raw));
  return { visitor: get("visitor").trim(), company: get("company").trim(), visiting: get("visiting").trim() };
}

// The server-side checks. The form's `required` and `maxlength` are a courtesy to
// people; this is what actually decides, because anyone can send a request without the form.
function problemWith(f) {
  if (!f.visitor) return "visitor is required";
  if (!f.visiting) return "visiting is required";
  for (const k of Object.keys(LIMITS)) if (f[k].length > LIMITS[k]) return `${k} must be at most ${LIMITS[k]} characters`;
  return null;
}

const when = (iso) => iso.slice(0, 16).replace("T", " ");

function shell(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:760px;margin:0 auto;padding:16px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #2a2c35;padding:8px 6px}small,th{color:#9a9cab;font-weight:normal}label{display:block;margin-top:8px}input{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin-top:8px;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head>
<body>${inner}</body></html>`;
}

function page(user, visits, { error = "", values = {} } = {}) {
  const rows = visits.length
    ? visits.map((v) => `<tr><td>${esc(v.visitor)}${v.company ? `<br><small>${esc(v.company)}</small>` : ""}</td><td>${esc(v.visiting)}</td><td>${esc(when(v.arrivedAt))}</td>
<td>${v.leftAt ? esc(when(v.leftAt)) : `<form method="post" action="/visits/${esc(v.id)}/leave"><button type="submit">Sign out</button></form>`}</td></tr>`).join("")
    : `<tr><td colspan="4">Nobody has signed in yet.</td></tr>`;
  const val = (k) => esc(values[k] || "");
  return shell("Visitor book", `<h1>Visitor book</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong></p>
<form method="post" action="/visits">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<label for="visitor">Visitor's name</label><input id="visitor" name="visitor" required maxlength="${LIMITS.visitor}" value="${val("visitor")}">
<label for="company">Company (optional)</label><input id="company" name="company" maxlength="${LIMITS.company}" value="${val("company")}">
<label for="visiting">Who are they here to see?</label><input id="visiting" name="visiting" required maxlength="${LIMITS.visiting}" value="${val("visiting")}">
<button type="submit">Sign in visitor</button></form>
<h2>Visitors</h2><table><thead><tr><th>Visitor</th><th>Visiting</th><th>Arrived</th><th>Left</th></tr></thead><tbody id="visits">${rows}</tbody></table>
<p id="kept"><small>${esc(KEPT[store.kind])}</small></p>`);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://app");
  const isApi = url.pathname.startsWith("/api/");

  // Health is checked by the platform directly, with no signed-in person, so
  // it must NOT require sign-in. It must also be honest: say what is running.
  if (url.pathname === "/health") {
    return send(res, 200, { status: "ok", app: APP_NAME, version: VERSION, buildCommit: BUILD_COMMIT, storage: store.kind });
  }

  // Everything else: who is this? (Throws 401/503 if we cannot tell.)
  const user = await identity.currentUser(req.headers);
  // Every route below is for staff. Checked on the SERVER, on every request.
  identity.requireRole(user, STAFF_ROLE);

  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await store.list()), "text/html; charset=utf-8");
  if (url.pathname === "/api/visits" && req.method === "GET") return send(res, 200, { items: await store.list() });

  if ((url.pathname === "/visits" || url.pathname === "/api/visits") && req.method === "POST") {
    const fields = await readVisitFields(req);
    const problem = problemWith(fields);
    if (problem) {
      if (isApi) return send(res, 400, { error: problem });
      return send(res, 400, page(user, await store.list(), { error: problem, values: fields }), "text/html; charset=utf-8");
    }
    const visit = { id: crypto.randomUUID(), ...fields, arrivedAt: new Date().toISOString() };
    await store.add(visit);
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 201, { ...visit, leftAt: null });
  }

  const leave = url.pathname.match(/^\/(?:api\/)?visits\/([^/]+)\/leave$/);
  if (leave && req.method === "POST") {
    // An id that is not a UUID can never match a row; say so here instead of letting the database throw.
    const visit = UUID.test(leave[1]) ? await store.markLeft(leave[1].toLowerCase(), new Date().toISOString()) : null;
    if (!visit) return send(res, 404, { error: "no such visitor on site" });
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 200, visit);
  }

  return send(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof IdentityError ? err.status : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) console.error(err.cause || err);
    const message = status === 500 ? "something went wrong" : err.message;
    if (new URL(req.url, "http://app").pathname.startsWith("/api/")) return send(res, status, { error: message });
    send(res, status, shell("Visitor book", `<h1>Visitor book</h1><p>${esc(message)}</p>${status === 403 ? `<p>This app is for people with the <code>${esc(STAFF_ROLE)}</code> role. Ask whoever runs it to give it to you.</p>` : ""}`), "text/html; charset=utf-8");
  });
});
store.init().then(
  () => server.listen({ port: PORT, host: LISTEN_ADDRESS }, () => console.log(`${APP_NAME} ${VERSION} listening on :${server.address().port} (visits kept in ${store.kind})`)),
  (err) => {
    // No fallback to memory: visits kept there would be lost at the next restart.
    console.error(`${err.message}\nDATABASE_URL is set, so this app will not start without its database.`);
    process.exit(1);
  },
);
```

It worked when both files parse. This prints nothing and exits 0:

```bash
node --check server.js && node --check store.js
```

## 5. Match the files to the new roles and the new file list

Two small edits to files the starter already has. First, the pretend portal that `npm run dev` uses signs you in as `editor` with the starter's role. Give it yours:

```diff
--- a/dev/mock-portal.js
+++ b/dev/mock-portal.js
@@ -18,7 +18,7 @@
 // the role strings must be exactly what your server passes to requireRole.
 const USERS = {
   reader: { sub: "usr_local_reader", email: "reader@example.test", name: "Riley Reader", kind: "employee", groups: [], roles: [] },
-  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["starter.editor"] },
+  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["visitors.staff"] },
 };
 
 async function startMockPortal({ port, appUrl, appId, as = "editor" }) {
```

Second, the `Dockerfile` copies the app's files into the image by name. `publish.js` is gone, so take it out of the list:

```diff
--- a/Dockerfile
+++ b/Dockerfile
@@ -32,7 +32,7 @@
 ENV BUILD_COMMIT=$BUILD_COMMIT
 
 # Copy the app itself. Only what runs goes in: no tests, no dev tools.
-COPY server.js publish.js store.js ./
+COPY server.js store.js ./
 
 # A portal launch (no manifest.json) deploys to port 3000, fixed. If you use the
 # Advanced path instead, this must match runtime.port in manifest.json.
```

It worked when `grep -c 'COPY server.js store.js' Dockerfile` prints `1` and `grep -c 'visitors.staff' dev/mock-portal.js` prints `1`.

## 6. Replace the test

The starter's `npm test` checks the noticeboard, so it fails once `server.js` changes. Replace `test/smoke.js` with this. Every refused case has an accepted case beside it, so a check that can only ever refuse cannot pass by accident, and the run ends with a count.

```js
// test/smoke.js: `npm test`. Proves the visitor book refuses what it should and
// accepts what it should. Every "refused" row has a matching "accepted" row, so a
// check that can only ever refuse cannot pass by accident.
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { SignJWT } = require("jose");
const { startMockPortal } = require("../dev/mock-portal");

const APP_ID = "app_smoke_test";
const SERVER = path.join(__dirname, "..", "server.js");
const children = [];
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}

function startApp(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, PORT: "0", LISTEN_ADDRESS: "127.0.0.1", ...env }, stdio: ["ignore", "pipe", "pipe"] });
    children.push(child);
    let out = "";
    const onData = (d) => {
      out += d;
      const m = out.match(/listening on :(\d+)/);
      if (m) resolve({ child, url: `http://127.0.0.1:${m[1]}`, out: () => out });
    };
    child.stdout.on("data", onData); child.stderr.on("data", onData);
    child.on("exit", (code) => resolve({ child, exited: code, out: () => out }));
  });
}

function request(url, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, (res) => {
      let data = ""; res.on("data", (d) => (data += d));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data, json: () => JSON.parse(data) }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  // --- 1. It refuses to start without sign-in configured -------------------
  const noAppId = await startApp({ VMNODES_PORTAL_URL: "http://127.0.0.1:1" });
  check("refuses to START without VMNODES_APP_ID", noAppId.exited !== undefined && noAppId.exited !== 0, true);

  const portal = await startMockPortal({ port: 0, appId: APP_ID });
  const app = await startApp({ VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID });
  check("CONTROL: starts when both settings are present", typeof app.url, "string");
  if (!app.url) { console.log(app.out()); process.exit(1); }
  portal.setTarget(app.url);

  const mint = (claims, { aud = APP_ID } = {}) =>
    new SignJWT({ email: "e@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: [], ...claims })
      .setProtectedHeader({ alg: "RS256", kid: "local-dev" }).setSubject("usr_1").setIssuer(portal.issuer).setAudience(aud)
      .setIssuedAt().setExpirationTime("5m").sign(portal.privateKey);
  const as = async (claims, opts) => ({ "x-vmnodes-identity": await mint(claims, opts) });
  const staff = () => as({ roles: ["visitors.staff"] });
  const nobody = () => as({ name: "Riley Reader", roles: [] });
  const json = (headers, method, p, body) => request(`${app.url}${p}`, { method, headers: { ...headers, "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

  // --- 2. Health and sign-in -------------------------------------------------
  const h = await request(`${app.url}/health`);
  check("health answers 200 WITHOUT sign-in", h.status, 200);
  check("health says visits are kept in memory when DATABASE_URL is not set", h.json().storage, "memory");
  check("CONTROL: a staff token is accepted", (await json(await staff(), "GET", "/api/visits")).status, 200);
  check("no identity header -> 401", (await request(`${app.url}/api/visits`)).status, 401);
  check("token meant for ANOTHER app -> 401", (await json(await as({ roles: ["visitors.staff"] }, { aud: "app_someone_else" }), "GET", "/api/visits")).status, 401);

  // --- 3. The role is checked on the server, for every route -----------------
  check("signed in without the role: list -> 403", (await json(await nobody(), "GET", "/api/visits")).status, 403);
  check("signed in without the role: sign in a visitor -> 403", (await json(await nobody(), "POST", "/api/visits", { visitor: "A", visiting: "B" })).status, 403);
  check("signed in without the role: sign out -> 403", (await json(await nobody(), "POST", "/api/visits/6f1c2a52-8f0d-4d64-9d0e-1c7b0e2a9b11/leave")).status, 403);

  // --- 4. Adding and listing -------------------------------------------------
  const made = await json(await staff(), "POST", "/api/visits", { visitor: "Ada <b>Lovelace</b>", company: "Analytical Ltd", visiting: "Grace" });
  check("CONTROL: a valid visit is accepted -> 201", made.status, 201);
  const list = (await json(await staff(), "GET", "/api/visits")).json().items;
  check("the visit is in the list, with no left time", [list.length, list[0].visitor, list[0].leftAt], [1, "Ada <b>Lovelace</b>", null]);
  for (const [name, body] of [["no visitor", { visiting: "Grace" }], ["blank visitor", { visitor: "   ", visiting: "Grace" }], ["no visiting", { visitor: "Ada" }], ["a number for visitor", { visitor: 5, visiting: "Grace" }], ["a 101-character visitor", { visitor: "x".repeat(101), visiting: "Grace" }]]) {
    check(`${name} -> 400`, (await json(await staff(), "POST", "/api/visits", body)).status, 400);
  }
  const broken = await request(`${app.url}/api/visits`, { method: "POST", headers: { ...(await staff()), "content-type": "application/json" }, body: "{nope" });
  check("a body that is not JSON -> 400", broken.status, 400);
  check("nothing was added by the refused posts", (await json(await staff(), "GET", "/api/visits")).json().items.length, 1);

  // --- 5. Text is escaped when it goes into the page -------------------------
  portal.setUser("editor");
  const pageHtml = (await request(`${portal.issuer}/`)).body;
  check("typed text is escaped, not run as markup", pageHtml.includes("Ada &lt;b&gt;Lovelace&lt;/b&gt;") && !pageHtml.includes("<b>Lovelace"), true);
  portal.setUser("reader");
  check("a person without the role gets a 403 page, not the list", [(await request(`${portal.issuer}/`)).status, (await request(`${portal.issuer}/`)).body.includes("Lovelace")], [403, false]);
  portal.setUser("editor");

  // --- 6. Signing out --------------------------------------------------------
  const id = made.json().id;
  const out = await json(await staff(), "POST", `/api/visits/${id}/leave`);
  check("CONTROL: signing out a visitor on site -> 200, with a left time", [out.status, typeof out.json().leftAt], [200, "string"]);
  check("signing out the same visitor again -> 404", (await json(await staff(), "POST", `/api/visits/${id}/leave`)).status, 404);
  check("a made-up id -> 404", (await json(await staff(), "POST", "/api/visits/6f1c2a52-8f0d-4d64-9d0e-1c7b0e2a9b11/leave")).status, 404);
  check("an id that is not a UUID -> 404, not a database error", (await json(await staff(), "POST", "/api/visits/not-an-id/leave")).status, 404);

  // --- 7. A database that cannot be reached stops the app; it never falls back --
  const noDb = await startApp({ VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID, DATABASE_URL: "postgres://visitors@127.0.0.1:1/visitors" });
  check("with DATABASE_URL set and no database, the app refuses to START", noDb.exited !== undefined && noDb.exited !== 0, true);
  check("...and says it will not start without its database", /will not start without its database/.test(noDb.out()), true);

  // --- 8. The count itself: zero checks run must never read as a pass ---------
  const FLOOR = 25;
  if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
  console.log(`\npassed=${pass} failed=${fail}`);
  finish(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("smoke test crashed:", e); finish(1); });

function finish(code) {
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exit(code);
}
```

```bash
npm test
```

It worked when the last line is `passed=27 failed=0`. A run that ends without a `passed=` line is broken plumbing, not a broken app: read the first line that starts `FAIL` or the error above it.

## 7. Try it on your computer

```bash
npm run dev
```

It prints `Open http://127.0.0.1:4100 in your browser.` Open that address.

It worked when the page is headed **Visitor book**, reads "Signed in as Eden Editor", shows a form with **Visitor's name**, **Company (optional)** and **Who are they here to see?**, and a **Sign in visitor** button, and the table says "Nobody has signed in yet." Fill the form in and press **Sign in visitor**: the visitor appears in the table with a **Sign out** button, and pressing it fills the **Left** column. The last line reads "Visits are kept in memory, so they are cleared when the app restarts or is updated." because `npm run dev` sets no database.

Now see what a person without the role sees. Open `http://127.0.0.1:4100/_as/reader`. It worked when the page reads "role 'visitors.staff' required" and "This app is for people with the `visitors.staff` role. Ask whoever runs it to give it to you." Open `http://127.0.0.1:4100/_as/editor` to sign back in. Stop the command with Ctrl+C.

## 8. Put it online

Commit and push, then launch as `visitor-book`, following [Getting started](../getting-started.md) steps 3 to 6.

```bash
git add -A
git commit -m "Visitor book"
git push
```

It worked when the launch page badge reads **Working**, a line reads "You have every role visitor-book declares: visitors.staff.", and **Open visitor-book** opens `https://visitor-book.acme.vmnodes.com` with the heading **Visitor book** and the last line "Visits are kept in this app's database, across restarts and updates."

## 9. Give reception the role

Opening the app needs the role, and only you hold it. On the app's **People** tab press **Change roles** on each person who should use it, tick `visitors.staff` and press **Save roles**. It worked when their row lists `visitors.staff`. The person must already be a member of the org: there is no portal screen for adding one, so ask your VMnodes contact. See [Limits](../reference/limits.md).

## Check it works

Run these in order. Items 2 to 5 need `npm run dev` running in another terminal, started as the default user `editor`.

1. `npm test` ends `passed=27 failed=0`.
2. Adding through the form answers `303`, and the entry is in the list:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -d 'visitor=Ada&company=Analytical&visiting=Grace' http://127.0.0.1:4100/visits
   curl -s http://127.0.0.1:4100/api/visits
   ```

   The first prints `303`. The second prints one item with `"visitor":"Ada"` and `"leftAt":null`.
3. The server refuses an empty name even when the form is bypassed. This prints `{"error":"visitor is required"}`:

   ```bash
   curl -s -X POST -H 'content-type: application/json' -d '{"visitor":"","visiting":"Grace"}' http://127.0.0.1:4100/api/visits
   ```
4. A request with no identity header is refused. Port 3000 is the app itself, with no portal in front. This prints `401`:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/api/visits
   ```
5. A signed-in person without the role is refused, and signing back in lets them through:

   ```bash
   curl -s -o /dev/null http://127.0.0.1:4100/_as/reader
   curl -s http://127.0.0.1:4100/api/visits
   curl -s -o /dev/null http://127.0.0.1:4100/_as/editor
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4100/api/visits
   ```

   The second command prints `{"error":"role 'visitors.staff' required"}`. The last prints `200`.
6. After the launch, the live health check answers without sign-in and says where visits are kept:

   ```bash
   curl -s https://visitor-book.acme.vmnodes.com/health
   ```

   It prints `"status":"ok"` and `"storage":"postgres"`. `"storage":"memory"` means `"database": true` did not reach the deployed commit.

## Traps

- **Hiding the form is not checking the role.** Call `identity.requireRole` on the server for every route that reads or writes, as `server.js` does. A person without the role who sends a request directly gets through otherwise. Check 5 tests it.
- **The role string must match in three places**: `vmnodes.json`, `server.js` and `dev/mock-portal.js`. A role the code checks but `vmnodes.json` does not declare can never be given to anyone.
- **An update does not give anyone a role the new commit adds.** If you add a role later, give it with **Change roles**. See [Roles](../concepts/roles.md).
- **Validate on the server.** The form's `required` and `maxlength` are courtesy for people; anyone can send a request without the form. Check 3 tests it.
- **Escape every typed value before it goes into a page.** `server.js` passes each one through `esc()`. Without it a visitor named `<b>Ada</b>` is run as markup.
- **A fixed id in a URL can be anything.** The leave route checks the id is a UUID before it reaches the database, so a made-up id answers 404 and not a database error.
- **Do not fall back to memory.** With `DATABASE_URL` set, an unreachable database must stop the app. A silent fallback loses every entry at the next restart. Without `"database": true`, an update clears the data too. See [Data](../concepts/data.md).
- **List every file the server loads in the `Dockerfile`'s `COPY` line.** A file you add and forget builds, then fails with "Your app stopped while starting." A file you delete and leave in the list fails the build.
- **Keep the app answering `/health` with no sign-in, and keep it on port 3000.** The starter does both. See [Apps](../concepts/apps.md).

## Related

- [Roles](../concepts/roles.md)
- [Data](../concepts/data.md)
- [Sign-in and identity](../concepts/sign-in-and-identity.md)
- [`vmnodes.json`](../reference/vmnodes-json.md)
