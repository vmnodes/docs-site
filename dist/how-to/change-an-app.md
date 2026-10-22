# Change an app someone else built

Make a change to an app that is already online and was built by someone else, and put it live without breaking it or losing its data. Read this when you are handed a repository and asked to change it. The example is a team link list at the org `acme` that gets a "category" on every link.

Updating an app rebuilds the latest commit on the default branch of the repository it was launched from, and replaces the running app. It cannot change the repository or the branch. Read [Apps](../concepts/apps.md) once for how an update behaves.

## 1. Learn what you were handed

Clone the repository and read five things before you change anything. The portal does not show an app's repository address, so ask whoever launched the app for it.

```bash
git clone https://github.com/acme/link-list.git
cd link-list
cat vmnodes.json
grep -n 'requireRole' server.js
grep -n 'MIGRATIONS' store.js
grep -n '"test"' package.json
```

It worked when you can answer five questions from the output:

- **Which roles does the app have?** The `name` values under `roles`. In the example it is `links.editor`.
- **Does it keep data in a database?** `"database": true`. In the example it does. If it is missing or `false`, an update clears everything the app holds, so stop and read [Keep data through updates](keep-data-through-updates.md) first.
- **Which routes check the role?** Every `requireRole` line. The example checks it once, before every route except `/health`.
- **How do you run its tests?** The `test` script. In the example, `node test/smoke.js`.
- **How does it change its tables?** Through a `MIGRATIONS` list in `store.js`. In the example it has one. If `grep` prints nothing, the app creates its tables some other way, often with one `create table if not exists`. Before you change what it stores, move that statement unchanged into a `MIGRATIONS` list as its first entry, then add your change as the next entry. [Keep data through updates](keep-data-through-updates.md) shows the list, the lock around it and the test that proves old rows survive.

## 2. Run the tests before you touch anything

```bash
npm install
npm test
```

It worked when the last line is `passed=25 failed=0`. Write that count down: it is your baseline, and the count must go up, not down, when you add checks. If the baseline already fails, say so to whoever asked, and do not start from a broken base.

## 3. Find out what is running now

Someone may have pushed a commit that was never put online. Compare what the app says it runs with what the repository holds.

```bash
git rev-parse HEAD
```

Then open `https://link-list.acme.vmnodes.com/health` in the browser you are signed in with. A plain `curl` of it from your computer gets the gateway's sign-in redirect instead, because every request from outside passes through sign-in; the platform's own check reaches the container directly.

In the portal, open the app's **People** tab and read **Current commit:** in the **Deployment** card.

It worked when the `buildCommit` in the health answer and the **Current commit:** both equal the `git rev-parse HEAD` output. If they differ, the repository is ahead of what is online: your update will put the earlier, unreleased commits live too. Read `git log` for what they are.

## 4. Make the change, small enough to undo

One change per update. Here the change is a category on each link, chosen from a fixed list, with a filter. Three decisions keep it safe:

- The database gets a new column through the app's own `MIGRATIONS` list, with a default, so every link that already exists becomes `General`. Nothing is dropped or renamed.
- `vmnodes.json` does not change. No role is added, renamed or removed.
- The version in `package.json` goes up, so `/health` tells you which one is running.

The database change, added at the end of the list:

```diff
--- a/store.js
+++ b/store.js
@@ -17,6 +17,8 @@
      added_by text not null,
      added_at timestamptz not null
    )`,
+  // Added in version 0.2.0. Links added before it get the category "General".
+  `alter table links add column if not exists category text not null default 'General'`,
 ];
 
 function memoryStore() {
@@ -33,7 +35,7 @@
 function postgresStore(url, { attempts = 5, delayMs = 1000, log = console } = {}) {
   const postgres = require("postgres");
   const sql = postgres(url, { max: 3, onnotice: () => {} });
-  const toLink = (r) => ({ id: r.id, title: r.title, url: r.url, addedBy: r.added_by, addedAt: r.added_at.toISOString() });
+  const toLink = (r) => ({ id: r.id, title: r.title, url: r.url, addedBy: r.added_by, category: r.category, addedAt: r.added_at.toISOString() });
   return {
     kind: "postgres",
     async init() {
@@ -52,11 +54,11 @@
       }
     },
     async list() {
-      const rows = await sql`select id, title, url, added_by, added_at from links order by seq desc`;
+      const rows = await sql`select id, title, url, category, added_by, added_at from links order by seq desc`;
       return rows.map(toLink);
     },
     async add(link) {
-      await sql`insert into links (id, title, url, added_by, added_at) values (${link.id}, ${link.title}, ${link.url}, ${link.addedBy}, ${link.addedAt})`;
+      await sql`insert into links (id, title, url, category, added_by, added_at) values (${link.id}, ${link.title}, ${link.url}, ${link.category}, ${link.addedBy}, ${link.addedAt})`;
     },
     async close() { await sql.end({ timeout: 5 }); },
   };
```

The server takes, checks, saves and shows the category, and filters by it:

```diff
--- a/server.js
+++ b/server.js
@@ -8,6 +8,8 @@
 const APP_NAME = process.env.VMNODES_APP_NAME || "link-list";
 // Must match the role name in vmnodes.json exactly.
 const EDITOR_ROLE = "links.editor";
+// The categories a link can have. The first is the default.
+const CATEGORIES = ["General", "Forms", "Training", "Suppliers"];
 const VERSION = require("./package.json").version;
 const BUILD_COMMIT = process.env.BUILD_COMMIT || null;
 const PORT = Number(process.env.PORT || 3000);
@@ -52,18 +54,22 @@
 
 function shell(inner) {
   return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Team links</title>
-<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:760px;margin:0 auto;padding:16px}ul{list-style:none;padding:0}li{border-bottom:1px solid #2a2c35;padding:8px 0}a{color:#b8b8ff}small{color:#9a9cab}label{display:block;margin-top:8px}input{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin-top:8px;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head><body>${inner}</body></html>`;
+<style>body{font:16px/1.5 system-ui,sans-serif;background:#0b0c10;color:#e8e8ee;max-width:760px;margin:0 auto;padding:16px}ul{list-style:none;padding:0}li{border-bottom:1px solid #2a2c35;padding:8px 0}a{color:#b8b8ff}small{color:#9a9cab}label{display:block;margin-top:8px}input,select{width:100%;background:#15161c;color:inherit;border:1px solid #2a2c35;border-radius:6px;padding:8px;box-sizing:border-box;font:inherit}button{margin-top:8px;background:#5b5bd6;color:#fff;border:0;border-radius:6px;padding:10px 16px;font:inherit}.err{border:1px solid #d65b5b;border-radius:6px;padding:8px}code{font-family:ui-monospace,monospace}</style></head><body>${inner}</body></html>`;
 }
 
-function page(user, links, { error = "", values = {} } = {}) {
+function page(user, links, { error = "", values = {}, filter = "" } = {}) {
   const items = links.length
-    ? links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.title)}</a><br><small>${esc(l.addedBy)}</small></li>`).join("")
+    ? links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.title)}</a><br><small>${esc(l.category)} &middot; ${esc(l.addedBy)}</small></li>`).join("")
     : "<li>No links yet.</li>";
+  const options = CATEGORIES.map((c) => `<option${c === (values.category || CATEGORIES[0]) ? " selected" : ""}>${esc(c)}</option>`).join("");
+  const filters = ["All", ...CATEGORIES].map((c) => (c === (filter || "All") ? `<strong>${esc(c)}</strong>` : `<a href="${c === "All" ? "/" : `/?category=${encodeURIComponent(c)}`}">${esc(c)}</a>`)).join(" | ");
   return shell(`<h1>Team links</h1><p id="who">Signed in as <strong>${esc(user.name || user.email)}</strong></p>
 <form method="post" action="/links">${error ? `<p class="err" role="alert">${esc(error)}</p>` : ""}
 <label for="title">Title</label><input id="title" name="title" required maxlength="100" value="${esc(values.title || "")}">
 <label for="url">Address</label><input id="url" name="url" required maxlength="500" placeholder="https://" value="${esc(values.url || "")}">
+<label for="category">Category</label><select id="category" name="category">${options}</select>
 <button type="submit">Add link</button></form>
+<p id="filters">${filters}</p>
 <ul id="links">${items}</ul>`);
 }
 
@@ -78,19 +84,25 @@
   const user = await identity.currentUser(req.headers);
   identity.requireRole(user, EDITOR_ROLE);
 
-  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await store.list()), "text/html; charset=utf-8");
-  if (url.pathname === "/api/links" && req.method === "GET") return send(res, 200, { items: await store.list() });
+  // ?category=Forms shows only that category; an unknown name shows nothing, not everything.
+  const filter = url.searchParams.get("category") || "";
+  const visible = async () => (await store.list()).filter((l) => !filter || l.category === filter);
 
+  if (url.pathname === "/" && req.method === "GET") return send(res, 200, page(user, await visible(), { filter }), "text/html; charset=utf-8");
+  if (url.pathname === "/api/links" && req.method === "GET") return send(res, 200, { items: await visible() });
+
   if ((url.pathname === "/links" || url.pathname === "/api/links") && req.method === "POST") {
-    const f = await readFields(req, ["title", "url"]);
+    const f = await readFields(req, ["title", "url", "category"]);
+    if (!f.category) f.category = CATEGORIES[0];
     const address = webAddress(f.url);
     const problem = !f.title ? "title is required" : f.title.length > 100 ? "title must be at most 100 characters"
+      : !CATEGORIES.includes(f.category) ? `category must be one of: ${CATEGORIES.join(", ")}`
       : !address || address.length > 500 ? "url must be a web address starting with http:// or https://" : null;
     if (problem) {
       if (isApi) return send(res, 400, { error: problem });
       return send(res, 400, page(user, await store.list(), { error: problem, values: f }), "text/html; charset=utf-8");
     }
-    const link = { id: crypto.randomUUID(), title: f.title, url: address, addedBy: user.name || user.email, addedAt: new Date().toISOString() };
+    const link = { id: crypto.randomUUID(), title: f.title, url: address, category: f.category, addedBy: user.name || user.email, addedAt: new Date().toISOString() };
     await store.add(link);
     if (!isApi) { res.writeHead(303, { location: "/" }); return res.end(); }
     return send(res, 201, link);
```

The version, in `package.json` and `package-lock.json` together:

```bash
npm version 0.2.0 --no-git-tag-version
```

It worked when that prints `v0.2.0` and `git diff --stat` lists `package-lock.json`, `package.json`, `server.js` and `store.js`, and no other file.

## 5. Add tests for the change

Add these checks to `test/smoke.js`. They test the new rule in both directions: a known category is accepted and an unknown one is refused, the filter returns only that category, and an unknown filter returns nothing rather than everything.

```diff
--- a/test/smoke.js
+++ b/test/smoke.js
@@ -102,13 +102,28 @@
   check("the form post answers 303 back to the list", posted.status, 303);
   check("...and the new link is listed", (await json(await editor(), "GET", "/api/links")).json().items.length, 2);
 
-  // --- 7. A database that cannot be reached stops the app; it never falls back --
+  // --- 7. Categories ------------------------------------------------------------
+  const rota = (await json(await editor(), "GET", "/api/links")).json().items.find((l) => l.title.startsWith("Rota"));
+  check("a link added without a category is 'General'", rota.category, "General");
+  const forms = await json(await editor(), "POST", "/api/links", { title: "Leave form", url: "https://example.com/leave", category: "Forms" });
+  check("CONTROL: a link with a known category -> 201 and keeps it", [forms.status, forms.json().category], [201, "Forms"]);
+  check("an unknown category -> 400 naming the choices", [(await json(await editor(), "POST", "/api/links", { title: "A", url: "https://example.com", category: "Banana" })).status], [400]);
+  check("...with the message that lists the categories", (await json(await editor(), "POST", "/api/links", { title: "A", url: "https://example.com", category: "Banana" })).json().error, "category must be one of: General, Forms, Training, Suppliers");
+  const onlyForms = (await json(await editor(), "GET", "/api/links?category=Forms")).json().items;
+  check("?category=Forms lists only Forms", [onlyForms.length, onlyForms.every((l) => l.category === "Forms")], [1, true]);
+  check("?category=Nope lists nothing, not everything", (await json(await editor(), "GET", "/api/links?category=Nope")).json().items.length, 0);
+  const formPost = await request(`${portal.issuer}/links`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "title=Safety+course&url=https%3A%2F%2Fexample.com%2Fs&category=Training" });
+  check("the form's category field is saved", [formPost.status, (await json(await editor(), "GET", "/api/links?category=Training")).json().items.length], [303, 1]);
+  const selectHtml = (/<select id="category"[^>]*>([\s\S]*?)<\/select>/.exec((await request(`${portal.issuer}/`)).body) || [])[1] || "";
+  check("the page offers every category in a select", ["General", "Forms", "Training", "Suppliers"].every((c) => selectHtml.includes(`>${c}</option>`)), true);
+
+  // --- 8. A database that cannot be reached stops the app; it never falls back --
   const noDb = await startApp({ VMNODES_PORTAL_URL: portal.issuer, VMNODES_APP_ID: APP_ID, DATABASE_URL: "postgres://links@127.0.0.1:1/links" });
   check("with DATABASE_URL set and no database, the app refuses to START", noDb.exited !== undefined && noDb.exited !== 0, true);
   check("...and says it will not start without its database", /will not start without its database/.test(noDb.out()), true);
 
-  // --- 8. The count itself: zero checks run must never read as a pass ---------
-  const FLOOR = 20;
+  // --- 9. The count itself: zero checks run must never read as a pass ---------
+  const FLOOR = 30;
   if (pass + fail < FLOOR) { console.log(`FAIL only ${pass + fail} checks ran, expected at least ${FLOOR}`); fail++; }
   console.log(`\npassed=${pass} failed=${fail}`);
   finish(fail === 0 ? 0 : 1);
```

```bash
npm test
```

It worked when the last line is `passed=33 failed=0`, higher than the baseline.

## 6. Commit it, without pushing yet

```bash
git add -A
git commit -m "Add a category to each link"
```

It worked when `git status -sb` prints a first line that starts `## main` and says `ahead 1`, and no file is listed below it.

## 7. Try it on the data the old version made

Run the old version against a scratch database, add a link, then run the new version against the same database. Use an empty scratch database; [Test with a scratch database](test-with-a-scratch-database.md) starts one safely. `HEAD~1` is the commit before yours.

```bash
export DATABASE_URL=postgres://localhost/links_scratch
git checkout HEAD~1
npm run dev
```

In another terminal add a link, then stop `npm run dev` with Ctrl+C:

```bash
curl -s -X POST -H 'content-type: application/json' -d '{"title":"Old link","url":"https://example.com/old"}' http://127.0.0.1:4100/api/links
```

Go back to your commit, start `npm run dev` again, and list:

```bash
git switch -
npm run dev
```

```bash
curl -s http://127.0.0.1:4100/api/links
```

It worked when the old link comes back with `"category":"General"`. Add one with `"category":"Forms"`, then `curl -s 'http://127.0.0.1:4100/api/links?category=Forms'` lists only that one.

## 8. Put it on the default branch

```bash
git push
```

It worked when `git status -sb` prints a first line that starts `## main...origin/main` with no `ahead` after it. Use your repository's own default branch name if it is not `main`: an update reads only that branch.

## 9. Update the app

An administrator opens the app's **People** tab, finds the **Deployment** card and presses **Update to latest commit**.

It worked when the card reads "Updating to" and the new commit, then "Your app is now running the latest commit." Reload the app: the form has a **Category** choice, every link that was there before reads **General**, and `/health` shows `"version":"0.2.0"` with a `buildCommit` equal to your new `git rev-parse HEAD`.

If the update fails, the card reads "The update didn't go online, so your app is still running the previous version." and the old version keeps serving. Nothing was lost.

## 10. Go back if it is wrong

In **Console**, open the app's **Deployments** tab and press **Roll back to this** on the earlier deployment. It worked when `/health` shows `"version":"0.1.0"` and every link is still listed. The database keeps its new column. The old version never reads it, so it works against it.

Then fix the problem in a new commit and update again. Do not leave the repository's default branch holding a commit you rolled back, because the next **Update to latest commit** will put it live again.

## Check it works

1. Before the change, `npm test` ends `passed=25 failed=0`. After it, `passed=33 failed=0`.
2. The role list is untouched. This prints `unchanged`:

   ```bash
   git diff --exit-code HEAD~1 -- vmnodes.json && echo unchanged
   ```
3. With `npm run dev` running against a scratch database that version 1 filled, a link written by the old version reads `"category":"General"`, and a bad category is refused. This prints `{"error":"category must be one of: General, Forms, Training, Suppliers"}`:

   ```bash
   curl -s -X POST -H 'content-type: application/json' -d '{"title":"A","url":"https://example.com","category":"Banana"}' http://127.0.0.1:4100/api/links
   ```
4. After the update, `https://link-list.acme.vmnodes.com/health`, opened in the browser you are signed in with, shows `"version":"0.2.0"`, and its `buildCommit` equals the output of `git rev-parse HEAD`.
5. On the live app, the links that existed before the update are all listed and all read **General**. Add a link with the category **Forms**: choosing **Forms** in the filter row shows only it.

## Traps

- **Check what is live before you change anything.** The repository may be ahead of the app, and your update then puts live work you did not write. Compare `buildCommit` with `git rev-parse HEAD`.
- **Know whether the app keeps its data before you press the button.** Without `"database": true` an update clears everything the app held, and the **Deployment** card warns "Updating replaces your app's container. Anything not saved in its database is cleared." Read the card first.
- **Never rename or remove a role in use.** Taking a role out of `vmnodes.json` retires it, and a new name is held by nobody, so the people who used the app are locked out of everything that checks it. Add the new role, give it with **Change roles**, and retire the old one in a later update. See [Roles](../concepts/roles.md).
- **An update does not give anyone a role the new commit adds.** If you add a role, give it on the **People** tab with **Change roles**.
- **Change the database by adding to the end of `MIGRATIONS`.** Do not edit an entry that has shipped, and do not drop or rename a column. The rules and the test for them are in [Keep data through updates](keep-data-through-updates.md).
- **Give a new column a default.** `add column ... not null` with no default fails on a table that already has rows, and a failed change stops the app and the update.
- **Validate on the server.** The new `<select>` is a courtesy; a request that bypasses the form can send any category, so `server.js` checks the list.
- **Add a new file to the `Dockerfile`'s `COPY` line.** A file the server loads that is not copied builds, then fails with "Your app stopped while starting."
- **Do not change what the platform relies on.** Keep `GET /health` answering with no sign-in and the app listening on port 3000.
- **One thing per update.** A change you cannot undo alone, such as a drive-by fix mixed in, makes a roll back lose it too.
- **Only an administrator can press the button, one update at a time.** If an update is already running, wait for it.

## Related

- [Apps](../concepts/apps.md)
- [Keep data through updates](keep-data-through-updates.md)
- [Roles](../concepts/roles.md)
- [Troubleshooting](../troubleshooting.md)
