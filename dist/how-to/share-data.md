# Share data

Share some of your app's records with the other apps in your org, and keep the rest private. Read this when another team or app needs to see what yours holds. The example is a meeting-room booking app at the org `acme`: it shares which room is taken and when, and keeps the organiser's name and phone number to itself.

To share is to send a curated copy of your records to VMnodes. Other apps cannot read your database. You describe a record type once, send the records, and an administrator then decides, field by field, what other apps may read. [Sharing](../concepts/sharing.md) explains the idea; this page does it.

You start from the starter, so do [Getting started](../getting-started.md) steps 1 to 3 first. The starter already shares notes, and this page changes it to share bookings. It assumes the files explained in [Build a form-and-list app](form-and-list.md).

## 1. Remove what this app does not use

Keep `publish.js`: this app shares. Delete the advanced-path file and the starter's test.

```bash
rm manifest.json test/smoke.js
ls
```

It worked when `ls` lists `Dockerfile`, `package.json`, `publish.js`, `server.js`, `store.js` and `vmnodes.json`, and does not list `manifest.json`.

## 2. Declare the role, the database and what you share

Replace `vmnodes.json`. `publishes` names the record type as `booking/v1`: a local name and a version, with no app name. Declaring it is what makes VMnodes give the app a publish token, at the next production deploy.

```json
{
  "apiVersion": "vmnodes.com/v1",
  "roles": [
    {
      "name": "rooms.booker",
      "description": "Can book and cancel meeting rooms, and see every booking."
    }
  ],
  "database": true,
  "publishes": ["booking/v1"]
}
```

It worked when this prints `booking/v1`:

```bash
node -e 'console.log(require("./vmnodes.json").publishes.join(" "))'
```

## 3. Decide in one place where data lives and how it is published

Replace `store.js`. `storageFor` makes one decision from `DATABASE_URL` that sets both where the bookings are kept and how they are published, so the two cannot disagree. With a database the app sends a `snapshot`, which also removes bookings that were cancelled. In memory it sends an `upsert`, which never removes anything, because a restart empties memory and a snapshot would then tell every reader that every booking is gone.

```js
// store.js: where the bookings are kept, and how they are published.
//
// ONE decision, made here from DATABASE_URL, sets both where bookings live AND how
// they are published, so the two can never disagree:
//   DATABASE_URL set   Postgres. The list read back is the complete set, so publishing
//                      uses "snapshot": a booking cancelled here is removed for everyone.
//   not set            memory, cleared on every restart. The list after a restart is NOT
//                      the complete set, so publishing uses "upsert" and never deletes.
// Never set the publish mode anywhere else.

function storageFor(env) {
  return env.DATABASE_URL
    ? { kind: "postgres", publishMode: "snapshot" }
    : { kind: "memory", publishMode: "upsert" };
}

function memoryStore() {
  const rows = [];
  const upcoming = (limit) => rows.filter((b) => b.endsAt >= new Date().toISOString())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, limit).map((b) => ({ ...b }));
  return {
    ...storageFor({}),
    async init() {},
    async upcoming(limit = 200) { return upcoming(limit); },
    async add(b) { rows.push({ ...b }); },
    async cancel(id) { const i = rows.findIndex((b) => b.id === id); if (i < 0) return false; rows.splice(i, 1); return true; },
    async close() {},
  };
}

function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
  const postgres = require("postgres");
  const sql = postgres(url, { max: 3, onnotice: () => {} });
  const toBooking = (r) => ({
    id: r.id, room: r.room, startsAt: r.starts_at.toISOString(), endsAt: r.ends_at.toISOString(),
    organiserName: r.organiser_name, organiserPhone: r.organiser_phone, createdAt: r.created_at.toISOString(),
  });
  return {
    ...storageFor({ DATABASE_URL: url }),
    async init() {
      for (let i = 1; ; i++) {
        try {
          await sql`create table if not exists bookings (
            seq bigserial primary key,
            id uuid not null unique,
            room text not null,
            starts_at timestamptz not null,
            ends_at timestamptz not null,
            organiser_name text not null,
            organiser_phone text not null default '',
            created_at timestamptz not null
          )`;
          return;
        } catch (err) {
          if (i >= attempts) throw new Error(`could not reach the database after ${attempts} tries: ${err.message}`);
          log.log(`database not reachable yet (try ${i} of ${attempts}): ${err.message}`);
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    },
    async upcoming(limit = 200) {
      const rows = await sql`select id, room, starts_at, ends_at, organiser_name, organiser_phone, created_at
                             from bookings where ends_at >= now() order by starts_at asc limit ${limit}`;
      return rows.map(toBooking);
    },
    async add(b) {
      await sql`insert into bookings (id, room, starts_at, ends_at, organiser_name, organiser_phone, created_at)
                values (${b.id}, ${b.room}, ${b.startsAt}, ${b.endsAt}, ${b.organiserName}, ${b.organiserPhone}, ${b.createdAt})`;
    },
    async cancel(id) {
      const rows = await sql`delete from bookings where id = ${id} returning id`;
      return rows.length > 0;
    },
    async close() { await sql.end({ timeout: 5 }); },
  };
}

function openStore({ env = process.env, log = console } = {}) {
  return env.DATABASE_URL ? postgresStore(env.DATABASE_URL, { log }) : memoryStore();
}

module.exports = { openStore, storageFor };
```

## 4. Replace `publish.js`

`FIELDS` is the one list of what is shared. It describes the record type to VMnodes and it builds every payload, so the two cannot drift apart. The organiser's name and phone number are not in it, so they cannot be sent.

```js
// publish.js: shares a curated copy of the bookings with the rest of the organisation.
//
// Other apps cannot read this app's database, and that is on purpose. You describe a
// record type once, then send the records. Only what is in FIELDS ever leaves the app:
// the organiser's name and phone number are not in it, so they cannot be sent.
//
// On the platform, VMNODES_API_URL and VMNODES_PUBLISH_TOKEN are set for you once the
// deployed vmnodes.json lists something under "publishes". Locally they are not set,
// so publishing switches itself off and says so. It does not pretend to succeed.

// The ONE list of what is shared. It describes the record to the platform AND builds
// every payload, so the two cannot drift apart. Adding a field here shares it (after
// an administrator switches it on in Shares); a field that is not here is never sent.
const FIELDS = [
  { name: "room", type: "string" },
  { name: "startsAt", type: "timestamp" },
  { name: "endsAt", type: "timestamp" },
];
const MAX_RECORDS = 1000; // the platform accepts at most this many records per call

// `mode` decides what happens to records you do NOT send this time:
//   "upsert"   adds and updates only. Nothing is ever deleted. The safe default.
//   "snapshot" also deletes every record missing from this batch. Use it ONLY when the
//              list is your complete, durable set, read from a database.
function createPublisher({ appName, mode = "upsert", env = process.env, log = console }) {
  if (mode !== "upsert" && mode !== "snapshot") throw new Error(`publish mode must be "upsert" or "snapshot", got ${JSON.stringify(mode)}`);
  const apiUrl = env.VMNODES_API_URL;
  const token = env.VMNODES_PUBLISH_TOKEN;
  // vmnodes.json lists "booking/v1"; the platform puts the app's own name in front.
  const entity = `${appName}.booking`;

  if (!apiUrl || !token) {
    log.log("publishing is OFF: VMNODES_API_URL / VMNODES_PUBLISH_TOKEN are not set (normal when running locally)");
    return { enabled: false, entity, publishAll: async () => ({ skipped: true }) };
  }

  async function call(path, body) {
    const res = await fetch(apiUrl + path, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  }

  let described = false;
  async function publishAll(bookings) {
    // A snapshot means "this is everything". Sending part of it would delete the rest.
    if (bookings.length > MAX_RECORDS) throw new Error(`refusing to publish ${bookings.length} records in one batch (the limit is ${MAX_RECORDS}); share a smaller window`);
    if (!described) {
      await call("/v1/publish/entities", {
        entity,
        description: "Meeting room bookings: which room is taken, and when.",
        classification: "internal",
        queryableFields: FIELDS,
      });
      described = true;
    }
    await call("/v1/publish/records", {
      entity,
      mode,
      records: bookings.map((b) => ({
        recordKey: b.id,
        payload: Object.fromEntries(FIELDS.map((f) => [f.name, b[f.name]])), // picks only the listed fields
        sourceUpdatedAt: b.createdAt,
      })),
    });
    return { published: bookings.length };
  }

  return { enabled: true, entity, publishAll };
}

module.exports = { createPublisher, FIELDS };
```

## 5. Replace `server.js`

The app shares after every change, one publish at a time, and once at start-up.

```js
// server.js: the whole app. Meeting room bookings: people with the "booker" role book and
// cancel rooms. The room and the time are shared with other apps in the organisation;
// the organiser's name and phone number stay in this app (see publish.js).
const http = require("node:http");
const crypto = require("node:crypto");
const { VmnodesIdentity, IdentityError } = require("@vmnodes/identity");
const { createPublisher } = require("./publish");
const { openStore } = require("./store");

// The platform sets VMNODES_APP_NAME to the name you gave the app in the portal.
// Shared records are named "<that name>.booking", so it must come from there, not be typed in.
const APP_NAME = process.env.VMNODES_APP_NAME || "meeting-rooms";
// Must match the role name in vmnodes.json exactly.
const BOOKER_ROLE = "rooms.booker";
const VERSION = require("./package.json").version;
const BUILD_COMMIT = process.env.BUILD_COMMIT || null;
const PORT = Number(process.env.PORT || 3000);
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS || undefined;
// Tries made at start-up to send everything once (see publishAtStartup).
const STARTUP_TRIES = Number(process.env.STARTUP_PUBLISH_TRIES || 8);
const STARTUP_DELAY_MS = Number(process.env.STARTUP_PUBLISH_DELAY_MS || 15000);

let identity;
try {
  identity = new VmnodesIdentity();
} catch (err) {
  console.error(`${err.message}\nThe platform sets these when your app is deployed; locally, \`npm run dev\` sets them for you.`);
  process.exit(1);
}
// Where bookings are kept, and so how they are published, is decided in ONE place (store.js).
const store = openStore();
const publisher = createPublisher({ appName: APP_NAME, mode: store.publishMode });

// Publishes one at a time, each reading the list when its turn comes. Two overlapping
// "snapshot" publishes could arrive out of order, and the older list would delete the newer booking.
let publishing = Promise.resolve();
function publishLatest() {
  const run = publishing.then(async () => publisher.publishAll(await store.upcoming(1000)));
  publishing = run.catch((e) => console.error("publish failed:", e.message)); // the next publish still runs
  return run;
}

// Sends everything once when the app starts. Two reasons: bookings made before sharing was
// switched on would otherwise never be sent, and a field an administrator switches on in
// Shares only appears on records sent after that. On the very first deploy the platform has not
// marked this version live yet, so the first tries can be refused; try again a few times.
async function publishAtStartup() {
  if (!publisher.enabled) return;
  for (let i = 1; i <= STARTUP_TRIES; i++) {
    try { await publishLatest(); return; } catch (e) {
      if (i === STARTUP_TRIES) return console.error(`start-up publish gave up after ${i} tries`);
      await new Promise((r) => setTimeout(r, STARTUP_DELAY_MS));
    }
  }
}

const KEPT = {
  postgres: "Bookings are kept in this app's database, across restarts and updates.",
  memory: "Bookings are kept in memory, so they are cleared when the app restarts or is updated.",
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
  return Object.fromEntries(names.map((n) => [n, typeof o[n] === "string" ? o[n].trim() : ""]));
}

// Times are typed and shown in UTC to keep this example short; a real app would ask for a time zone.
// Accepts "2026-10-22T14:00" (what a datetime-local box sends) or a full ISO time. Returns an ISO string, or null.
function parseTime(text) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.test(text)) return null;
  const d = new Date(/(Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const when = (iso) => iso.slice(0, 16).replace("T", " ");

function shell(inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Meeting rooms</title>
<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:820px;margin:0 auto;padding:16px}table{border-collapse:collapse;width:100%}th,td{text-align:left;border-bottom:1px solid #2a2c35;padding:8px 6px}small,th{color:#9a9cab;font-weight:normal}label{display:block;margin-top:8px}input{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin-top:8px;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head><body>${inner}</body></html>`;
}

function page(user, bookings, { error = "", values = {} } = {}) {
  const rows = bookings.length
    ? bookings.map((b) => `<tr><td>${esc(b.room)}</td><td>${esc(when(b.startsAt))} to ${esc(when(b.endsAt))}</td><td>${esc(b.organiserName)}${b.organiserPhone ? `<br><small>${esc(b.organiserPhone)}</small>` : ""}</td>
<td><form method="post" action="/bookings/${esc(b.id)}/cancel"><button type="submit">Cancel</button></form></td></tr>`).join("")
    : `<tr><td colspan="4">No upcoming bookings.</td></tr>`;
  const v = (k) => esc(values[k] || "");
  return shell(`<h1>Meeting rooms</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong></p>
<form method="post" action="/bookings">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
<label for="room">Room</label><input id="room" name="room" required maxlength="50" value="${v("room")}">
<label for="startsAt">Starts (UTC)</label><input id="startsAt" name="startsAt" type="datetime-local" required value="${v("startsAt")}">
<label for="endsAt">Ends (UTC)</label><input id="endsAt" name="endsAt" type="datetime-local" required value="${v("endsAt")}">
<label for="organiserName">Your name</label><input id="organiserName" name="organiserName" required maxlength="100" value="${v("organiserName")}">
<label for="organiserPhone">Your phone number (optional; stays in this app)</label><input id="organiserPhone" name="organiserPhone" maxlength="30" value="${v("organiserPhone")}">
<button type="submit">Book room</button></form>
<h2>Upcoming bookings</h2><table><thead><tr><th>Room</th><th>When</th><th>Organiser</th><th></th></tr></thead><tbody id="bookings">${rows}</tbody></table>
<p id="kept"><small>${esc(KEPT[store.kind])} Sharing: ${publisher.enabled ? `on, as ${esc(publisher.entity)}` : "off (normal when running locally)"}.</small></p>`);
}

async function handle(req, res) {
  const url = new URL(req.url, "http://app");
  const isApi = url.pathname.startsWith("/api/");

  if (url.pathname === "/health") {
    return send(res, 200, { status: "ok", app: APP_NAME, version: VERSION, buildCommit: BUILD_COMMIT, publishing: publisher.enabled, storage: store.kind });
  }

  const user = await identity.currentUser(req.headers);
  identity.requireRole(user, BOOKER_ROLE); // every route below is for bookers, checked on the SERVER

  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await store.upcoming()), "text/html; charset=utf-8");
  if (url.pathname === "/api/bookings" && req.method === "GET") return send(res, 200, { items: await store.upcoming() });

  if ((url.pathname === "/bookings" || url.pathname === "/api/bookings") && req.method === "POST") {
    const f = await readFields(req, ["room", "startsAt", "endsAt", "organiserName", "organiserPhone"]);
    const startsAt = parseTime(f.startsAt), endsAt = parseTime(f.endsAt);
    const problem = !f.room ? "room is required" : f.room.length > 50 ? "room must be at most 50 characters"
      : !f.organiserName ? "organiserName is required" : f.organiserName.length > 100 ? "organiserName must be at most 100 characters"
      : f.organiserPhone.length > 30 ? "organiserPhone must be at most 30 characters"
      : !startsAt ? "startsAt must be a date and time such as 2026-10-22T14:00" : !endsAt ? "endsAt must be a date and time such as 2026-10-22T15:00"
      : endsAt <= startsAt ? "endsAt must be after startsAt" : null;
    if (problem) {
      if (isApi) return send(res, 400, { error: problem });
      return send(res, 400, page(user, await store.upcoming(), { error: problem, values: f }), "text/html; charset=utf-8");
    }
    const booking = { id: crypto.randomUUID(), room: f.room, startsAt, endsAt, organiserName: f.organiserName, organiserPhone: f.organiserPhone, createdAt: new Date().toISOString() };
    await store.add(booking);
    publishLatest().catch(() => {}); // a failure is already logged; the booking itself is saved
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 201, booking);
  }

  const cancel = url.pathname.match(/^\/(?:api\/)?bookings\/([^/]+)\/cancel$/);
  if (cancel && req.method === "POST") {
    const done = UUID.test(cancel[1]) ? await store.cancel(cancel[1].toLowerCase()) : false;
    if (!done) return send(res, 404, { error: "no such booking" });
    publishLatest().catch(() => {});
    if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
    return send(res, 200, { cancelled: cancel[1] });
  }

  return send(res, 404, { error: "not found" });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    const status = err instanceof IdentityError ? err.status : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) console.error(err.cause || err);
    const message = status === 500 ? "something went wrong" : err.message;
    if (new URL(req.url, "http://app").pathname.startsWith("/api/")) return send(res, status, { error: message });
    send(res, status, shell(`<h1>Meeting rooms</h1><p>${esc(message)}</p>${status === 403 ? `<p>This app is for people with the <code>${esc(BOOKER_ROLE)}</code> role. Ask whoever runs it to give it to you.</p>` : ""}`), "text/html; charset=utf-8");
  });
});
store.init().then(
  () => server.listen({ port: PORT, host: LISTEN_ADDRESS }, () => {
    console.log(`${APP_NAME} ${VERSION} listening on :${server.address().port} (bookings kept in ${store.kind})`);
    publishAtStartup();
  }),
  (err) => {
    console.error(`${err.message}\nDATABASE_URL is set, so this app will not start without its database.`);
    process.exit(1);
  },
);
```

It worked when all three files parse. This prints nothing and exits 0:

```bash
node --check server.js && node --check store.js && node --check publish.js
```

## 6. Match the pretend portal and the test script to the new role

The pretend portal signs you in with the starter's role. Give it yours:

```diff
--- a/dev/mock-portal.js
+++ b/dev/mock-portal.js
@@ -18,7 +18,7 @@
 // the role strings must be exactly what your server passes to requireRole.
 const USERS = {
   reader: { sub: "usr_local_reader", email: "reader@example.test", name: "Riley Reader", kind: "employee", groups: [], roles: [] },
-  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["starter.editor"] },
+  editor: { sub: "usr_local_editor", email: "editor@example.test", name: "Eden Editor", kind: "employee", groups: [], roles: ["rooms.booker"] },
 };
 
 async function startMockPortal({ port, appUrl, appId, as = "editor" }) {
```

The `Dockerfile` already copies `server.js publish.js store.js`, so it stays as it is. `npm test` runs the test in the next step:

```diff
--- a/package.json
+++ b/package.json
@@ -7,7 +7,7 @@
   "scripts": {
     "start": "node server.js",
     "dev": "node dev/run-local.js",
-    "test": "node test/smoke.js"
+    "test": "node test/share.js"
   },
   "engines": {
     "node": ">=22"
```

## 7. Add the test

Save this as `test/share.js`. It runs the app against a pretend platform that applies the platform's publish rules, and checks what the app sends: the entity's name, the exact fields, and that the organiser's name and phone number appear in no request. The private values are distinctive on purpose, so a leak cannot hide inside an unrelated value, and the test has a control that shows the values really are in the app.

```js
// test/share.js: `node test/share.js`. Runs the app against a pretend platform that
// applies the platform's real publish rules, and checks what the app SENDS.
// Set TEST_DATABASE_URL to an EMPTY scratch Postgres database to also check the snapshot path.
const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");
const { SignJWT } = require("jose");
const { startMockPortal, USERS } = require("../dev/mock-portal");
const { FIELDS } = require("../publish");

const APP_ID = "app_share_test", APP_NAME = "meeting-rooms", TOKEN = "test-publish-token";
const PRIVATE_PHONE = "07700 900123", PRIVATE_NAME = "Organiser Oona"; // distinctive, so a leak cannot hide in an unrelated value
let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The pretend platform. Same rules as the real one for what matters here.
function pretendPlatform({ refuseFirst = 0 } = {}) {
  const state = { entities: new Map(), records: new Map(), requests: [], refused: 0 };
  const server = http.createServer((req, res) => {
    let raw = ""; req.on("data", (d) => (raw += d));
    req.on("end", () => {
      const reply = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return reply(401, { error: { message: "a valid API token is required" } });
      const body = JSON.parse(raw || "{}");
      state.requests.push({ url: req.url, raw, body });
      if (state.refused < refuseFirst) { state.refused++; return reply(403, { error: { code: "publish/not-declared", message: "no live deployment" } }); }
      if (!String(body.entity).startsWith(`${APP_NAME}.`)) return reply(403, { error: { code: "publish/namespace-denied" } });
      if (req.url === "/v1/publish/entities") { state.entities.set(body.entity, body.queryableFields.map((f) => f.name)); return reply(201, {}); }
      if (req.url === "/v1/publish/records") {
        if (!state.entities.has(body.entity)) return reply(400, { error: { code: "publish/unknown-entity" } });
        if (body.records.length > 1000) return reply(400, { error: { code: "publish/too-many-records" } });
        if (body.mode === "snapshot") { const sent = new Set(body.records.map((r) => r.recordKey)); for (const k of [...state.records.keys()]) if (!sent.has(k)) state.records.delete(k); }
        for (const r of body.records) state.records.set(r.recordKey, r.payload);
        return reply(200, {});
      }
      reply(404, {});
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ state, server, url: `http://127.0.0.1:${server.address().port}` })));
}

async function run({ label, databaseUrl, refuseFirst }) {
  console.log(`\n--- ${label}`);
  const platform = await pretendPlatform({ refuseFirst });
  const portal = await startMockPortal({ port: 0, appId: APP_ID, as: "editor" });
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { PATH: process.env.PATH, PORT: "0", LISTEN_ADDRESS: "127.0.0.1", VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID, VMNODES_APP_NAME: APP_NAME,
      VMNODES_API_URL: platform.url, VMNODES_PUBLISH_TOKEN: TOKEN, STARTUP_PUBLISH_DELAY_MS: "50", ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}) },
    stdio: ["ignore", "pipe", "ignore"],
  });
  const base = await new Promise((resolve) => child.stdout.on("data", (d) => { const m = String(d).match(/listening on :(\d+)/); if (m) resolve(`http://127.0.0.1:${m[1]}`); }));
  const call = async (method, p, body) => {
    const u = USERS.editor;
    const token = await new SignJWT({ email: u.email, name: u.name, kind: u.kind, groups: [], roles: u.roles })
      .setProtectedHeader({ alg: "RS256", kid: "local-dev" }).setSubject(u.sub).setIssuer(portal.issuer).setAudience(APP_ID).setIssuedAt().setExpirationTime("5m").sign(portal.privateKey);
    const res = await fetch(base + p, { method, headers: { "x-vmnodes-identity": token, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, text, json: () => JSON.parse(text) };
  };
  const settle = async (cond) => { for (let i = 0; i < 100 && !cond(); i++) await sleep(50); };
  const stamp = (h) => new Date(Date.now() + h * 3600_000).toISOString().slice(0, 16);

  // Start-up: the first attempts are refused (the version is not live yet); the app tries again.
  await settle(() => platform.state.records !== undefined && platform.state.requests.some((r) => r.url === "/v1/publish/records" && platform.state.refused >= refuseFirst));
  check("start-up: the entity is named <app name>.booking, from VMNODES_APP_NAME", [...platform.state.entities.keys()], [`${APP_NAME}.booking`]);
  check("start-up: refused attempts were retried (refused " + refuseFirst + " first)", platform.state.refused, refuseFirst);

  const made = await call("POST", "/api/bookings", { room: "Boardroom", startsAt: stamp(24), endsAt: stamp(25), organiserName: PRIVATE_NAME, organiserPhone: PRIVATE_PHONE });
  check("CONTROL: a booking is accepted -> 201", made.status, 201);
  const id = made.json().id;
  await settle(() => platform.state.records.has(id));
  check("CONTROL: the booking reaches the platform", platform.state.records.has(id), true);
  check("the record carries exactly the shared fields", Object.keys(platform.state.records.get(id)), FIELDS.map((f) => f.name));
  check("every field sent is one the entity declared", Object.keys(platform.state.records.get(id)).every((k) => platform.state.entities.get(`${APP_NAME}.booking`).includes(k)), true);
  const everythingSent = platform.state.requests.map((r) => r.raw).join("\n");
  check("CONTROL: the private values really are in the app (its own list shows them)", (await call("GET", "/api/bookings")).text.includes(PRIVATE_PHONE), true);
  check("the organiser's phone number and name appear in NO request to the platform", [everythingSent.includes("900123"), everythingSent.includes("Oona")], [false, false]);

  const cancelled = await call("POST", `/api/bookings/${id}/cancel`);
  check("CONTROL: cancelling -> 200", cancelled.status, 200);
  await sleep(300);
  if (databaseUrl) check("snapshot: a cancelled booking is removed from what is shared", platform.state.records.has(id), false);
  else check("memory + upsert: a cancelled booking stays shared (this is why a database is needed)", platform.state.records.has(id), true);
  check("the publish mode follows where the data is kept", [...new Set(platform.state.requests.filter((r) => r.url === "/v1/publish/records").map((r) => r.body.mode))], [databaseUrl ? "snapshot" : "upsert"]);

  child.kill(); portal.server.close(); platform.server.close();
}

(async () => {
  await run({ label: "kept in memory", refuseFirst: 2 });
  if (process.env.TEST_DATABASE_URL) await run({ label: "kept in Postgres", databaseUrl: process.env.TEST_DATABASE_URL, refuseFirst: 0 });
  else console.log("\nSKIP postgres run: set TEST_DATABASE_URL to an empty scratch database to run it");
  const FLOOR = process.env.TEST_DATABASE_URL ? 18 : 10;
  if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
  console.log(`\npassed=${pass} failed=${fail}`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("test crashed:", e); process.exit(1); });
```

```bash
npm test
```

It worked when the last line is `passed=11 failed=0`. To also check the database path, where a cancelled booking disappears from what is shared, give it an empty scratch Postgres database ([Test with a scratch database](test-with-a-scratch-database.md) starts one): `TEST_DATABASE_URL=postgres://localhost/rooms_scratch npm test` ends `passed=22 failed=0`. The pretend platform is not the real one: it proves what your app sends, not what VMnodes does with it.

## 8. Try it on your computer

```bash
npm run dev
```

Open `http://127.0.0.1:4100`.

It worked when the page is headed **Meeting rooms**, shows **Room**, **Starts (UTC)**, **Ends (UTC)**, **Your name** and **Your phone number (optional; stays in this app)**, and has a **Book room** button. Make a booking and it appears under **Upcoming bookings** with a **Cancel** button. The last line reads "Sharing: off (normal when running locally)." and the command's output says "publishing is OFF", because locally there is no publish token and the app does not pretend to send anything.

## 9. Put it online

Commit, push and launch as `meeting-rooms`, following [Getting started](../getting-started.md) steps 3 to 6. The app name matters: shared records are named after it, so this app shares `meeting-rooms.booking`.

It worked when the badge reads **Working** and `https://meeting-rooms.acme.vmnodes.com/health`, opened in the browser you are signed in with, shows `"publishing":true` and `"storage":"postgres"`. The page's last line reads "Bookings are kept in this app's database, across restarts and updates. Sharing: on, as meeting-rooms.booking."

## 10. Let an administrator switch the fields on

Make one booking in the live app. Then, as an administrator, open the app's **Shares** tab.

It worked when a card is headed by `meeting-rooms.booking` with its description "Meeting room bookings: which room is taken, and when.", the tab says "3 fields are waiting for your decision.", and there is one row each for `room`, `startsAt` and `endsAt`, each marked **Not shared** and "Waiting for your decision". There is no row for the organiser's name or phone number: they were never sent.

If the tab reads "Your app doesn't share anything yet.", the app has not published yet. Make a booking and reload.

For each field, press **Turn on**. A page asks "Share room?", says who could read it, and has a **Share room** button. Press it. It worked when the field's row reads **Shared** and offers **Turn off**. Do the same for `startsAt` and `endsAt`.

Turning a field on does not fill in records that were published before. This app sends every upcoming booking at each start-up and after every booking or cancellation, so make one more booking and the values are sent.

## Check it works

1. `npm test` ends `passed=11 failed=0`, and with `TEST_DATABASE_URL` set to an empty scratch database, `passed=22 failed=0`.
2. Locally, sharing is off and says so. With `npm run dev` running, this prints `"publishing":false`:

   ```bash
   curl -s http://127.0.0.1:3000/health
   ```
3. After the launch, `https://meeting-rooms.acme.vmnodes.com/health`, opened in the browser you are signed in with, shows `"publishing":true` and `"storage":"postgres"`.
4. On the **Shares** tab there are exactly three rows, `room`, `startsAt` and `endsAt`, and none for `organiserName` or `organiserPhone`.
5. After the administrator turns the three fields on, each reads **Shared**.
6. Cancel a booking in the live app. The next publish is a snapshot, so the booking leaves the shared copy. You cannot read the copy back from a portal app yourself, because reading needs your VMnodes contact (see [Read shared data](read-shared-data.md)), so the database run of the test in step 7 is your proof.

## Traps

- **Times in UTC on the page.** This example types and shows times in UTC to stay short. A real booking form takes the business's local time: see [Dates and time zones](dates-and-time-zones.md). Keep publishing instants as UTC strings ending in `Z`.

- **Three names for one record type.** `vmnodes.json` says `booking/v1`, the API call says `meeting-rooms.booking`, and the **Shares** tab shows `meeting-rooms.booking`. Take the app's name from `VMNODES_APP_NAME`, as `server.js` does, and never type it in. A wrong name is refused with `applications publish only in their own namespace — '<entity>' must start with '<app>.'`.
- **Declare the entity before you publish it.** An entity that `vmnodes.json` does not list is refused with `publish/not-declared`. The same code appears on a first launch if the app publishes before VMnodes has marked it live, so `server.js` retries at start-up and also publishes after every booking.
- **`snapshot` with data in memory deletes everything.** A restart empties memory, and the next snapshot tells every reader the bookings are gone. Make the choice in one place, `storageFor`, and never set the mode anywhere else.
- **Never send part of a snapshot.** A snapshot removes every record missing from it. The app refuses to send more than 1000 records at once, because the platform accepts at most 1000 per call and a partial list would delete the rest. This app shares only upcoming bookings, so a booking that has ended leaves the shared copy at the next publish.
- **Publish one at a time.** Two snapshots in flight can arrive out of order, and the older list then deletes the newest booking. `publishLatest` chains them and reads the list when its turn comes.
- **Build the payload from the list of shared fields.** `payload: { ...booking }` sends the organiser's phone number the day someone adds a column. `FIELDS` is an allowlist: a field that is not in it is never sent. The test proves it with a value that cannot be mistaken for anything else.
- **Publishing a field does not share it.** A field starts **Not shared** until an administrator presses **Turn on**. Pressing **Turn off** later removes the stored values for that field at once. Your own data is untouched.
- **Do not share contact details.** A field that looks like one carries the badge "Contact detail" and "Usually kept private." Leave names, phone numbers and emails out of `FIELDS` unless the customer asks.
- **Describing the entity again with fewer fields replaces the list.** Taking a field out of `FIELDS` makes it unreadable for everyone. The app describes the entity once per start.
- **Removing the entity from `publishes` retires it.** Afterwards a publish is refused with `This app no longer shares '<entity>'. Nothing new is accepted for it.` Add it back, update the app, and publish again.
- **Treat the token like a password.** It arrives as `VMNODES_PUBLISH_TOKEN`. Never commit it and never log it. An app that lists nothing under `publishes` has no token.
- **Nobody can read what you share until a reader is given access.** Switching fields on is half of it. See [Read shared data](read-shared-data.md).

## Related

- [Sharing](../concepts/sharing.md)
- [The publish API](../reference/publish-api.md)
- [Read shared data](read-shared-data.md)
- [`vmnodes.json`](../reference/vmnodes-json.md)
