# Read shared data

Read the records another app in your org shares, for example to show the meeting-room bookings of one app inside another. Read this before you promise a customer that one app will show another's data, because today a portal app cannot start reading without your VMnodes contact.

> **Coming:** reading another app's shared data from a portal app. Today it needs your VMnodes contact.

## What works today, and what does not

Reading is a request to `POST /v1/data/query` with a bearer token that belongs to the reading app. Two things must exist first, and you can create neither yourself:

| Needed | Who does it | Why you cannot |
|---|---|---|
| **Access** for your app to the shared record type, by name, such as `meeting-rooms.booking` | Your VMnodes contact | `vmnodes.json` has no key to ask for it, and the **Shares** tab does not grant it |
| **A token** for your app, and the API address to send it to | Your VMnodes contact | An app gets a token only when it lists something under `publishes`, and an app that only reads publishes nothing |

> **Trap:** do not add a `publishes` entry to your reading app just to be given a token. The app would then declare a record type it never publishes, only to borrow a credential. Ask your contact for the token.

The sharing app also has its part to do. Its administrator must switch the fields on in its **Shares** tab, as [Share data](share-data.md) step 10 describes. Until then a read is refused.

What you can do today:

1. Build the app so it works with no shared data yet and says so, instead of failing.
2. Send your contact one message that asks for everything at once (step 2).
3. Add the query code and test it against a pretend platform, before the real access exists (step 3).

## 1. Find out exactly what you need

Ask whoever runs the sharing app, or open its **Shares** tab if you are its administrator, for the record type's full name and its fields.

It worked when you have three things written down: the entity name in the form `<app>.<thing>` with no version (the example is `meeting-rooms.booking`), the field names you will read (`room`, `startsAt`, `endsAt`), and a **Shared** mark beside each of those fields on the sharing app's **Shares** tab. A field marked **Not shared** is refused.

## 2. Ask your VMnodes contact

Send this, filled in:

> Please give my app **link-list** read access to the shared record type **meeting-rooms.booking**, for the fields **room**, **startsAt** and **endsAt**. My app only reads, so it has no publish token: please give it a token for reading, and tell me the API address and how the token will reach the app. The app is in the org **acme**.

It worked when your contact confirms the access, gives you the API address and a token for your app, and tells you how the app receives them.

## 3. Add the query code

Save this as `query-shared.js`. It sends the request, returns the rows, and throws the platform's own message when it refuses, so the refusal reaches your log intact. `apiUrl` and `token` are the two values your contact gives you. They are not `VMNODES_API_URL` and `VMNODES_PUBLISH_TOKEN`, which an app that publishes nothing is not given.

```js
// query-shared.js: reads another app's shared records with POST /v1/data/query.
//
// apiUrl and token are the two values your VMnodes contact gives you together with the
// access. They are NOT VMNODES_API_URL / VMNODES_PUBLISH_TOKEN: an app that publishes
// nothing is not given those.

// Returns { rows, truncated, provenance }. Throws an Error with .status and .code when the
// platform refuses, with the platform's own message, so the refusal reaches the log intact.
async function queryShared({ apiUrl, token, entity, select, filter, orderBy, limit }) {
  if (!apiUrl || !token) throw new Error("queryShared needs apiUrl and token: ask your VMnodes contact for both");
  const res = await fetch(`${apiUrl}/v1/data/query`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ entity, select, filter, orderBy, limit }),
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!res.ok) {
    const e = new Error(body?.error?.message || `query answered ${res.status}`);
    e.status = res.status;
    e.code = body?.error?.code;
    throw e;
  }
  return { rows: body.rows, truncated: body.truncated === true, provenance: body.provenance };
}

module.exports = { queryShared };
```

Save this as `test/query-shared.js`. It runs `queryShared` against a pretend platform, so you can check the code before the real access exists. Each refusal it checks is one the platform documents.

```js
// test/query-shared.js: `node test/query-shared.js`. Runs queryShared against a pretend platform
// and checks what it SENDS and how it reacts to the refusals the platform documents.
const http = require("node:http");
const { queryShared } = require("../query-shared");

let pass = 0, fail = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  (expected ${JSON.stringify(want)}, got ${JSON.stringify(got)})`}`);
}

const TOKEN = "test-token";
const seen = [];
const server = http.createServer((req, res) => {
  let raw = ""; req.on("data", (d) => (raw += d));
  req.on("end", () => {
    const reply = (status, body) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return reply(401, { error: { code: "auth/unauthorised", message: "a valid API token is required" } });
    const q = JSON.parse(raw);
    seen.push({ method: req.method, url: req.url, q });
    if (q.entity !== "meeting-rooms.booking") return reply(403, { error: { code: "data/denied", message: `no query access to '${q.entity}'` } });
    if (q.select.includes("organiserPhone")) return reply(403, { error: { code: "data/field-denied", message: "field 'organiserPhone' is not available to you on 'meeting-rooms.booking'" } });
    reply(200, {
      rows: [{ room: "Boardroom", startsAt: "2026-10-22T14:00:00.000Z" }],
      provenance: { entity: q.entity, source: "meeting-rooms", freshestAt: "2026-10-22T09:00:00.000Z", stalestAt: "2026-10-22T09:00:00.000Z" },
      truncated: false, rowCount: 1,
    });
  });
});

async function refusal(args) {
  try { await queryShared(args); return null; } catch (e) { return { status: e.status, code: e.code, message: e.message }; }
}

server.listen(0, "127.0.0.1", () => run().catch((e) => { console.error("FAIL the test itself crashed:", e.message); process.exit(1); }));

async function run() {
  const apiUrl = `http://127.0.0.1:${server.address().port}`;
  const ok = { apiUrl, token: TOKEN, entity: "meeting-rooms.booking", select: ["room", "startsAt"], orderBy: { field: "startsAt", dir: "asc" }, limit: 20 };

  const got = await queryShared(ok);
  check("CONTROL: a granted query returns the rows", got.rows, [{ room: "Boardroom", startsAt: "2026-10-22T14:00:00.000Z" }]);
  check("it names the app the rows came from", got.provenance.source, "meeting-rooms");
  check("it says whether the answer was cut short", got.truncated, false);
  check("it sends POST /v1/data/query with the entity, fields, order and limit", [seen[0].method, seen[0].url, seen[0].q], ["POST", "/v1/data/query", { entity: "meeting-rooms.booking", select: ["room", "startsAt"], orderBy: { field: "startsAt", dir: "asc" }, limit: 20 }]);

  check("a wrong token -> 401 with the platform's message", await refusal({ ...ok, token: "nope" }), { status: 401, code: "auth/unauthorised", message: "a valid API token is required" });
  check("an entity with no grant -> its message, unchanged", await refusal({ ...ok, entity: "crm.note" }), { status: 403, code: "data/denied", message: "no query access to 'crm.note'" });
  check("a field that is not shared with the reader -> its message", (await refusal({ ...ok, select: ["room", "organiserPhone"] })).code, "data/field-denied");
  const before = seen.length;
  const noToken = await refusal({ ...ok, token: undefined });
  check("no token configured: refuses with a message that says what to ask for", noToken.message.startsWith("queryShared needs apiUrl and token"), true);
  check("...and sends nothing", seen.length - before, 0);

  const FLOOR = 9;
  if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
  console.log(`\npassed=${pass} failed=${fail}`);
  server.close();
  process.exit(fail === 0 ? 0 : 1);
}
```

```bash
node test/query-shared.js
```

It worked when the last line is `passed=9 failed=0`. A run with no `passed=` line is broken plumbing: read the first `FAIL` line.

## 4. Call it from your app

```js
const { queryShared } = require("./query-shared");

// Use the names your VMnodes contact tells you for these two values.
const apiUrl = process.env.SHARED_DATA_URL;
const token = process.env.SHARED_DATA_TOKEN;

async function upcomingBookings() {
  // Until the access exists, say so on the page instead of failing the page.
  if (!apiUrl || !token) return { connected: false, rows: [] };
  const { rows, truncated, provenance } = await queryShared({
    apiUrl,
    token,
    entity: "meeting-rooms.booking",
    select: ["room", "startsAt", "endsAt"],
    orderBy: { field: "startsAt", dir: "asc" },
    limit: 20,
  });
  return { connected: true, rows, truncated, asOf: provenance.freshestAt };
}
```

Keep the role check on your own routes: reading shared data does not replace `identity.requireRole`. The same call from the command line, with the address and token your contact gave you:

```bash
curl -sS -w '\n%{http_code}\n' -X POST "$API_URL/v1/data/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity":"meeting-rooms.booking","select":["room","startsAt","endsAt"],"orderBy":{"field":"startsAt","dir":"asc"},"limit":20}'
```

It worked when the status line is `200` and the body has `rows` (a list of objects with only the fields you selected), `rowCount`, `truncated: false` and a `provenance` object whose `source` is `meeting-rooms`. The full request and response are in [The publish API](../reference/publish-api.md#reading-shared-records).

## 5. Read a refusal

The platform's message says what to do. These are the ones you will meet first.

| Message | What it means | What to do |
|---|---|---|
| `a valid API token is required` (401) | The token is missing, wrong or not for an app. | Check the token your contact gave you. An app that publishes nothing has none until they do. |
| `no query access to '<entity>'` | One answer for three cases: the entity does not exist, your app has no access, or no field of it is shared. | Check the spelling of the entity, then ask the sharing app's administrator whether the fields read **Shared**, then ask your contact whether the access exists. |
| `field '<field>' is not available to you on '<entity>'` | A field you selected, filtered or ordered by is not shared with your app. | Select only fields shared with you, or ask for more. |
| `select at least one field` | `select` is empty. | Name the fields you want. |

[The publish API](../reference/publish-api.md) lists the rest.

## Check it works

1. `node test/query-shared.js` ends `passed=9 failed=0`.
2. Before the access exists, your app starts and its page says shared data is not connected, with no error. Start it without `SHARED_DATA_URL` and `SHARED_DATA_TOKEN` set and open the page.
3. After your contact has set it up, the `curl` call above prints `200` and a `rows` list.
4. The control: change the entity in that call to one that does not exist, for example `meeting-rooms.nothing`. It prints `no query access to 'meeting-rooms.nothing'`. A read check that cannot be made to fail proves nothing.
5. Sign in as a person who lacks your app's role and open the page that shows the shared rows: it answers 403, not the rows.

## Traps

- **Do not start building on shared data before the access exists.** Anything that needs the read will fail with `a valid API token is required` or `no query access to '<entity>'`. Send the step 2 message first.
- **The entity name is `<app>.<thing>`, never `<thing>/vN`.** The version is for `vmnodes.json`. A wrong name and a missing grant give the same message, so a typo looks like a refusal.
- **A field the sharing app has not switched on is refused.** Reading needs the sharing app's administrator to press **Turn on** for each field, and your contact to grant the access. Both.
- **Rows need their identifying fields.** If your `select` or your access leaves out a field that identifies a row, the read is refused with a message that begins `rows of '<entity>' are identified by`. Aggregate with `count`, `sum`, `min` or `max` instead, or ask for the field.
- **It is a copy, and it can be old.** Show `provenance.freshestAt` where the age matters. Do not present it as live.
- **Read the cut-off.** `limit` is 50 by default and at most 200. A `truncated` of `true` means more rows matched than you were sent. Filter, order and page in the query, not in your code.
- **Your app's token sees what your app may see, not what the signed-in person may see.** To limit a result to what both may read, send the person's identity header value as `X-Vmnodes-On-Behalf-Of`. Only an app's token may send it.
- **Do not poll.** Publish and query requests share a limit of 300 a minute and 1 MiB a request. Read when someone opens the page, and keep the answer for a short time.
- **Treat the token like a password.** Never commit it and never log it. `queryShared` never puts the token in the message it throws.

## Related

- [Sharing](../concepts/sharing.md)
- [The publish API](../reference/publish-api.md)
- [Share data](share-data.md)
- [Limits](../reference/limits.md)
