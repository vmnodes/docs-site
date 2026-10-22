# Submit and approve

Build an app where one person raises a request and a different person approves or rejects it, with the rule enforced by the server and not by what the page shows. Read this for purchase, expense, leave or any other sign-off. The example is purchase requests at the org `acme`, approved by the budget holder.

You start from the starter, so do [Getting started](../getting-started.md) steps 1 to 3 first. This page assumes the file layout and the pretend portal explained in [Build a form-and-list app](form-and-list.md); only what differs is repeated here.

## Who may do what

| Role | Can | Cannot |
|---|---|---|
| `purchasing.requester` | raise a request; see only the requests they raised | see anyone else's; approve or reject |
| `purchasing.approver` | see every request; approve or reject one, with an optional reason | decide a request they raised themselves |
| neither | nothing: the app answers 403 | |

A person can hold both roles. They can then raise and see everything, but still cannot decide their own request.

## 1. Remove what this app does not use

```bash
rm publish.js manifest.json test/smoke.js
ls
```

It worked when `ls` lists `Dockerfile`, `package.json`, `server.js`, `store.js` and `vmnodes.json`, and does not list `publish.js` or `manifest.json`.

## 2. Declare both roles and a database

Replace `vmnodes.json`. Each role's `description` is what an administrator reads before giving it, so it says what the person can then do.

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    {
      "name": "purchasing.requester",
      "description": "Can raise purchase requests and see the ones they raised."
    },
    {
      "name": "purchasing.approver",
      "description": "Can see every purchase request and approve or reject them."
    }
  ],
  "database": true
}
```

It worked when this prints `purchasing.requester purchasing.approver`:

```bash
node -e 'console.log(require("./vmnodes.json").roles.map((r) => r.name).join(" "))'
```

## 3. Replace `store.js`

The request's owner is kept as `owner_id`, which is the identity's `id`. An `id` never changes for a person, and an email address can be reused or changed, so never key on the email. The `where status = 'pending'` in `decide` is what stops two approvers deciding the same request.

```js
// store.js: where the purchase requests are kept.
//
//   DATABASE_URL set   requests are kept in Postgres, across restarts and updates.
//   not set            requests are kept in memory and cleared on every restart.
//
// On the platform, DATABASE_URL is set for you when vmnodes.json says
// "database": true. There is no fallback: if DATABASE_URL is set but the
// database cannot be reached, the app refuses to start.
//
// A request's owner is kept as owner_id: the identity's `id`, which never changes
// for a person. Never key on email: an address can be reused or changed.

function memoryStore() {
  const rows = [];
  return {
    kind: "memory",
    async init() {},
    // ownerId: only that person's requests; null: everyone's (for approvers).
    async list(ownerId) { return rows.filter((r) => ownerId === null || r.ownerId === ownerId).map((r) => ({ ...r })); },
    async get(id) { const r = rows.find((x) => x.id === id); return r ? { ...r } : null; },
    async add(r) { rows.unshift({ ...r, status: "pending", decidedById: null, decidedByName: null, decidedAt: null, note: "" }); },
    // Only a pending request can be decided. Returns the request, or null if it was not pending.
    async decide(id, { status, byId, byName, note, at }) {
      const r = rows.find((x) => x.id === id && x.status === "pending");
      if (!r) return null;
      Object.assign(r, { status, decidedById: byId, decidedByName: byName, note, decidedAt: at });
      return { ...r };
    },
    async close() {},
  };
}

function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
  const postgres = require("postgres");
  const sql = postgres(url, { max: 3, onnotice: () => {} });
  const cols = sql`id, owner_id, owner_name, item, amount_cents, created_at, status, decided_by_id, decided_by_name, decided_at, note`;
  const toRequest = (r) => ({
    id: r.id, ownerId: r.owner_id, ownerName: r.owner_name, item: r.item, amountCents: r.amount_cents,
    createdAt: r.created_at.toISOString(), status: r.status, decidedById: r.decided_by_id, decidedByName: r.decided_by_name,
    decidedAt: r.decided_at ? r.decided_at.toISOString() : null, note: r.note,
  });
  return {
    kind: "postgres",
    async init() {
      for (let i = 1; ; i++) {
        try {
          await sql`create table if not exists requests (
            seq bigserial primary key,
            id uuid not null unique,
            owner_id text not null,
            owner_name text not null,
            item text not null,
            amount_cents integer not null,
            created_at timestamptz not null,
            status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
            decided_by_id text,
            decided_by_name text,
            decided_at timestamptz,
            note text not null default ''
          )`;
          await sql`create index if not exists requests_owner_idx on requests (owner_id)`;
          return;
        } catch (err) {
          if (i >= attempts) throw new Error(`could not reach the database after ${attempts} tries: ${err.message}`);
          log.log(`database not reachable yet (try ${i} of ${attempts}): ${err.message}`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    },
    async list(ownerId) {
      const rows = ownerId === null
        ? await sql`select ${cols} from requests order by seq desc`
        : await sql`select ${cols} from requests where owner_id = ${ownerId} order by seq desc`;
      return rows.map(toRequest);
    },
    async get(id) {
      const rows = await sql`select ${cols} from requests where id = ${id}`;
      return rows[0] ? toRequest(rows[0]) : null;
    },
    async add(r) {
      await sql`insert into requests (id, owner_id, owner_name, item, amount_cents, created_at)
                values (${r.id}, ${r.ownerId}, ${r.ownerName}, ${r.item}, ${r.amountCents}, ${r.createdAt})`;
    },
    // The "where status = 'pending'" is what stops two approvers deciding the same request.
    async decide(id, { status, byId, byName, note, at }) {
      const rows = await sql`update requests set status = ${status}, decided_by_id = ${byId}, decided_by_name = ${byName}, note = ${note}, decided_at = ${at}
                             where id = ${id} and status = 'pending' returning ${cols}`;
      return rows[0] ? toRequest(rows[0]) : null;
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

The checks that matter are in the routes: scope for reading, `requireRole` for deciding, the own-request rule, and the same 404 for a request that is missing and one that is not yours.

```js
// server.js: the whole app. Purchase requests: people with the "requester" role raise
// a request, and people with the "approver" role approve or reject it.
//
// Who may do what, and every one of these is checked on the SERVER:
//   requester   raise a request; see only the requests they raised
//   approver    see every request; approve or reject one (never their own)
const http = require("node:http");
const crypto = require("node:crypto");
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");
const { openStore } = require("./store");

const APP_NAME = process.env.VMNODES_APP_NAME || "purchase-requests";
// Must match the role names in vmnodes.json exactly.
const ROLE_PREFIX = "purchasing";
const REQUESTER_ROLE = `${ROLE_PREFIX}.requester`;
const APPROVER_ROLE = `${ROLE_PREFIX}.approver`;
const VERSION = require("./package.json").version;
const BUILD_COMMIT = process.env.BUILD_COMMIT || null;
const PORT = Number(process.env.PORT || 3000);
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS || undefined;

let identity;
try {
  identity = new VmnodesIdentity();
} catch (err) {
  console.error(`${err.message}\nThe platform sets these when your app is deployed; locally, \`npm run dev\` sets them for you.`);
  process.exit(1);
}
const store = openStore();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (cents) => (cents / 100).toFixed(2);
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

// Reads named text fields from a form post or a JSON post. Never trusts the types.
async function readFields(req, names) {
  const raw = await readBody(req);
  const json = (req.headers["content-type"] || "").includes("application/json");
  const o = json ? JSON.parse(raw || "{}") : Object.fromEntries(new URLSearchParams(raw));
  return Object.fromEntries(names.map((n) => [n, typeof o[n] === "string" || typeof o[n] === "number" ? String(o[n]).trim() : ""]));
}

// "12", "12.5" and "12.50" are fine; "-3", "1e3" and "12.345" are not. Returns whole cents, or null.
function parseAmount(text) {
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] || "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

const holds = (user, role) => user.roles.includes(role);

function view(r) {
  return { id: r.id, ownerName: r.ownerName, item: r.item, amount: money(r.amountCents), createdAt: r.createdAt, status: r.status, decidedByName: r.decidedByName, decidedAt: r.decidedAt, note: r.note };
}

function shell(inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Purchase requests</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:820px;margin:0 auto;padding:16px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #2a2c35;padding:8px 6px;vertical-align:top}small,th{color:#9a9cab;font-weight:normal}label{display:block;margin-top:8px}input{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin:8px 8px 0 0;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:8px 14px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head><body>${inner}</body></html>`;
}

function page(user, requests, { error = "", values = {} } = {}) {
  const approver = holds(user, APPROVER_ROLE);
  const rows = requests.length
    ? requests.map((r) => {
      // Showing the buttons only to approvers is a courtesy. The server checks the role again on every decision.
      const decide = r.status === "pending" && approver && r.ownerId !== user.id
        ? `<form method="post" action="/requests/${esc(r.id)}/decision"><input name="note" maxlength="300" placeholder="Reason (optional)" aria-label="Reason"><button name="decision" value="approve" type="submit">Approve</button><button name="decision" value="reject" type="submit">Reject</button></form>`
        : "";
      const outcome = r.status === "pending" ? "Waiting" : `${esc(r.status === "approved" ? "Approved" : "Rejected")} by ${esc(r.decidedByName)}${r.note ? `<br><small>${esc(r.note)}</small>` : ""}`;
      return `<tr><td>${esc(r.item)}<br><small>${esc(r.ownerName)}</small></td><td>${esc(money(r.amountCents))}</td><td>${outcome}${decide}</td></tr>`;
    }).join("")
    : `<tr><td colspan="3">No requests yet.</td></tr>`;
  const form = holds(user, REQUESTER_ROLE)
    ? `<form method="post" action="/requests">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<label for="item">What do you need?</label><input id="item" name="item" required maxlength="200" value="${esc(values.item || "")}">
<label for="amount">Cost</label><input id="amount" name="amount" required inputmode="decimal" placeholder="49.90" value="${esc(values.amount || "")}">
<button type="submit">Send request</button></form>`
    : `<p>You can see and decide requests. Raising one needs the <code>${esc(REQUESTER_ROLE)}</code> role.</p>`;
  return shell(`<h1>Purchase requests</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong>${approver ? " (approver)" : ""}</p>${form}
<h2>${approver ? "All requests" : "Your requests"}</h2><table><thead><tr><th>Request</th><th>Cost</th><th>Status</th></tr></thead><tbody id="requests">${rows}</tbody></table>`);
}

// A page on ANOTHER site can submit a form to this app, and the browser sends this app's
// sign-in with it. Every app on vmnodes.com counts as one "site", so the sign-in cookie's
// SameSite setting does not stop a page on another app. So refuse every write that the
// browser says came from anywhere but this app's own pages. A caller that is not a browser
// sends neither header and carries no sign-in cookie, so it is unaffected.
const CROSS_SITE_REFUSED = "a change sent from another site was refused";
function refuseCrossSiteWrite(req) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  const site = req.headers["sec-fetch-site"];
  if (site) {
    if (site !== "same-origin" && site !== "none") throw new IdentityError(CROSS_SITE_REFUSED, 403);
    return;
  }
  const origin = req.headers.origin;
  if (origin && origin !== `https://${req.headers.host}`) throw new IdentityError(CROSS_SITE_REFUSED, 403);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://app");
  const isApi = url.pathname.startsWith("/api/");

  if (url.pathname === "/health") {
    return send(res, 200, { status: "ok", app: APP_NAME, version: VERSION, buildCommit: BUILD_COMMIT, storage: store.kind });
  }

  // A change sent from another site is refused before anything else, whoever is signed in.
  refuseCrossSiteWrite(req);

  const user = await identity.currentUser(req.headers);
  // Holding neither role means no business here at all.
  if (!holds(user, REQUESTER_ROLE) && !holds(user, APPROVER_ROLE)) {
    throw new IdentityError(`role '${REQUESTER_ROLE}' or '${APPROVER_ROLE}' required`, 403);
  }
  // Approvers see everything; everyone else sees only what they raised. The key is user.id, never the email.
  const scope = () => (holds(user, APPROVER_ROLE) ? null : user.id);

  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await store.list(scope())), "text/html; charset=utf-8");
  if (url.pathname === "/api/requests" && req.method === "GET") return send(res, 200, { items: (await store.list(scope())).map(view) });

  const one = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
  if (one && req.method === "GET") {
    const r = UUID.test(one[1]) ? await store.get(one[1].toLowerCase()) : null;
    // Someone else's request and a request that does not exist get the SAME answer, so nobody can probe for ids.
    if (!r || (scope() !== null && r.ownerId !== user.id)) return send(res, 404, { error: "no such request" });
    return send(res, 200, view(r));
  }

  if ((url.pathname === "/requests" || url.pathname === "/api/requests") && req.method === "POST") {
    identity.requireRole(user, REQUESTER_ROLE);
    const f = await readFields(req, ["item", "amount"]);
    const amountCents = parseAmount(f.amount);
    const problem = !f.item ? "item is required" : f.item.length > 200 ? "item must be at most 200 characters"
      : amountCents === null ? "amount must be a positive number with at most two decimals" : null;
    if (problem) {
      if (isApi) return send(res, 400, { error: problem });
      return send(res, 400, page(user, await store.list(scope()), { error: problem, values: f }), "text/html; charset=utf-8");
    }
    const r = { id: crypto.randomUUID(), ownerId: user.id, ownerName: user.name || user.email, item: f.item, amountCents, createdAt: new Date().toISOString() };
    await store.add(r);
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 201, view({ ...r, status: "pending", decidedByName: null, decidedAt: null, note: "" }));
  }

  const decision = url.pathname.match(/^\/(?:api\/)?requests\/([^/]+)\/decision$/);
  if (decision && req.method === "POST") {
    identity.requireRole(user, APPROVER_ROLE); // checked on the SERVER, whatever the page showed
    const f = await readFields(req, ["decision", "note"]);
    if (f.decision !== "approve" && f.decision !== "reject") return send(res, 400, { error: "decision must be approve or reject" });
    if (f.note.length > 300) return send(res, 400, { error: "note must be at most 300 characters" });
    const r = UUID.test(decision[1]) ? await store.get(decision[1].toLowerCase()) : null;
    if (!r) return send(res, 404, { error: "no such request" });
    if (r.ownerId === user.id) return send(res, 403, { error: "you cannot decide your own request" });
    const decided = await store.decide(r.id, { status: f.decision === "approve" ? "approved" : "rejected", byId: user.id, byName: user.name || user.email, note: f.note, at: new Date().toISOString() });
    if (!decided) return send(res, 409, { error: "this request has already been decided" });
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 200, view(decided));
  }

  return send(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof IdentityError ? err.status : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) console.error(err.cause || err);
    const message = status === 500 ? "something went wrong" : err.message;
    if (new URL(req.url, "http://app").pathname.startsWith("/api/")) return send(res, status, { error: message });
    send(res, status, shell(`<h1>Purchase requests</h1><p>${esc(message)}</p>${status === 403 ? (message === CROSS_SITE_REFUSED ? "<p>Nothing was changed. To make this change, open this app and use its own page.</p>" : "<p>Ask whoever runs this app to give you a role.</p>") : ""}`), "text/html; charset=utf-8");
  });
});
store.init().then(
  () => server.listen({ port: PORT, host: LISTEN_ADDRESS }, () => console.log(`${APP_NAME} ${VERSION} listening on :${server.address().port} (requests kept in ${store.kind})`)),
  (err) => {
    console.error(`${err.message}\nDATABASE_URL is set, so this app will not start without its database.`);
    process.exit(1);
  },
);
```

It worked when both files parse. This prints nothing and exits 0:

```bash
node --check server.js && node --check store.js
```

## 5. Update the pretend portal, the `Dockerfile` and the test script

The pretend portal needs one person for each case worth trying: a requester, a second requester, an approver, someone with both roles, and someone with neither.

```diff
--- a/dev/mock-portal.js
+++ b/dev/mock-portal.js
@@ -17,8 +17,11 @@
 // The people you can sign in as locally. Change these to your app's own roles:
 // the role strings must be exactly what your server passes to requireRole.
 const USERS = {
-  reader: { sub: "usr_local_reader", email: "reader@example.test", name: "Riley Reader", kind: "employee", groups: [], roles: [] },
-  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["starter.editor"] },
+  requester: { sub: "usr_local_requester", email: "riley@example.test", name: "Riley Requester", kind: "employee", groups: [], roles: ["purchasing.requester"] },
+  colleague: { sub: "usr_local_colleague", email: "casey@example.test", name: "Casey Colleague", kind: "employee", groups: [], roles: ["purchasing.requester"] },
+  approver: { sub: "usr_local_approver", email: "avery@example.test", name: "Avery Approver", kind: "employee", groups: [], roles: ["purchasing.approver"] },
+  both: { sub: "usr_local_both", email: "bo@example.test", name: "Bo Both", kind: "employee", groups: [], roles: ["purchasing.requester", "purchasing.approver"] },
+  nobody: { sub: "usr_local_nobody", email: "nic@example.test", name: "Nic Nobody", kind: "employee", groups: [], roles: [] },
 };
 
 async function startMockPortal({ port, appUrl, appId, as = "editor" }) {
```

The `Dockerfile` no longer copies `publish.js`:

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

`npm test` runs the new test, which is the next step:

```diff
--- a/package.json
+++ b/package.json
@@ -7,7 +7,7 @@
   "scripts": {
     "start": "node server.js",
     "dev": "node dev/run-local.js",
-    "test": "node test/smoke.js"
+    "test": "node test/approvals.js"
   },
   "engines": {
     "node": ">=22"
```

It worked when `grep -c 'purchasing.approver' dev/mock-portal.js` prints `2` and `grep -c 'COPY server.js store.js' Dockerfile` prints `1`.

## 6. Add the test

Save this as `test/approvals.js`. It proves who can do what in both directions: each refused case has an allowed case beside it, so a check that can only ever refuse cannot pass by accident. It checks the role rule with a second requester, because the owner of a request is refused for two reasons at once.

```js
// test/approvals.js: `node test/approvals.js`. Proves who can do what, in BOTH directions:
// every "refused" row has an "allowed" row beside it, so the check can fail.
// Set TEST_DATABASE_URL to an EMPTY scratch Postgres database to run it against the database too.
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { SignJWT } = require("jose");
const { startMockPortal, USERS } = require("../dev/mock-portal");

const APP_ID = "app_approvals_test";
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}

(async () => {
  const portal = await startMockPortal({ port: 0, appId: APP_ID, as: "requester" });
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { PATH: process.env.PATH, PORT: "0", LISTEN_ADDRESS: "127.0.0.1", VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID, ...(process.env.TEST_DATABASE_URL ? { DATABASE_URL: process.env.TEST_DATABASE_URL } : {}) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const base = await new Promise((resolve) => child.stdout.on("data", (d) => { const m = String(d).match(/listening on :(\d+)/); if (m) resolve(`http://127.0.0.1:${m[1]}`); }));

  // Signs a token for one of the mock portal's people, the way the real gateway would. `over` changes claims;
  // `extra` adds request headers, and a string body is sent as it is.
  async function call(who, method, p, body, over = {}, extra = {}) {
    const u = { ...USERS[who], ...over };
    const token = await new SignJWT({ email: u.email, name: u.name, kind: u.kind, groups: u.groups, roles: u.roles })
      .setProtectedHeader({ alg: "RS256", kid: "local-dev" }).setSubject(u.sub).setIssuer(portal.issuer).setAudience(APP_ID)
      .setIssuedAt().setExpirationTime("5m").sign(portal.privateKey);
    return new Promise((resolve, reject) => {
      const req = http.request(base + p, { method, headers: { "x-vmnodes-identity": token, "content-type": "application/json", ...extra } }, (res) => {
        let data = ""; res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data, json: () => JSON.parse(data) }));
      });
      req.on("error", reject);
      if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
      req.end();
    });
  }

  // --- who may enter at all ---------------------------------------------------
  check("a person with neither role -> 403", (await call("nobody", "GET", "/api/requests")).status, 403);
  check("CONTROL: a requester gets in", (await call("requester", "GET", "/api/requests")).status, 200);

  // --- raising a request ------------------------------------------------------
  const made = await call("requester", "POST", "/api/requests", { item: "Standing desk <script>", amount: "249.9" });
  check("CONTROL: a requester can raise a request -> 201, pending, amount in pounds and pence", [made.status, made.json().status, made.json().amount], [201, "pending", "249.90"]);
  const id = made.json().id;
  check("an approver who is not a requester cannot raise one -> 403", (await call("approver", "POST", "/api/requests", { item: "Pens", amount: "5" })).status, 403);
  for (const amount of ["-5", "0", "abc", "12.345", "1e3", ""]) {
    check(`amount ${JSON.stringify(amount)} -> 400`, (await call("requester", "POST", "/api/requests", { item: "Pens", amount })).status, 400);
  }
  check("a missing item -> 400", (await call("requester", "POST", "/api/requests", { amount: "5" })).status, 400);

  // --- seeing: own records only, unless approver ---------------------------------
  check("the requester sees their own request", (await call("requester", "GET", "/api/requests")).json().items.map((r) => r.id), [id]);
  check("ANOTHER requester sees none of it", (await call("colleague", "GET", "/api/requests")).json().items, []);
  check("an approver sees every request", (await call("approver", "GET", "/api/requests")).json().items.map((r) => r.id), [id]);
  check("CONTROL: the owner can open it by id -> 200", (await call("requester", "GET", `/api/requests/${id}`)).status, 200);
  const other = await call("colleague", "GET", `/api/requests/${id}`);
  const missing = await call("colleague", "GET", "/api/requests/6f1c2a52-8f0d-4d64-9d0e-1c7b0e2a9b11");
  check("another requester opening it by id -> 404, the SAME answer as an id that does not exist", [other.status, other.body], [missing.status, missing.body]);
  check("a different person with the SAME EMAIL (different id) sees none of it: the key is id, not email", (await call("requester", "GET", "/api/requests", undefined, { sub: "usr_someone_else" })).json().items, []);

  // --- deciding: only approvers, and every time -------------------------------
  check("the requester cannot approve their own request -> 403 (the role check and the own-request rule both refuse this one)", (await call("requester", "POST", `/api/requests/${id}/decision`, { decision: "approve" })).status, 403);
  check("ANOTHER requester cannot approve -> 403 (only the role check can refuse this one)", (await call("colleague", "POST", `/api/requests/${id}/decision`, { decision: "approve" })).status, 403);
  check("...and nothing changed", (await call("approver", "GET", `/api/requests/${id}`)).json().status, "pending");
  check("a decision that is neither approve nor reject -> 400", (await call("approver", "POST", `/api/requests/${id}/decision`, { decision: "maybe" })).status, 400);
  check("a made-up request id -> 404", (await call("approver", "POST", "/api/requests/6f1c2a52-8f0d-4d64-9d0e-1c7b0e2a9b11/decision", { decision: "approve" })).status, 404);
  const rejected = await call("approver", "POST", `/api/requests/${id}/decision`, { decision: "reject", note: "Over budget" });
  check("CONTROL: an approver can reject -> 200, with the reason", [rejected.status, rejected.json().status, rejected.json().note, rejected.json().decidedByName], [200, "rejected", "Over budget", "Avery Approver"]);
  check("deciding twice -> 409, the first decision stands", [(await call("approver", "POST", `/api/requests/${id}/decision`, { decision: "approve" })).status, (await call("requester", "GET", `/api/requests/${id}`)).json().status], [409, "rejected"]);

  // --- nobody decides their own request -----------------------------------------
  const mine = (await call("both", "POST", "/api/requests", { item: "Monitor", amount: "180" })).json().id;
  check("someone who holds both roles cannot decide their own request -> 403", (await call("both", "POST", `/api/requests/${mine}/decision`, { decision: "approve" })).status, 403);
  check("...but another approver can -> 200", (await call("approver", "POST", `/api/requests/${mine}/decision`, { decision: "approve" })).status, 200);

  // --- the page: text is escaped, buttons follow the role ------------------------
  const asReq = await call("requester", "GET", "/");
  check("typed text is escaped, not run as markup", asReq.body.includes("Standing desk &lt;script&gt;") && !asReq.body.includes("<script>"), true);
  check("a requester's page has no Approve button", asReq.body.includes(">Approve<"), false);
  const second = (await call("colleague", "POST", "/api/requests", { item: "Chair", amount: "99" })).json().id;
  check("CONTROL: an approver's page has an Approve button for a pending request", (await call("approver", "GET", "/")).body.includes(`/requests/${second}/decision`), true);

  // --- changes sent from another site are refused, whoever is signed in ---------
  // A form on another app's page must not raise a request as the signed-in person.
  const formPost = (extra) => call("requester", "POST", "/requests", "item=From+elsewhere&amount=5", {}, { "content-type": "application/x-www-form-urlencoded", ...extra });
  const viaBrowser = async (extra) => (await formPost(extra)).status;
  check("a form post from ANOTHER site -> 403", await viaBrowser({ "sec-fetch-site": "cross-site" }), 403);
  const refusal = (await formPost({ "sec-fetch-site": "cross-site" })).body;
  check("the refusal page says nothing was changed, and does not say a role is missing", [refusal.includes("Nothing was changed"), refusal.includes("Ask whoever runs this app")], [true, false]);
  check("a form post from a SIBLING app on the same site -> 403", await viaBrowser({ "sec-fetch-site": "same-site" }), 403);
  check("a post with a foreign Origin and no fetch metadata -> 403", await viaBrowser({ origin: "https://evil.example" }), 403);
  const crossSiteRequests = (await call("requester", "GET", "/api/requests")).json().items.filter((r) => r.item === "From elsewhere").length;
  check("...and none of those three posts was saved", crossSiteRequests, 0);
  check("CONTROL: the app's own form (same-origin) still posts -> 303", await viaBrowser({ "sec-fetch-site": "same-origin" }), 303);

  const FLOOR = 31;
  if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
  console.log(`\npassed=${pass} failed=${fail}`);
  child.kill(); portal.server.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("test crashed:", e); process.exit(1); });
```

```bash
npm test
```

It worked when the last line is `passed=35 failed=0`. To run it against the database as well, give it an empty scratch Postgres database ([Test with a scratch database](test-with-a-scratch-database.md) starts one): `TEST_DATABASE_URL=postgres://localhost/approvals_scratch npm test`.

## 7. Try it on your computer

The pretend portal's default person no longer exists, so name one:

```bash
npm run dev -- requester
```

Open `http://127.0.0.1:4100`.

It worked when the page is headed **Purchase requests**, reads "Signed in as Riley Requester", shows **What do you need?**, **Cost** and **Send request**, and has a table headed **Your requests**. Raise a request: the row shows "Waiting" and no **Approve** button, because you cannot decide your own.

Now switch person. Open `http://127.0.0.1:4100/_as/colleague`: the table is empty, because Casey did not raise it. Open `http://127.0.0.1:4100/_as/approver`: the page reads "Signed in as Avery Approver (approver)", the table is headed **All requests**, and the row has a reason box with **Approve** and **Reject**. Press **Approve**. It worked when the row reads "Approved by Avery Approver". Stop the command with Ctrl+C.

## 8. Put it online

Commit, push and launch as `purchase-requests`, following [Getting started](../getting-started.md) steps 3 to 6.

It worked when the badge reads **Working** and a line reads "You have every role purchase-requests declares: purchasing.requester, purchasing.approver."

## 9. Give the roles to the right people

On the app's **People** tab, press **Change roles** on each person, tick the roles and press **Save roles**. Give the budget holder `purchasing.approver` and everyone who may ask for things `purchasing.requester`. It worked when each row lists the roles you ticked.

The budget holder must already be a member of the org. There is no portal screen for adding one, so ask your VMnodes contact. See [Limits](../reference/limits.md).

## Check it works

1. `npm test` ends `passed=35 failed=0`.
2. With `npm run dev -- requester` running in another terminal, walk the whole rule from the command line. Each command's expected output follows it.

   Raise a request as the requester. This prints `303`:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -d 'item=Standing+desk&amount=249.90' http://127.0.0.1:4100/requests
   ```

   Another requester sees none of it. This prints `{"items":[]}`:

   ```bash
   curl -s -o /dev/null http://127.0.0.1:4100/_as/colleague
   curl -s http://127.0.0.1:4100/api/requests
   ```

   Another requester cannot approve it. Switch back, copy the request's id, then try as the colleague. The last command prints `{"error":"role 'purchasing.approver' required"} 403`:

   ```bash
   curl -s -o /dev/null http://127.0.0.1:4100/_as/requester
   ID=$(curl -s http://127.0.0.1:4100/api/requests | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).items[0].id')
   curl -s -o /dev/null http://127.0.0.1:4100/_as/colleague
   curl -s -w ' %{http_code}\n' -X POST -H 'content-type: application/json' -d '{"decision":"approve"}' http://127.0.0.1:4100/api/requests/$ID/decision
   ```

   The approver can. The last command prints the request with `"status":"approved"`, `"decidedByName":"Avery Approver"` and `"note":"Within budget"`, then ` 200`:

   ```bash
   curl -s -o /dev/null http://127.0.0.1:4100/_as/approver
   curl -s -w ' %{http_code}\n' -X POST -H 'content-type: application/json' -d '{"decision":"approve","note":"Within budget"}' http://127.0.0.1:4100/api/requests/$ID/decision
   ```

   A second decision is refused and the first stands. This prints `{"error":"this request has already been decided"} 409`:

   ```bash
   curl -s -w ' %{http_code}\n' -X POST -H 'content-type: application/json' -d '{"decision":"reject"}' http://127.0.0.1:4100/api/requests/$ID/decision
   ```

   Nobody decides their own request, even holding both roles. This prints `{"error":"you cannot decide your own request"} 403`:

   ```bash
   curl -s -o /dev/null http://127.0.0.1:4100/_as/both
   curl -s -o /dev/null -X POST -H 'content-type: application/json' -d '{"item":"Monitor","amount":"180"}' http://127.0.0.1:4100/api/requests
   MINE=$(curl -s http://127.0.0.1:4100/api/requests | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).items.find((r) => r.item === "Monitor").id')
   curl -s -w ' %{http_code}\n' -X POST -H 'content-type: application/json' -d '{"decision":"approve"}' http://127.0.0.1:4100/api/requests/$MINE/decision
   ```
3. After the launch, `https://purchase-requests.acme.vmnodes.com/health`, opened in the browser you are signed in with, shows `"status":"ok"` and `"storage":"postgres"`.
4. On the live app, signed in as the person who launched it (who holds both roles), raise a request. It worked when the row reads "Waiting" with no **Approve** button. Sign in as the budget holder, who holds only `purchasing.approver`: the same row has **Approve** and **Reject**.

## Traps

- **The role check belongs on the server, on the decision route.** A hidden button stops nobody who sends the request directly. `server.js` calls `identity.requireRole(user, APPROVER_ROLE)` on every decision, whatever the page showed.
- **Declare both roles, and check both strings.** A role the code checks and `vmnodes.json` does not declare can never be given to anyone, so nobody could approve. The strings in `vmnodes.json`, `server.js` and `dev/mock-portal.js` must match.
- **Key ownership on the identity `id`, never the email.** An address can be reused or changed. `owner_id` holds `user.id`.
- **Answer a request that is not yours exactly like one that does not exist.** Both answer 404 `no such request`, so nobody can probe for ids. A 403 for "not yours" tells them the id is real.
- **Refuse self-approval on the server.** The page hides the buttons on your own request, but `you cannot decide your own request` is what enforces it. Giving one person both roles is allowed; deciding their own request is not.
- **Decide only a pending request, in the same statement that writes the decision.** The `where status = 'pending'` makes two approvers pressing **Approve** at once produce one decision and one `this request has already been decided`, not two.
- **One account cannot prove separation of duties.** The person who launches the app holds every role, so they can raise requests but not approve them, and that is the only thing one account can show. Approval needs a second org member who holds only the approver role.
- **A role added by an update reaches nobody.** If you add a role later, give it with **Change roles**. See [Roles](../concepts/roles.md).
- **Money in whole cents.** `parseAmount` accepts `12`, `12.5` and `12.50` and refuses `-3`, `1e3` and `12.345`, so a float never reaches the database.
- **Test "cannot approve" with a person who did not raise the request.** The owner is refused by the own-request rule as well, so that case stays green even if the role check is removed. The second requester in `test/approvals.js` is the one that proves the role rule.

## Related

- [Roles](../concepts/roles.md)
- [Sign-in and identity](../concepts/sign-in-and-identity.md)
- [Build a form-and-list app](form-and-list.md)
- [Limits](../reference/limits.md)
