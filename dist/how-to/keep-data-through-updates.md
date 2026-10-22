# Keep data through updates

Make an app keep its data when you update it, and change its tables later without losing a row. Read this before the first update of any app that stores anything, and again before the first change to its tables. The example is a stationery stock list for the org `acme`, which gains a "reorder level" column in its second version.

An update replaces the app's container, so anything the app kept in memory or wrote to its own disk is gone afterwards. Only the app's database survives, and only when `vmnodes.json` asks for one. See [Data](../concepts/data.md).

You start from the starter, so do [Getting started](../getting-started.md) steps 1 to 3 first. This page assumes the files explained in [Build a form-and-list app](form-and-list.md).

## 1. Remove what this app does not use

```bash
rm publish.js manifest.json test/smoke.js
ls
```

It worked when `ls` lists `Dockerfile`, `package.json`, `server.js`, `store.js` and `vmnodes.json`, and does not list `publish.js` or `manifest.json`.

## 2. Ask for a database

Replace `vmnodes.json`. Without `"database": true`, the first update clears everything the app holds.

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    {
      "name": "stationery.keeper",
      "description": "Can add items to the stationery stock list and see what is in stock."
    }
  ],
  "database": true
}
```

It worked when this prints `true`:

```bash
node -e 'console.log(require("./vmnodes.json").database)'
```

## 3. Write the database's shape as a list that runs at every start

Replace `store.js`. The tables are not created by VMnodes: the app creates them when it starts, from the `MIGRATIONS` list. The three rules in the comment above the list are what let you change the tables later without losing data, and the rest of this page depends on them.

```js
// store.js: where the stock list is kept.
//
//   DATABASE_URL set   items are kept in Postgres, across restarts and updates.
//   not set            items are kept in memory and cleared on every restart.
//
// On the platform, DATABASE_URL is set for you when vmnodes.json says
// "database": true. There is no fallback: if DATABASE_URL is set but the database
// cannot be reached, the app refuses to start rather than quietly keeping items in memory.

// The database's shape, as an ordered list. Rules for this list:
//   - Add to the END. Never edit or delete an entry that has shipped.
//   - Every entry must be safe to run again: it runs at EVERY start-up, on a database
//     that may already have it.
//   - Only add things (tables, columns with a default, indexes). Never drop or rename.
const MIGRATIONS = [
  `create table if not exists items (
     seq bigserial primary key,
     id uuid not null unique,
     name text not null,
     quantity integer not null check (quantity >= 0),
     added_at timestamptz not null
   )`,
];

function memoryStore() {
  const items = [];
  return {
    kind: "memory",
    async init() {},
    async list() { return items.map((i) => ({ ...i })); },
    async add(item) { items.unshift({ ...item }); },
    async close() {},
  };
}

function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
  const postgres = require("postgres");
  const sql = postgres(url, { max: 3, onnotice: () => {} });
  const toItem = (r) => ({ id: r.id, name: r.name, quantity: r.quantity, addedAt: r.added_at.toISOString() });
  return {
    kind: "postgres",
    async init() {
      // First, wait until the database answers. Only a database that cannot be reached is retried.
      for (let i = 1; ; i++) {
        try {
          await sql`select 1`;
          break;
        } catch (err) {
          if (i >= attempts) throw new Error(`could not reach the database after ${attempts} tries: ${err.message}`);
          log.log(`database not reachable yet (try ${i} of ${attempts}): ${err.message}`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
      // Then bring the database's shape up to date. This is NOT retried: if a change fails, the app
      // stops and says why, instead of reporting a broken change as an unreachable database.
      // One transaction, under a lock, so two containers starting together cannot run the list at once.
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(727001)`;
        for (const statement of MIGRATIONS) await tx.unsafe(statement);
      });
    },
    async list() {
      const rows = await sql`select id, name, quantity, added_at from items order by seq desc`;
      return rows.map(toItem);
    },
    async add(item) {
      await sql`insert into items (id, name, quantity, added_at) values (${item.id}, ${item.name}, ${item.quantity}, ${item.addedAt})`;
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

```js
// server.js: the whole app. A stationery stock list: people with the "keeper" role add
// items and see what is in stock.
const http = require("node:http");
const crypto = require("node:crypto");
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");
const { openStore } = require("./store");

const APP_NAME = process.env.VMNODES_APP_NAME || "stationery-stock";
// Must match the role name in vmnodes.json exactly.
const KEEPER_ROLE = "stationery.keeper";
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

const KEPT = {
  postgres: "Items are kept in this app's database, across restarts and updates.",
  memory: "Items are kept in memory, so they are cleared when the app restarts or is updated.",
};
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

async function readFields(req, names) {
  const raw = await readBody(req);
  const json = (req.headers["content-type"] || "").includes("application/json");
  const o = json ? JSON.parse(raw || "{}") : Object.fromEntries(new URLSearchParams(raw));
  return Object.fromEntries(names.map((n) => [n, typeof o[n] === "string" || typeof o[n] === "number" ? String(o[n]).trim() : ""]));
}

// Whole numbers only, 0 to 100000. Returns the number, or null.
const wholeNumber = (text) => (/^\d{1,6}$/.test(text) && Number(text) <= 100000 ? Number(text) : null);

function shell(inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Stationery stock</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:760px;margin:0 auto;padding:16px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #2a2c35;padding:8px 6px}small,th{color:#9a9cab;font-weight:normal}label{display:block;margin-top:8px}input{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin-top:8px;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head><body>${inner}</body></html>`;
}

function page(user, items, { error = "", values = {} } = {}) {
  const rows = items.length
    ? items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.quantity)}</td></tr>`).join("")
    : `<tr><td colspan="2">Nothing on the list yet.</td></tr>`;
  return shell(`<h1>Stationery stock</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong></p>
<form method="post" action="/items">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<label for="name">Item</label><input id="name" name="name" required maxlength="100" value="${esc(values.name || "")}">
<label for="quantity">How many in stock</label><input id="quantity" name="quantity" required inputmode="numeric" value="${esc(values.quantity || "")}">
<button type="submit">Add item</button></form>
<h2>In stock</h2><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody id="items">${rows}</tbody></table>
<p id="kept"><small>${esc(KEPT[store.kind])}</small></p>`);
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
  identity.requireRole(user, KEEPER_ROLE); // every route below is for keepers, checked on the SERVER

  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await store.list()), "text/html; charset=utf-8");
  if (url.pathname === "/api/items" && req.method === "GET") return send(res, 200, { items: await store.list() });

  if ((url.pathname === "/items" || url.pathname === "/api/items") && req.method === "POST") {
    const f = await readFields(req, ["name", "quantity"]);
    const quantity = wholeNumber(f.quantity);
    const problem = !f.name ? "name is required" : f.name.length > 100 ? "name must be at most 100 characters"
      : quantity === null ? "quantity must be a whole number from 0 to 100000" : null;
    if (problem) {
      if (isApi) return send(res, 400, { error: problem });
      return send(res, 400, page(user, await store.list(), { error: problem, values: f }), "text/html; charset=utf-8");
    }
    const item = { id: crypto.randomUUID(), name: f.name, quantity, addedAt: new Date().toISOString() };
    await store.add(item);
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 201, item);
  }

  return send(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof IdentityError ? err.status : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) console.error(err.cause || err);
    const message = status === 500 ? "something went wrong" : err.message;
    if (new URL(req.url, "http://app").pathname.startsWith("/api/")) return send(res, status, { error: message });
    send(res, status, shell(`<h1>Stationery stock</h1><p>${esc(message)}</p>${status === 403 ? (message === CROSS_SITE_REFUSED ? "<p>Nothing was changed. To make this change, open this app and use its own page.</p>" : `<p>This app is for people with the <code>${esc(KEEPER_ROLE)}</code> role. Ask whoever runs it to give it to you.</p>`) : ""}`), "text/html; charset=utf-8");
  });
});
store.init().then(
  () => server.listen({ port: PORT, host: LISTEN_ADDRESS }, () => console.log(`${APP_NAME} ${VERSION} listening on :${server.address().port} (items kept in ${store.kind})`)),
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

## 5. Match the files to the new role, the file list and the test script

The pretend portal signs you in with the starter's role. Give it yours:

```diff
--- a/dev/mock-portal.js
+++ b/dev/mock-portal.js
@@ -18,7 +18,7 @@
 // the role strings must be exactly what your server passes to requireRole.
 const USERS = {
   reader: { sub: "usr_local_reader", email: "reader@example.test", name: "Riley Reader", kind: "employee", groups: [], roles: [] },
-  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["starter.editor"] },
+  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["stationery.keeper"] },
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

The starter's test checks the noticeboard, which is gone. For now `npm test` is a syntax check:

```diff
--- a/package.json
+++ b/package.json
@@ -7,7 +7,7 @@
   "scripts": {
     "start": "node server.js",
     "dev": "node dev/run-local.js",
-    "test": "node test/smoke.js"
+    "test": "node --check server.js && node --check store.js"
   },
   "engines": {
     "node": ">=22"
```

```bash
npm test
```

It worked when the command prints no error and exits 0.

## 6. Prove the data survives a restart on your computer

`npm run dev` keeps items in memory, because it sets no `DATABASE_URL`. Point it at a Postgres database of your own to test the real path. Use an empty scratch database: [Test with a scratch database](test-with-a-scratch-database.md) starts one safely. These steps write `postgres://localhost/<name>` for a server on the default port; with that page's server, use `postgres://app@127.0.0.1:<port>/<name>` and add `-w -h 127.0.0.1 -p <port> -U app` to `createdb`.

```bash
createdb stationery_scratch
DATABASE_URL=postgres://localhost/stationery_scratch npm run dev
```

Open `http://127.0.0.1:4100`. It worked when the page is headed **Stationery stock** and its last line reads "Items are kept in this app's database, across restarts and updates." Add an item, press Ctrl+C, run the command again and reload. The item is still in the table.

## 7. Launch it and put some rows in

Commit, push and launch as `stationery-stock`, following [Getting started](../getting-started.md) steps 3 to 6. Add two or three items in the app.

It worked when the badge reads **Working** and the app's last line reads "Items are kept in this app's database, across restarts and updates."

## 8. Change the database: add a column

The customer now wants a reorder level on each item. Add the change to the end of the list; never edit the entry above it.

```diff
--- a/store.js
+++ b/store.js
@@ -20,6 +20,9 @@
      quantity integer not null check (quantity >= 0),
      added_at timestamptz not null
    )`,
+  // Version 2: a reorder level. Old rows get 0 ("no level set"); version 1 of the app, which
+  // never mentions this column, keeps working against it, so a rollback is safe.
+  `alter table items add column if not exists reorder_level integer not null default 0`,
 ];
 
 function memoryStore() {
@@ -36,7 +39,7 @@
 function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
   const postgres = require("postgres");
   const sql = postgres(url, { max: 3, onnotice: () => {} });
-  const toItem = (r) => ({ id: r.id, name: r.name, quantity: r.quantity, addedAt: r.added_at.toISOString() });
+  const toItem = (r) => ({ id: r.id, name: r.name, quantity: r.quantity, reorderLevel: r.reorder_level, addedAt: r.added_at.toISOString() });
   return {
     kind: "postgres",
     async init() {
@@ -60,11 +63,12 @@
       });
     },
     async list() {
-      const rows = await sql`select id, name, quantity, added_at from items order by seq desc`;
+      const rows = await sql`select id, name, quantity, reorder_level, added_at from items order by seq desc`;
       return rows.map(toItem);
     },
     async add(item) {
-      await sql`insert into items (id, name, quantity, added_at) values (${item.id}, ${item.name}, ${item.quantity}, ${item.addedAt})`;
+      await sql`insert into items (id, name, quantity, reorder_level, added_at)
+                values (${item.id}, ${item.name}, ${item.quantity}, ${item.reorderLevel}, ${item.addedAt})`;
     },
     async close() { await sql.end({ timeout: 5 }); },
   };
```

The server takes the new field and marks an item as low when its quantity falls to its level:

```diff
--- a/server.js
+++ b/server.js
@@ -59,14 +59,15 @@
 
 function page(user, items, { error = "", values = {} } = {}) {
   const rows = items.length
-    ? items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.quantity)}</td></tr>`).join("")
-    : `<tr><td colspan="2">Nothing on the list yet.</td></tr>`;
+    ? items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.quantity)}${i.reorderLevel > 0 && i.quantity <= i.reorderLevel ? " <strong>Low stock</strong>" : ""}</td><td>${i.reorderLevel > 0 ? esc(i.reorderLevel) : ""}</td></tr>`).join("")
+    : `<tr><td colspan="3">Nothing on the list yet.</td></tr>`;
   return shell(`<h1>Stationery stock</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong></p>
 <form method="post" action="/items">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
 <label for="name">Item</label><input id="name" name="name" required maxlength="100" value="${esc(values.name || "")}">
 <label for="quantity">How many in stock</label><input id="quantity" name="quantity" required inputmode="numeric" value="${esc(values.quantity || "")}">
+<label for="reorderLevel">Reorder when it falls to (optional)</label><input id="reorderLevel" name="reorderLevel" inputmode="numeric" value="${esc(values.reorderLevel || "")}">
 <button type="submit">Add item</button></form>
-<h2>In stock</h2><table><thead><tr><th>Item</th><th>Quantity</th></tr></thead><tbody id="items">${rows}</tbody></table>
+<h2>In stock</h2><table><thead><tr><th>Item</th><th>Quantity</th><th>Reorder at</th></tr></thead><tbody id="items">${rows}</tbody></table>
 <p id="kept"><small>${esc(KEPT[store.kind])}</small></p>`);
 }
 
@@ -105,15 +106,17 @@
   if (url.pathname === "/api/items" && req.method === "GET") return send(res, 200, { items: await store.list() });
 
   if ((url.pathname === "/items" || url.pathname === "/api/items") && req.method === "POST") {
-    const f = await readFields(req, ["name", "quantity"]);
+    const f = await readFields(req, ["name", "quantity", "reorderLevel"]);
     const quantity = wholeNumber(f.quantity);
+    const reorderLevel = f.reorderLevel === "" ? 0 : wholeNumber(f.reorderLevel);
     const problem = !f.name ? "name is required" : f.name.length > 100 ? "name must be at most 100 characters"
-      : quantity === null ? "quantity must be a whole number from 0 to 100000" : null;
+      : quantity === null ? "quantity must be a whole number from 0 to 100000"
+      : reorderLevel === null ? "reorderLevel must be a whole number from 0 to 100000" : null;
     if (problem) {
       if (isApi) return send(res, 400, { error: problem });
       return send(res, 400, page(user, await store.list(), { error: problem, values: f }), "text/html; charset=utf-8");
     }
-    const item = { id: crypto.randomUUID(), name: f.name, quantity, addedAt: new Date().toISOString() };
+    const item = { id: crypto.randomUUID(), name: f.name, quantity, reorderLevel, addedAt: new Date().toISOString() };
     await store.add(item);
     if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
     return send(res, 201, item);
```

Raise the version, so `/health` shows which one is running. This changes `package.json` and `package-lock.json` together and prints `v0.2.0`:

```bash
npm version 0.2.0 --no-git-tag-version
```

Then point the test script at the new file:

```diff
--- a/package.json
+++ b/package.json
@@ -1,13 +1,13 @@
 {
   "name": "vmnodes-starter",
-  "version": "0.1.0",
+  "version": "0.2.0",
   "private": true,
   "description": "The smallest app that passes the VMnodes platform: sign-in, one published record type, health, a Dockerfile.",
   "main": "server.js",
   "scripts": {
     "start": "node server.js",
     "dev": "node dev/run-local.js",
-    "test": "node --check server.js && node --check store.js"
+    "test": "node test/migrate.js"
   },
   "engines": {
     "node": ">=22"
```

## 9. Test the change against the data version 1 made

Save this as `test/migrate.js`. It builds version 1's table from literal text, not from `store.js`, so it keeps testing the old shape after `store.js` has moved on. It also starts the app on that database and checks that it refuses a change sent from another site.

```js
// test/migrate.js: proves the new version can open the database the old version made.
//   TEST_DATABASE_URL=postgres://localhost/stationery_scratch node test/migrate.js
// It also checks that the app refuses a change sent from another site.
// Use an EMPTY scratch database: the test drops and recreates the table `items`.
const { spawn } = require("node:child_process");
const path = require("node:path");
const postgres = require("postgres");
const { SignJWT } = require("jose");
const { startMockPortal, USERS } = require("../dev/mock-portal");
const { openStore } = require("../store");

const URL = process.env.TEST_DATABASE_URL;
if (!URL) { console.log("FAIL set TEST_DATABASE_URL to an empty scratch Postgres database"); process.exit(1); }

// Version 1's table and statements, frozen here as TEXT. Do not build them from store.js:
// once store.js changes, a test built from it would only prove the new code agrees with itself.
const VERSION_1_TABLE = `create table items (
  seq bigserial primary key, id uuid not null unique, name text not null,
  quantity integer not null check (quantity >= 0), added_at timestamptz not null)`;
const VERSION_1_INSERT = "insert into items (id, name, quantity, added_at) values ($1, $2, $3, now())";
const VERSION_1_SELECT = "select id, name, quantity, added_at from items order by seq desc";
const NOT_REPEATABLE = "alter table items add column reorder_level integer not null default 0";

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}
// Opens the database, and reports the database's own words if that fails.
const opens = async (store) => { try { await store.init(); return "opened"; } catch (e) { return e.message; } };
const id = (n) => `00000000-0000-4000-8000-00000000000${n}`;

(async () => {
  const sql = postgres(URL, { max: 5, onnotice: () => {} });
  const fresh = async () => {
    await sql.unsafe("drop table if exists items");
    await sql.unsafe(VERSION_1_TABLE);
    await sql.unsafe(VERSION_1_INSERT, [id(1), "Stapler", 12]);
    await sql.unsafe(VERSION_1_INSERT, [id(2), "Pens", 40]);
  };

  // 1. Rows version 1 wrote are still there after version 2 opens the database.
  await fresh();
  const store = openStore({ env: { DATABASE_URL: URL }, log: { log() {} } });
  check("version 2 opens the database version 1 made", await opens(store), "opened");
  const rows = await store.list();
  check("CONTROL: the rows version 1 wrote are still there", rows.map((r) => [r.name, r.quantity]), [["Pens", 40], ["Stapler", 12]]);
  check("old rows get reorderLevel 0, meaning 'not set'", rows.map((r) => r.reorderLevel), [0, 0]);

  // 2. Opening it again, as every restart does, changes nothing and does not fail.
  check("a second start-up opens it again without error", await opens(store), "opened");
  check("...and keeps every row", (await store.list()).length, 2);

  // 3. New rows carry the new column.
  await store.add({ id: id(3), name: "Tape", quantity: 3, reorderLevel: 5, addedAt: new Date().toISOString() });
  check("a new row keeps its reorderLevel", (await store.list())[0].reorderLevel, 5);

  // 4. Rolling back is safe: version 1's own statements still work on the new table.
  await sql.unsafe(VERSION_1_INSERT, [id(4), "Folders", 7]);
  const old = await sql.unsafe(VERSION_1_SELECT);
  check("version 1's own insert and select still work on the new table", [old.length, old[0].name], [4, "Folders"]);

  // 5. Two containers starting together must both succeed.
  await fresh();
  const starts = await Promise.allSettled([1, 2, 3].map(() => openStore({ env: { DATABASE_URL: URL }, log: { log() {} } }).init()));
  check("three starts at once all succeed", starts.map((s) => s.status), ["fulfilled", "fulfilled", "fulfilled"]);

  // 5b. ...including the very first start, when the table does not exist yet. Without the lock in
  // store.js, two creators of the same table can collide.
  const firstStarts = [];
  for (let round = 0; round < 8; round++) {
    await sql.unsafe("drop table if exists items");
    const r = await Promise.allSettled([1, 2, 3].map(() => openStore({ env: { DATABASE_URL: URL }, log: { log() {} } }).init()));
    firstStarts.push(...r.map((x) => x.status));
  }
  check("three first-ever starts at once, eight times over, all succeed", [...new Set(firstStarts)], ["fulfilled"]);

  // 6. CONTROL for the rules in store.js: the same change written without `if not exists` fails the second time.
  await fresh();
  await sql.unsafe(NOT_REPEATABLE);
  let second = "ran twice";
  try { await sql.unsafe(NOT_REPEATABLE); } catch { second = "refused"; }
  check("CONTROL: a change that is not safe to repeat is refused the second time", second, "refused");

  // 7. Changes sent from another site are refused, whoever is signed in. This runs the app itself
  // on the database version 2 just opened, so it checks the real route and what it saved.
  await fresh();
  const APP_ID = "app_migrate_test";
  const portal = await startMockPortal({ port: 0, appId: APP_ID, as: "editor" });
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { PATH: process.env.PATH, PORT: "0", LISTEN_ADDRESS: "127.0.0.1", VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID, DATABASE_URL: URL },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const base = await new Promise((resolve) => { child.once("exit", () => resolve(null)); child.stdout.on("data", (d) => { const m = String(d).match(/listening on :(\d+)/); if (m) resolve(`http://127.0.0.1:${m[1]}`); }); });
  const keeper = USERS.editor;
  const token = await new SignJWT({ email: keeper.email, name: keeper.name, kind: keeper.kind, groups: keeper.groups, roles: keeper.roles })
    .setProtectedHeader({ alg: "RS256", kid: "local-dev" }).setSubject(keeper.sub).setIssuer(portal.issuer).setAudience(APP_ID).setIssuedAt().setExpirationTime("5m").sign(portal.privateKey);
  const asKeeper = (p, init = {}) => fetch(base + p, { redirect: "manual", ...init, headers: { "x-vmnodes-identity": token, ...init.headers } });
  const formPost = (extra) => asKeeper("/items", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", ...extra }, body: "name=From+elsewhere&quantity=5" });
  const viaBrowser = async (extra) => (await formPost(extra)).status;
  check("a form post from ANOTHER site -> 403", await viaBrowser({ "sec-fetch-site": "cross-site" }), 403);
  const refusal = await (await formPost({ "sec-fetch-site": "cross-site" })).text();
  check("the refusal page says nothing was changed, and does not say a role is missing", [refusal.includes("Nothing was changed"), refusal.includes("Ask whoever runs it")], [true, false]);
  check("a form post from a SIBLING app on the same site -> 403", await viaBrowser({ "sec-fetch-site": "same-site" }), 403);
  check("a post with a foreign Origin and no fetch metadata -> 403", await viaBrowser({ origin: "https://evil.example" }), 403);
  const crossSiteItems = (await (await asKeeper("/api/items")).json()).items.filter((i) => i.name === "From elsewhere").length;
  check("...and none of those three posts was saved", crossSiteItems, 0);
  check("CONTROL: the app's own form (same-origin) still posts -> 303", await viaBrowser({ "sec-fetch-site": "same-origin" }), 303);
  child.kill(); portal.server.close();

  await sql.end({ timeout: 5 });
  const FLOOR = 16;
  if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
  console.log(`\npassed=${pass} failed=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("FAIL the test itself crashed:", e.message); process.exit(1); });
```

Run it on an empty scratch database. It drops and recreates the table `items`:

```bash
TEST_DATABASE_URL=postgres://localhost/stationery_scratch npm test
```

It worked when the last line is `passed=16 failed=0`. A run with no `passed=` line is broken plumbing: read the first `FAIL` line, which carries the database's own message.

## 10. Update the live app

Commit and push. In the portal, open the app's **People** tab, find the **Deployment** card and press **Update to latest commit**.

It worked when the card reads "Updating to" and the new commit, then "Your app is now running the latest commit." Open the app: the items you added in step 7 are still listed, and for each of them the **Reorder at** column is empty. Add an item with a quantity of 3 and a reorder level of 5: **Low stock** appears beside its quantity.

If the update fails, the card reads "The update didn't go online, so your app is still running the previous version." and the old version keeps serving. A change that cannot be applied to the database does this.

## 11. Go back if version 2 is wrong

In **Console**, open the app's **Deployments** tab and press **Roll back to this** on the earlier deployment. It worked when `/health` shows `"version":"0.1.0"` and the items are still listed, including the one you added in version 2.

A roll back starts the earlier version against the database as it is now. It does not undo the new column. Version 1 never mentions the column, so it works against it.

## Check it works

1. In `stationery-v2`, with an empty scratch database, `TEST_DATABASE_URL=postgres://localhost/stationery_scratch npm test` ends `passed=16 failed=0`.
2. A row written by version 1 survives, from the command line. Use one scratch database for all of it, and run `npm run dev` in another terminal each time, stopping it with Ctrl+C before the next. Check out the commit from before step 8, which is version 1:

   ```bash
   export DATABASE_URL=postgres://localhost/stationery_scratch
   git checkout <the commit before step 8>
   ```

   With version 1 running, add an item:

   ```bash
   curl -s -X POST -H 'content-type: application/json' -d '{"name":"Pens","quantity":40}' http://127.0.0.1:4100/api/items
   ```

   It prints the new item, with no `reorderLevel`. Go back to version 2 with `git switch -`, start it and list:

   ```bash
   curl -s http://127.0.0.1:4100/api/items
   ```

   It prints the same item with `"reorderLevel":0`. Check out version 1 again, start it and list: the item is there, without `reorderLevel`, so a roll back works.
3. A bad value is refused. With version 2 running, this prints `{"error":"reorderLevel must be a whole number from 0 to 100000"}`:

   ```bash
   curl -s -X POST -H 'content-type: application/json' -d '{"name":"Tape","quantity":3,"reorderLevel":"lots"}' http://127.0.0.1:4100/api/items
   ```
4. On the live app, before and after step 10, `https://stationery-stock.acme.vmnodes.com/health`, opened in the browser you are signed in with, shows `"storage":"postgres"` both times, `"version":"0.1.0"` before and `"version":"0.2.0"` after.
5. On the live app, the items added before the update are listed after it.

## Traps

- **No `"database": true`, no data.** An update clears everything the app kept in memory or on its disk, and the **Deployment** card warns "Updating replaces your app's container. Anything not saved in its database is cleared." Put the key in `vmnodes.json` before the app holds anything you care about. Adding it later carries nothing over. See [Data](../concepts/data.md).
- **Never edit or delete a `MIGRATIONS` entry that has shipped.** A database that already ran the old text does not run an edited one, so two copies of the app end up with two different tables. Add a new entry at the end.
- **Every entry must be safe to run again.** The list runs at every start, on a database that already has the change. Write `create table if not exists` and `add column if not exists`. The control in `test/migrate.js` shows the same `alter table` without `if not exists` refused the second time.
- **A new `not null` column needs a `default`.** Without it the change fails on a table that already has rows: `contains null values`.
- **Only add.** Do not drop or rename a column in the same release that stops using it. The earlier version still reads it, and a roll back runs that version on your new database. To rename, add the new column and leave the old one in place.
- **Do not retry a failed change.** `store.js` retries only until the database answers, then runs the list once. Retrying every error hides a real failure behind "could not reach the database", and it hid a start-up race the first time this test was written.
- **A failed change stops the app, and so stops the update.** The old version keeps running and the card says "The update didn't go online, so your app is still running the previous version." On a first launch the page says "Your app stopped while starting." Read the database's message in the app's logs: **Console**, the app, its **Logs** tab.
- **Test against the old shape as a literal.** A test that builds version 1's table from `store.js` agrees with whatever `store.js` says today, so it cannot catch a change that breaks old data.
- **A roll back does not roll back data.** Rows added by version 2 are still there in version 1. Keep changes additive so that is harmless.
- **Removing `"database"` does not delete the database.** The app keeps it. See [Data](../concepts/data.md).

## Related

- [Data](../concepts/data.md)
- [Apps](../concepts/apps.md)
- [`vmnodes.json`](../reference/vmnodes-json.md)
- [Change an app someone else built](change-an-app.md)
