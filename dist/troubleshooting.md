# Troubleshooting

Search this page for the exact text you saw. Each entry gives the message, what it means, and what to do, and ends on how you know it is fixed. Messages are grouped by where they appear, and quoted exactly as VMnodes shows them; `<name>` stands for a value VMnodes fills in.

| You are looking at | Go to |
|---|---|
| The **Put an app online** form, before a launch starts | [On the New app form](#on-the-new-app-form) |
| A launch page with the badge **Not working** or **Starting** | [On the launch page](#on-the-launch-page) |
| The **Deployment** card after pressing **Update to latest commit** | [On the Update card](#on-the-update-card) |
| A build error your VMnodes contact read to you | [Build and deploy errors behind the generic sentences](#build-and-deploy-errors-behind-the-generic-sentences) |
| An app's **People** tab | [On the People tab](#on-the-people-tab) |
| An app's **Shares** tab | [In the Shares tab](#in-the-shares-tab) |
| A JSON error from `POST /v1/publish/entities` or `POST /v1/publish/records` | [From the publish API](#from-the-publish-api) |
| A JSON error from `POST /v1/data/query` | [From the query API](#from-the-query-api) |
| An exception thrown by `@vmnodes/identity` in your app | [In your app (from @vmnodes/identity)](#in-your-app-from-vmnodesidentity) |
| The portal or an app asking you to sign in | [When signing in](#when-signing-in) |

## On the New app form

The form is **Put an app online**. A refusal appears as a red notice at the top of the form, and nothing is launched. Only an org administrator can use the form.

### `You already have an app called <name>. Choose a different name.`

**What it means.** An app in your org already has that name.

**What to do.**

1. Type a different name in **App name**.
2. Press **Put it online**.

It worked when the launch page opens with the badge **Starting**.

### `A launch of <name> is already running. Wait for it to finish, then try again.`

**What it means.** An earlier launch of the same name has not finished.

**What to do.**

1. Do not press **Put it online** again for that name.
2. Open the running launch from Home and wait for its badge to change.

It worked when the badge reads **Working** or **Not working**. After **Not working**, press **Try again** on that launch page.

### `Must be 3 to 30 characters.`

**What it means.** The app name breaks one of the naming rules. This entry covers every message in the group:

- `Must be 3 to 30 characters.`
- `Must contain only lowercase letters, digits and hyphens.`
- `Must start with a letter.`
- `Must not start or end with a hyphen.`
- `Must not contain a doubled hyphen.`
- `Must not be a punycode label.` (a name that starts with `xn--`)
- `Must not be all digits.`

**What to do.**

1. Choose a name of 3 to 30 characters that uses only `a` to `z`, `0` to `9` and single hyphens, starts with a letter, does not end with a hyphen, does not start with `xn--` and is not only digits. For example `acme-notes`.
2. Type it in **App name** and press **Put it online**.

It worked when the launch page opens. The name becomes the first part of the app's address, `<app>.<org>.vmnodes.com`.

### `That name is reserved.`

**What it means.** The name belongs to the platform. Reserved names include `apps`, `api`, `www`, `admin`, `portal`, `auth`, `login`, `signup`, `start`, `connect`, `status`, `docs`, `help`, `support`, `billing`, `mail`, `cp`, `id`, `sso`, `static`, `cdn`, `assets`, `internal`, `test`, `dev`, `staging`, `prod`, `vmnodes`, and the names of connectors such as `xero`, `hubspot` and `salesforce`.

**What to do.**

1. Add a word to the name, for example `test-app` or `acme-docs`.
2. Press **Put it online**.

It worked when the launch page opens.

### `Use the repository's https address, for example https://github.com/you/app.`

**What it means.** The repository field is empty, is not an address, or does not start with `https:`. An ssh address such as `git@github.com:acme/notes` is refused. This entry also covers `a repository URL is required`.

**What to do.**

1. Paste the repository's `https://` address, for example `https://github.com/acme/acme-notes`.
2. Press **Put it online**.

It worked when the launch page opens.

### `Remove the username, password or token from the repository URL. Private repositories connect through GitHub instead.`

**What it means.** The address contains credentials, such as `https://user:token@example.com/acme/acme-notes`. VMnodes never stores credentials in a repository address.

**What to do.**

1. Remove everything before `github.com/`, so the address reads `https://github.com/acme/acme-notes`.
2. For a private repository, press **Connect GitHub** and grant VMnodes Builds access to it, then choose it from the repository list.

It worked when the launch page opens.

### `We can't read that repository. If it's private, connect GitHub first, then try again.`

**What it means.** VMnodes could not read the repository. It is private and GitHub is not connected, the address is misspelled, the repository was deleted or renamed, or GitHub access was removed after you connected. This sentence also appears on a launch page and on the Update card.

**What to do.**

1. Open the repository address in a private browser window. If it does not load, fix the spelling or the repository name.
2. If it asks you to sign in, the repository is private: press **Connect GitHub** on the **Put an app online** form and give VMnodes Builds access to this repository on GitHub.
3. Choose the repository from the list and press **Put it online**. On a failed launch press **Try again**.

It worked when the launch page opens and the badge reads **Starting**.

### `We couldn't load your repositories just now. Paste the address instead.`

**What it means.** GitHub is connected, but the list of repositories did not load.

**What to do.**

1. Paste the repository's `https://` address into the **Repository URL** field.
2. Press **Put it online**.

It worked when the launch page opens.

### `That GitHub connection link had expired or was already used. Press Connect GitHub to try again.`

**What it means.** The link GitHub sent you back with was used twice or took too long.

**What to do.** Press **Connect GitHub** and finish the GitHub steps once, without going back. It worked when the form shows `GitHub is connected.`

### `GitHub could not confirm that connection. Press Connect GitHub to try again.`

**What it means.** GitHub refused the connection check. The same sentence covers two different failures. This entry also covers `That installation could not be confirmed with GitHub. Press Connect GitHub to try again.`

**What to do.**

1. Press **Connect GitHub** again, signed in to the same GitHub account throughout.
2. If it fails a second time, contact your VMnodes contact with the time it happened.

It worked when the form shows `GitHub is connected.`

### `Your GitHub organisation owner needs to approve VMnodes Builds. Once they have, press Connect again.`

**What it means.** The GitHub organisation requires an owner to approve new apps.

**What to do.**

1. Ask a GitHub organisation owner to approve VMnodes Builds on GitHub.
2. Press **Connect GitHub** again.

It worked when the form shows `GitHub is connected.`

### `This GitHub account is already connected to a different organisation on VMnodes. Disconnect it there, or connect a different GitHub account.`

**What it means.** One GitHub account can belong to one VMnodes org.

**What to do.** Connect a different GitHub account, or paste the address of a public repository instead. If the account must move, ask your VMnodes contact. It worked when the form shows `GitHub is connected.`

### `Nothing to launch here`

**What it means.** You are signed in but are not an org administrator. The page adds `An administrator puts apps online for <org>.`

**What to do.** Ask an administrator to put the app online, or to make you one. It worked when you see **Put an app online** on Home.

### `cross-site request refused`

**What it means.** The browser showed this as a bare JSON body (`{"error":{"code":"api/forbidden","message":"cross-site request refused"}}`) with status 403 when you pressed a portal button. The request did not come from the org's own portal page: a form on another site, a proxy that rewrote the address, or a script that sent no `Origin` header.

**What to do.**

1. Press the button from the portal page itself, in a browser, at `https://apps.<org>.vmnodes.com`.
2. A script must send an `Origin` header equal to that portal address exactly, with the session cookie.

It worked when the button leads to the next portal page instead of JSON.

## On the launch page

A launch page opens after **Put it online**, at the address `https://apps.<org>.vmnodes.com/apps/<launch id>`. It reloads itself every few seconds. The badge reads **Starting**, then **Working** or **Not working**. When it reads **Working**, an **Open <app>** button appears.

The **Build log** disclosure shows only the current step: `Waiting to start…`, `Creating your application…`, `Building your image…`, `Checking your image for security issues…`, `Deploying your app…`, `Your app is live.` or `The launch failed.`. It never holds build output or the reason for a failure.

**Read this before anything else.** A failed launch shows a red sentence, and the page shows it as written only if it is one of the sentences below. Any other reason is replaced by a generic sentence. VMnodes builds the latest commit of the repository's default branch, so push each fix before you press **Try again**; **Try again** starts a new launch of the same name and repository.

| You see | Read the entry |
|---|---|
| `We couldn't read that repository or build it. Try again, or check the repository is public or GitHub is connected.` | generic: the build failed, reason hidden |
| `The launch failed. Try again, or contact support.` | generic: the launch failed before the build or after it, reason hidden |
| `Your app stopped while starting.` | specific |
| `Your app started but isn't answering on port 3000. Check it listens on port 3000.` | specific |
| `We can't read that repository. If it's private, connect GitHub first, then try again.` | [on the form](#we-cant-read-that-repository-if-its-private-connect-github-first-then-try-again) |
| `You already have an app called <name>. Choose a different name.` and `A launch of <name> is already running. Wait for it to finish, then try again.` | [on the form](#you-already-have-an-app-called-choose-a-different-name) |
| Eight security-check sentences, from `Your app's image contains your repository's history (.git)` to `We lost track of your app's image before its security check finished. Start it again.` | specific, below |
| `This launch did not finish confirming your app in time. Check its status and try again.` | specific |
| `The platform restarted while this launch was running. Start it again.` | specific |
| `Something went wrong on our side during this launch. Start it again.` | specific |
| `We couldn't find the latest commit to update to, so nothing was built. Try again.` | [on the Update card](#we-couldnt-find-the-latest-commit-to-update-to-so-nothing-was-built-try-again) |

Those are the only sentences a failed launch page or Update card shows as written. The reason for anything else is stored but not shown, so every other build error in this page (a bad `vmnodes.json`, a missing `package-lock.json`, a `start` script that is not `node <file>`, a failing `Dockerfile`) reaches you only as one of the two generic sentences.

### `We couldn't read that repository or build it. Try again, or check the repository is public or GitHub is connected.`

**What it means.** The launch stopped after your app was created and before an image was built, and the page cannot show the real reason. The repository is usually fine: the advice in the sentence is wrong for nearly every build failure. The real reason is one of the causes below.

**What to do.** From the root of your repository on your computer, check these in order. Each check says what a problem looks like. Fix what fails, then commit and push to the default branch.

1. **Your `Dockerfile` does not build.** If the repository root holds a `Dockerfile`, build it the way the platform does:

   ```bash
   docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD) -t acme-notes .
   ```

   A failing `RUN` line, a `COPY` of a file that is not committed (check with `git ls-files <file>`), a bad `FROM`, or a base image running an end-of-life Node release stops it. Fix the step that fails until the command exits 0.

2. **No `Dockerfile`, and the Node project is not ready.** Without a `Dockerfile`, a Node project builds only if all of these hold:
   - `package-lock.json` is committed. A repository with only `yarn.lock` or `pnpm-lock.yaml` fails; run `npm install`, delete the other lock file and commit `package-lock.json`.
   - `scripts.start` in `package.json` is exactly `node <file>` with one file, for example `node server.js`, or `main` names a file that exists. `npm run serve`, `next start` and `node --enable-source-maps server.js` all fail. Check with `node -p "require('./package.json').scripts.start"`.

   For anything else, add a `Dockerfile`.

3. **`vmnodes.json` is invalid.** Check it parses, then compare it with [`vmnodes.json`](reference/vmnodes-json.md):

   ```bash
   node -e "JSON.parse(require('fs').readFileSync('vmnodes.json','utf8'))"; echo "exit=$?"
   ```

   It parses when this prints `exit=0`. A comment, a trailing comma, or a byte-order mark at the start of the file fails. The file may hold only `apiVersion` (`"vmnodes.com/v1"`), `roles`, `database` and `publishes`; any other key fails the build.

4. **The app is not at the top of the repository.** `Dockerfile` or `package.json` must sit at the repository root, not in a subfolder:

   ```bash
   ls Dockerfile package.json
   ```

5. **`node_modules` is committed.** The build refuses a repository that carries installed packages unless `.dockerignore` excludes them:

   ```bash
   git ls-files node_modules | wc -l
   ```

   It must print `0`. If it prints more, run `git rm -r --cached node_modules` and add `node_modules` to `.gitignore`, or add `**/node_modules` to a `.dockerignore` at the repository root.

6. **The language needs a `Dockerfile`.** Go, Java, Ruby and any other language not listed above build only from a `Dockerfile`. Add a `Dockerfile` for Python too.

7. **The repository changed.** Open its address in a private browser window. If it was renamed, made private, or GitHub access to it was removed, see `We can't read that repository.` above.

If every check passes, press **Try again** once. If the same sentence returns, contact your VMnodes contact with the app name, the time it happened and the launch page address.
It worked when the badge reads **Working** and an **Open <app>** button appears.

### `The launch failed. Try again, or contact support.`

**What it means.** The launch failed before your app was created, or after its image was built, and the page cannot show the real reason. A failure inside your app reads `Your app stopped while starting.` or `Your app started but isn't answering on port 3000. Check it listens on port 3000.`, so this sentence usually points at the platform side.

**What to do.** The likely causes, most likely first:

1. **Your org's host is not ready, or stopped reporting.** Likely right after **Get compute**, or if the host has stopped reporting. Wait a few minutes, then press **Try again**.
2. **The database was not ready in time.** Only possible if `vmnodes.json` holds `"database": true`. Press **Try again**.
3. **A token for `publishes` could not be issued.** Only possible if `publishes` in `vmnodes.json` is not empty. Press **Try again**.
4. **The deployment did not finish in 15 minutes.** The host stopped answering. Press **Try again** once the host is back.

From outside you cannot tell these apart, but you can rule your own app out: build and run it as in `Your app stopped while starting.` below. If it answers `/health` locally, the cause is on the platform side.

Press **Try again** once. If the same sentence returns, contact your VMnodes contact with the app name and the time it happened. Section [Build and deploy errors behind the generic sentences](#build-and-deploy-errors-behind-the-generic-sentences) lists what they may read back to you.

It worked when the badge reads **Working** and an **Open <app>** button appears.

### `Your app stopped while starting.`

**What it means.** The app's container started, then exited before it answered. VMnodes checks every 2 seconds for up to 60 seconds, and a container that has exited ends the wait at once. The page gives no exit code and no log.

**What to do.**

1. Build and run the same image on your computer, with the settings the platform provides:

   ```bash
   docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD) -t acme-notes .
   docker run --rm -p 3000:3000 \
     -e VMNODES_APP_ID=app_local -e VMNODES_APP_NAME=acme-notes \
     -e VMNODES_PORTAL_URL=http://127.0.0.1:1 -e VMNODES_ISSUER_URL=http://127.0.0.1:1 \
     acme-notes
   ```

2. Read what the container prints before it exits. Common causes:
   - an uncaught exception at start, or a `require` of a package that `npm ci --omit=dev` did not install because it is in `devDependencies`;
   - a setting your code needs that the platform does not provide. The platform provides `VMNODES_APP_ID`, `VMNODES_APP_NAME`, `VMNODES_ENVIRONMENT`, `VMNODES_PORTAL_URL` and `VMNODES_ISSUER_URL`; `DATABASE_URL` when `vmnodes.json` has `"database": true`; and `VMNODES_API_URL` with `VMNODES_PUBLISH_TOKEN` when `publishes` is not empty. Nothing else. See [Environment](reference/environment.md);
   - a program that finishes instead of staying up, or a wrong `CMD` in the `Dockerfile`.
3. Fix it, commit, push, and press **Try again**.

It worked when the container keeps running on your computer and the badge reads **Working**.

### `Your app started but isn't answering on port 3000. Check it listens on port 3000.`

**What it means.** The container is running, but nothing answered on port 3000 within 60 seconds. VMnodes asks `GET /health`. If that returns 404 it asks `GET /`. Any status below 500 on the path it settles on counts as up; 500 and above, a refused connection and a timeout count as down.

**What to do.** Check all five, in this order:

1. **Listen on port 3000.** VMnodes does not set `PORT` and does not look for another port. Use `process.env.PORT || 3000` or just `3000`.
2. **Listen on all addresses, `0.0.0.0`, not `127.0.0.1` or `localhost`.** In Node, `server.listen(3000)` is right and `server.listen(3000, "127.0.0.1")` is wrong. Flask and uvicorn default to `127.0.0.1`; set `host="0.0.0.0"`.
3. **Answer `GET /health` without a signed-in person.** The platform asks directly and sends no identity header. Return `200` from `/health` and do not call `currentUser` there; a handler that throws returns 500, which counts as down.
4. **Start listening within 60 seconds.** Open the port first, then do slow set-up.
5. **Stay up** (see `Your app stopped while starting.` above).

Test it the way the platform does:

```bash
docker run --rm -p 3000:3000 \
  -e VMNODES_APP_ID=app_local -e VMNODES_APP_NAME=acme-notes \
  -e VMNODES_PORTAL_URL=http://127.0.0.1:1 -e VMNODES_ISSUER_URL=http://127.0.0.1:1 \
  acme-notes
```

In a second terminal run `curl -i http://127.0.0.1:3000/health`. It is right when the first line reads `HTTP/1.1 200 OK`. `Connection refused` or `Empty reply from server` means the app is not on port 3000 or is bound to `127.0.0.1`.

Fix it, commit, push, and press **Try again**. It worked when the badge reads **Working**.

### `Your app's image contains your repository's history (.git), which can expose deleted secrets. It was not started.`

**What it means.** Your `Dockerfile` copied the whole repository, `.git` folder included, into the image. Anyone who could read the image could recover files you deleted, including secrets.

**What to do.**

1. Add a `.dockerignore` file at the repository root containing the line `.git`, or change `COPY . .` to copy only the files the app needs, as the starter does.
2. Rotate any secret that was ever committed.
3. Commit, push, and press **Try again**.

It worked when the launch passes the security check and the badge reads **Working**.

### `We found serious security problems in the software your app is built on, so it is not online. Update your app's packages to newer versions, then start it again.`

**What it means.** The scan found at least one CRITICAL vulnerability in the image's operating-system packages or your dependencies. The page does not name it.

**What to do.**

1. Scan the image yourself. VMnodes uses Trivy: `trivy image --severity CRITICAL,HIGH acme-notes`.
2. Update what it names: use a newer base image in `FROM`, run `npm update` and commit `package-lock.json`.
3. Rebuild, scan again, commit, push, and press **Try again**.

It worked when `trivy` reports no CRITICAL finding and the badge reads **Working**. Findings of HIGH severity do not block a launch.

### `We could not finish checking your app for security problems, so it is not online. Start it again.`

**What it means.** The scanner failed on the image. This is not a finding about your app. The same applies to `Your app has not passed its security check, so it is not online. Start it again.`

**What to do.** Press **Try again**. If the same sentence returns, contact your VMnodes contact with the app name and the time it happened. It worked when the badge reads **Working**.

### `We couldn't read your app's image to check it, so it was not started. Try again in a few minutes.`

**What it means.** The platform could not read the image's layers to scan it. This is on the platform side.

**What to do.** Wait a few minutes and press **Try again**. It worked when the badge reads **Working**.

### `We're still checking your app's image, so it was not started. Try again in a minute.`

**What it means.** The security scan had not finished when the deploy began. This entry also covers `The security check on your app's image did not finish. Start it again.`, which means the scan took longer than 10 minutes, and `We lost track of your app's image before its security check finished. Start it again.`, which means the image record disappeared during the wait.

**What to do.** Wait a minute and press **Try again**. It worked when the badge reads **Working**.

### `This launch did not finish confirming your app in time. Check its status and try again.`

**What it means.** The app was deployed but the platform never recorded whether it answered.

**What to do.**

1. Open `https://<app>.<org>.vmnodes.com` in a browser. If it loads, the app is running and only the launch record is late.
2. If it does not load, press **Try again**.

It worked when the badge reads **Working**.

### `The platform restarted while this launch was running. Start it again.`

**What it means.** VMnodes restarted mid-launch. It is not a problem with your app.

**What to do.** Press **Try again**. It worked when the badge reads **Working**. This entry also covers `Something went wrong on our side during this launch. Start it again.`; if that one returns twice, contact your VMnodes contact with the time it happened.

### `Your app is live, but your access to it couldn't be set up. Press Try again. If it keeps failing, contact support.`

**What it means.** The app is running, but VMnodes could not give you access to it, so the gateway would refuse you at the app's address.

**What to do.** Press **Try again** on the launch page. If it fails again, contact your VMnodes contact. It worked when the page shows **Open <app>** and the address loads without a `Not authorised` page.

### `Your app is live, but these roles couldn't be given to you yet: <roles>. Press Try again.`

**What it means.** The app is running, but one or more roles it declares were not given to you.

**What to do.** Press **Try again** next to the sentence. It worked when the page reads `You have every role <app> declares: <roles>.`

### `Your app mentions roles (<roles>) but doesn't declare them in vmnodes.json, so nobody can be given them. Add a vmnodes.json — see the guide.`

**What it means.** The repository's `manifest.json` names role templates that `vmnodes.json` does not declare. Only roles declared in `vmnodes.json` can be given to people.

**What to do.**

1. Add each role to `roles` in `vmnodes.json`, with a `name` and a plain-English `description`:

   ```json
   {
     "apiVersion": "vmnodes.com/v1",
     "roles": [{ "name": "notes.editor", "description": "Can post and edit notes." }]
   }
   ```

   [`vmnodes.json`](reference/vmnodes-json.md) lists every key.
2. Commit, push and press **Update to latest commit** on the **People** tab. An update does not give newly declared roles to anyone: open **Change roles** for each person.

It worked when **Change roles** lists the role.

### `Your app is online, but some of the software it's built on has a known security problem (1 serious). Updating its packages will fix most of them.`

**What it means.** The app is running. The scan found a HIGH finding but no CRITICAL one. With more than one it reads `has known security problems (<n> serious)`.

**What to do.** Update the base image and dependencies as in the `We found serious security problems` entry, then press **Update to latest commit**. It worked when the warning no longer appears.

## On the Update card

The card is headed **Deployment** and sits on the **People** tab of the app. It shows `Current commit:` and the button **Update to latest commit**. Updating rebuilds the head of the repository's default branch, checks it, deploys it and waits for it to answer. If anything fails, the previous version keeps running. It worked when the card reads `Your app is now running the latest commit.`

### `The update didn't go online, so your app is still running the previous version.`

**What it means.** The update failed. The card shows this sentence followed by the reason, and the reason is one of the sentences from [On the launch page](#on-the-launch-page); anything else is replaced by one of the two generic sentences. If no reason follows, it reads `Start it again.`

**What to do.**

1. Read the sentence after the prefix and find it under [On the launch page](#on-the-launch-page). The generic ones are `We couldn't read that repository or build it. Try again, or check the repository is public or GitHub is connected.` and `The launch failed. Try again, or contact support.`
2. After a push that broke the build, run the checks under the first generic sentence on the new commit, or undo the commit with `git revert <commit>` and push.
3. Press **Update to latest commit** again.

It worked when the card reads `Your app is now running the latest commit.`

### `We couldn't find the latest commit to update to, so nothing was built. Try again.`

**What it means.** VMnodes could not read the head of the repository's default branch. The repository was renamed or made private, or GitHub access was removed.

**What to do.**

1. Open the repository's address in a private browser window and check it loads, or that GitHub is still connected.
2. Press **Update to latest commit** again.

It worked when the card shows `Updating to <commit>… This page updates by itself.` and then `Your app is now running the latest commit.`

### `The update didn't start. Try again.`

**What it means.** Pressing **Update to latest commit** was refused and no more specific sentence applies, for example because an update was already starting.

**What to do.** Wait a few seconds, reload the **People** tab, and press **Update to latest commit** again. It worked when the card shows `Updating to <commit>…`.

### `This app already deploys from a repository. Use Update to latest commit.`

**What it means.** You used the **Deploy from this repository** form on an app that already has a repository on record.

**What to do.** Press **Update to latest commit** instead. It worked when the card shows `Updating to <commit>…`.

### `This app isn't running yet, so there is nothing to update. Put it online from New app instead.`

**What it means.** The app has never been online, so there is nothing to update.

**What to do.** Open Home, press **Put an app online** and launch it. It worked when the launch page reads **Working**.

### `Use the repository's https address, for example https://github.com/you/app, with no username, password or token in it.`

**What it means.** The address in the **Deploy from this repository** form is empty or invalid.

**What to do.** Paste the repository's `https://` address with no credentials, then press **Deploy from this repository**. It worked when the card shows `Updating to <commit>…`.

### `This app has no repository on record, so it can't be updated yet. Name the repository it comes from to deploy its latest commit; after that, Update to latest commit works as usual.`

**What it means.** The app was created without a launch from a repository, so the platform does not know where to read its code.

**What to do.**

1. Paste the repository's `https://` address into **Repository** on the card.
2. Press **Deploy from this repository**.

It worked when the card shows `Updating to <commit>…` and then `Your app is now running the latest commit.` From then on **Update to latest commit** works as usual.

### `Updating replaces your app's container. Anything not saved in its database is cleared.`

**What it means.** This is a warning, not an error. The app has no database, so anything it kept in memory or on the container's disk is lost on update.

**What to do.** To keep data across updates, add `"database": true` to `vmnodes.json`, read `DATABASE_URL` in the app, and put the update through. See [`vmnodes.json`](reference/vmnodes-json.md). It worked when the warning no longer appears beside the button.

### `an organisation administrator updates this app`

**What it means.** A signed-in person who is not an org administrator pressed **Update to latest commit**. The browser showed bare JSON with status 403. This entry also covers `an organisation administrator deploys this app` for **Deploy from this repository**.

**What to do.** Ask an org administrator to run the update, or to make you one. It worked when the card shows `Updating to <commit>…`.

## Build and deploy errors behind the generic sentences

The launch page never shows these, but your VMnodes contact can read them from the launch's record, and `POST /v1/applications/<appId>/builds` returns the build ones to a caller with an API token. When your contact reads you one, find it here. Each fix is made in your repository; commit, push, then press **Try again** or **Update to latest commit**.

### `vmnodes.json is not valid JSON`

**What it means.** The file does not parse. A comment, a trailing comma or a byte-order mark at the start of the file does this. The message names no position.

**What to do.**

1. Run `node -e "JSON.parse(require('fs').readFileSync('vmnodes.json','utf8'))"; echo "exit=$?"`.
2. Fix what it points at and run it again until it prints `exit=0`.

It worked when the launch page reads **Working**.

### `vmnodes.json declares an unknown key '<key>' — only 'apiVersion', 'roles', 'database', 'publishes' are recognised here`

**What it means.** The file has a top-level key VMnodes does not read, such as `name`, `port`, `env` or `permissions`. This entry covers the whole group of file-shape messages:

- `vmnodes.json apiVersion must be 'vmnodes.com/v1', got <json>`
- `vmnodes.json 'database' must be true or false, got <json>`
- `vmnodes.json must be a JSON object`
- `vmnodes.json 'roles' must be an array`
- `roles[<i>] must be an object with 'name' and 'description'`
- `roles[<i>].name must be a string`
- `roles[<i>] declares '<name>' a second time — each role is declared once`
- `vmnodes.json 'publishes' must be an array`
- `publishes[<i>] must be a string`
- `publishes[<i>] declares '<entry>' a second time — each entity is declared once`
- `vmnodes.json must be a regular file, not a symlink or directory`
- `vmnodes.json is larger than 64 KiB`

**What to do.** Make the file match [`vmnodes.json`](reference/vmnodes-json.md): only the keys `apiVersion`, `roles`, `database` and `publishes`, with `"apiVersion": "vmnodes.com/v1"`, `database` as `true` or `false`, `roles` as an array of `{ "name", "description" }`, `publishes` as an array of strings, each role and entry once, a regular file under 64 KiB. It worked when the launch page reads **Working**.

### `roles[<i>] ('<name>') is not a usable role name: <problem>`

**What it means.** A role name breaks the naming rule: `role names are lowercase kebab-case, optionally namespaced with one dot`. Each part must be a lowercase letter followed by 1 to 30 lowercase letters, digits or hyphens, so `a` and `Admin` and `admin_user` fail.

**What to do.** Rename role number `<i>` (counting from 0) to something like `editor` or `notes.approver`. It worked when the launch page reads **Working**.

### `roles[<i>] ('<name>') has no description — every role shown to a human needs a plain-English consequence`

**What it means.** A role has no `description`.

**What to do.** Add a `description` saying what holding the role lets a person do, for example `"Can approve expense claims."`. It worked when the launch page reads **Working**.

### `publishes[<i>] ('<entry>') is not a usable publishes entry: <problem>`

**What it means.** A `publishes` entry is not written `<name>/v<N>`. The problem says which rule failed; the likely ones are `has no version`, `has a dot in its local name`, `the local name must be lowercase, starting with a letter, then lowercase letters, digits or hyphens`, `the version must be 'vN' with N a whole number`, `the version must not have a leading zero` and `the version must be a positive integer`.

**What to do.** Write each entry as the local name and a version, with no app name in front: `"note/v1"`, not `"acme-notes.note/v1"` and not `"note"`. It worked when the launch page reads **Working**.

### `Your repository has no package-lock.json file, so there is no exact list of dependency versions to install.`

**What it means.** A Node repository with no `Dockerfile` needs `package-lock.json`. The message continues with the fix. This entry also covers the two messages that begin `Your repository has a yarn.lock file, but this platform installs dependencies with npm` and `Your repository has a pnpm-lock.yaml file, but this platform installs dependencies with npm`.

**What to do.**

1. Run `npm install` in the project, and for yarn or pnpm delete `yarn.lock` or `pnpm-lock.yaml`.
2. Commit `package-lock.json` and push.

It worked when the launch page reads **Working**.

### `Your package.json does not say how to start your app.`

**What it means.** With no `Dockerfile`, `scripts.start` must be exactly `node <file>`, or `main` must name a file that exists.

**What to do.** Set `"start": "node server.js"` with your entry file, or add a `Dockerfile` for anything more elaborate. It worked when the launch page reads **Working**.

### `Your repository includes <a folder|folders> of installed packages (<folders>).`

**What it means.** `node_modules` or a similar folder is committed. The build would copy it over the exact versions in your lock file. The message ends `Nothing was built.`

**What to do.** Add `**/node_modules` to a `.dockerignore` at the repository root, or stop committing the folder (`git rm -r --cached node_modules`). It worked when the launch page reads **Working**.

### `no Dockerfile, and no recognisable Node (package.json) or Python (requirements.txt, pyproject.toml or Pipfile) project at the repository root. Nothing was built.`

**What it means.** The repository root holds no `Dockerfile` and no `package.json`. The app may be in a subfolder, or written in another language.

**What to do.** Put a `Dockerfile` or a `package.json` at the top of the repository. A `Dockerfile` works for any language. It worked when the launch page reads **Working**.

### `Node <cycle> reached end of life on <date> and gets no security fixes.`

**What it means.** The base image runs a Node release that no longer gets fixes. The message names the releases to move to. This entry also covers `Node <version> is below the required security floor <floor>.` and the same wording for Python.

**What to do.** Change the `FROM` line of your `Dockerfile` to a supported release, rebuild, and push. The lines `Node <cycle>'s cycle is not in our end-of-life table` and `The runtime was not identified: no supported Node or Python installation was found inside the built image.` are notes, not errors, and need no action. It worked when the launch page reads **Working**.

### `Commit <sha> was not found in this repository's default branch, so nothing was built. Start it again.`

**What it means.** An update named a commit that is not on the default branch, for example after a force push.

**What to do.** Push your work to the repository's default branch, then press **Update to latest commit**, which resolves the current head. It worked when the card reads `Your app is now running the latest commit.`

### `ACR run <runId> ended <status>`

**What it means.** The image build failed on a step in your `Dockerfile`. The message continues with a log command only your VMnodes contact can run, and the build output is not shown.

**What to do.**

1. Reproduce the build on your computer: `docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD) -t acme-notes .`
2. Fix the step that fails, commit and push.

It worked when the launch page reads **Working**. This entry also covers a raw tail of `docker build` output, which means the same thing. `ACR run <runId> did not finish within <n> minutes` means the build was too slow: cache dependency installs and drop large downloads.

### `this repository needs a Nixpacks build (no Dockerfile at the root), and the dev-grade socket builder does not run Nixpacks`

**What it means.** The repository is a Python project with no `Dockerfile`, and this VMnodes host's builder cannot build Python without one. The message goes on to name a setting that only your VMnodes contact controls; you cannot change it.

**What to do.** Add a `Dockerfile` at the top of the repository, commit, push and press **Try again**. It worked when the launch page reads **Working**.

### `Your app's database didn't finish setting up, so nothing was started. Try again.`

**What it means.** `vmnodes.json` has `"database": true` and the database was not ready after 2 minutes. This entry also covers `Your app's database could not be set up, so nothing was started. Try again.`

**What to do.** Press **Try again**. If it fails again, contact your VMnodes contact with the app name and the time it happened. If another app in your org has a name that becomes the same database name (for example `my-app` and `my_app`), rename one of them. It worked when the launch page reads **Working**.

### `Your app's publish token could not be issued and delivered, so nothing was started. Try again.`

**What it means.** `publishes` in `vmnodes.json` is not empty, and VMnodes could not create and deliver the token the app uses to publish.

**What to do.** Press **Try again**. If it fails twice, contact your VMnodes contact with the app name and the time. It worked when the launch page reads **Working**.

### `timed out — command not completed within 15 minutes`

**What it means.** The deployment did not finish in 15 minutes, usually because the host stopped answering. It does not say whether the app started.

**What to do.** Press **Try again**. If the host stays offline, contact your VMnodes contact. It worked when the launch page reads **Working**.

### `no healthy host with a live node available`

**What it means.** Your org has no host that is ready: it is still starting, or it failed to start.

**What to do.** Wait until your org's host is ready, or ask your VMnodes contact. It worked when **Put an app online** accepts a name and the launch page opens at **Starting**.

## On the People tab

The **People** tab lists the people in your org, the roles the app declares, and the **Deployment** card (see [On the Update card](#on-the-update-card)). Only org administrators see it; any other member sees the **Overview** tab only.

### `No roles yet`

**What it means.** The page reads `<App> has not declared any roles, so there is nothing to assign here.` The app's `vmnodes.json` has no `roles`.

**What to do.**

1. Add the roles to `vmnodes.json`:

   ```json
   {
     "apiVersion": "vmnodes.com/v1",
     "roles": [
       { "name": "notes.editor", "description": "Can post and edit notes." }
     ]
   }
   ```

2. Commit, push and press **Update to latest commit**.

It worked when the tab lists the role and each person has a **Change roles** button.

### `<role> is now assigned to <person>.`

**What it means.** The assignment took effect. If it did not, the page reads `That didn't work: <role> isn't assigned to <person>. Try again.`, and for removing a role, `That didn't work: <person> still has <role>. Try again.`

**What to do.** After the failure sentence:

1. Open **Change roles** for that person and tick or untick the role again, then press **Save roles**.
2. If a role was dropped from `vmnodes.json` in a recent update, it can no longer be assigned. Add it back and update the app.

It worked when the page reads `<role> is now assigned to <person>.` or `<role> is no longer assigned to <person>.`

### `That didn't work: <group> isn't attached. Try again.`

**What it means.** **Attach group** did not take effect. The role chosen with the group may have been retired a moment ago.

**What to do.** Pick the group and a current role again and press **Attach group**. It worked when the page reads `<group> is attached. Everyone in it can open <app>.`

### `<org> has no groups yet.`

**What it means.** The **Groups** section can attach an existing group but cannot create one.

**What to do.** Ask your VMnodes contact to create the group, then reload the tab. It worked when the **Group** list shows it.

### `<n> person holds a role your app no longer uses`

**What it means.** The page reads `<n> people hold roles your app no longer uses` for more than one. An update removed a role from `vmnodes.json`, and these people still hold it. They keep their access to the app, and the role is not sent to the app any more.

**What to do.** Follow the link, read the list, and press **Clear all <n>** to remove the retired roles from those people. Or re-add the role to `vmnodes.json`, update the app, and press **Give it back to <n> people who had it**. It worked when the notice is gone.

### `role '<name>' is retired and cannot be assigned`

**What it means.** The browser showed bare JSON, `{"error":{"code":"identity/role-retired","message":"..."}}`, with status 400. The role is no longer declared by the live version of the app. This entry also covers `role '<name>' is retired and cannot be given back`.

**What to do.** Add the role back to `vmnodes.json`, press **Update to latest commit**, then assign it again. It worked when **Change roles** lists the role and **Save roles** returns to the tab.

### `Nothing to see here`

**What it means.** The page adds `An administrator manages people and roles for <org>.` You are signed in but are not an org administrator.

**What to do.** Ask an administrator to make the change, or to make you one. It worked when you can open the **People** tab. For `cross-site request refused` see [On the New app form](#cross-site-request-refused).

## In the Shares tab

The **Shares** tab lists the records the app publishes and, for each field, a **Turn on** or **Turn off** button. Fields start off. Only org administrators see the tab.

### `Your app doesn't share anything yet.`

**What it means.** The app has not registered anything to share. The page adds `When it publishes data, such as bookings, it appears here, and you choose which parts other apps can read.`

**What to do.**

1. List what the app shares in `vmnodes.json`, for example `"publishes": ["note/v1"]`.
2. Push, update the app, and wait until the badge reads **Working**.
3. Make the running app call `POST /v1/publish/entities`, then `POST /v1/publish/records`, with the token in `VMNODES_PUBLISH_TOKEN`. See [Publish API](reference/publish-api.md).

It worked when a card for the entity appears on the tab.

### `<n> fields are waiting for your decision.`

**What it means.** The page reads `1 field is waiting for your decision.` for one. Fields that the app published are not shared until an administrator turns them on.

**What to do.** Press **Turn on** beside each field you want other apps to read, then press **Share <field>** to confirm. **Turn off** removes the values already stored for that field. It worked when the line is gone.

### `Nobody can read this yet. Apps that ask for it will appear here once you approve them.`

**What it means.** No other app has been given access to the records. This is not a fault. Giving an app access needs your VMnodes contact today.

**What to do.** Nothing, unless you want another app to read the records: ask your VMnodes contact. It worked when the app appears under **Who can read this**.

### `Nothing to share here`

**What it means.** The page adds `An administrator can see what your apps share for <org>.` You are not an org administrator.

**What to do.** Ask an administrator. It worked when the **Shares** tab opens. This also covers `Nothing to see here` with `An administrator decides what <org>'s apps share.`, shown when a non-administrator presses a button.

## From the publish API

Both publish calls take `Authorization: Bearer <token>`, where the token is the value of `VMNODES_PUBLISH_TOKEN` in your running app, and go to `VMNODES_API_URL`. The platform sets both only when `publishes` in `vmnodes.json` is not empty and only in the app's production deployment. Every error is a JSON body, `{"error":{"code":"<code>","message":"<message>"}}`. The status is 401, 403, 404 or 500 where an entry says so, and 422 otherwise. Search for the code too.

### `a valid API token is required`

**What it means.** Status 401, code `auth/unauthorised`. The request had no `Authorization: Bearer` header, or the token is wrong or no longer valid.

**What to do.**

1. Send the header `Authorization: Bearer <value of VMNODES_PUBLISH_TOKEN>`.
2. Check the app is running its production deployment, where the platform sets the token, and that `publishes` in `vmnodes.json` is not empty.

It worked when the call returns 201 or 200 instead of 401.

### `publishing needs a workload token bound to an application`

**What it means.** Status 403, code `publish/workload-token-required`. The token is not an app's own publish token.

**What to do.** Use `VMNODES_PUBLISH_TOKEN` from the app's environment, not a personal token. It worked when the call returns 201 or 200.

### `'<entity>' at version <n> cannot be registered: no live deployment.`

**What it means.** Code `publish/not-declared`. The message continues `vmnodes.json's "publishes" must list "<local>/v<n>" once this application has one.` The call came before the app's first deployment was live, which happens when the app registers at start-up: the platform is still waiting for the app to answer, so it is not live yet. The entry may already be listed correctly.

**What to do.**

1. Do not register in start-up code. Register after the app is running, and retry with a pause if the call fails.
2. Check `publishes` lists `"<local>/v<n>"`.

It worked when `POST /v1/publish/entities` returns 201.

### `'<entity>' at version <n> is not declared on the live deployment`

**What it means.** Code `publish/not-declared`. The live version of the app does not list this entity and version in `publishes`. The message continues `— vmnodes.json's "publishes" must list "<local>/v<n>".` This entry also covers `'<entity>' at version <n> cannot be registered: the live deployment's image recorded no publishes list`, which means the live version was built before `publishes` was read.

**What to do.**

1. Add `"<local>/v<n>"` to `publishes` in `vmnodes.json`, for example `"note/v1"`.
2. Commit, push, press **Update to latest commit**, and register again.

It worked when `POST /v1/publish/entities` returns 201.

### `applications publish only in their own namespace — '<entity>' must start with '<appName>.'`

**What it means.** Code `publish/namespace-denied`. The entity must start with the name you gave the app in **App name**. In `vmnodes.json` you list `note/v1`; in the API call you send `<app name>.note`. Sample code that hard-codes another name fails.

**What to do.** Build the entity as `<name>.note`, taking `<name>` from `VMNODES_APP_NAME`. It worked when the call returns 201.

### `entity names are namespace.name, lowercase, with NO version suffix — '<entity>' is not one.`

**What it means.** Code `data/bad-entity-name`. You sent something like `acme-notes.note/v1` as the entity.

**What to do.** Send `"entity": "acme-notes.note"` and `"version": 1` as separate fields. It worked when the call returns 201.

### `description is required — it is what a human reads when deciding whether to grant access to this dataset`

**What it means.** The registration body is incomplete. This entry covers the group:

- `queryableFields must list at least one field — an entity nobody can query is not publishable`
- `every queryable field needs a name`
- `field '<name>' has type '<type>' — must be string, number, boolean or timestamp`
- `grain names <fields>, which are not queryable fields on this entity`

**What to do.** Send a plain-English `description`, at least one `{ "name", "type" }` entry in `queryableFields` with `type` one of `string`, `number`, `boolean` or `timestamp`, and a `grain` (if any) that names only fields in `queryableFields`. It worked when the call returns 201.

### `register '<entity>' before publishing to it`

**What it means.** Code `publish/unknown-entity`. You posted records before registering the entity.

**What to do.** Call `POST /v1/publish/entities` for the entity first, then `POST /v1/publish/records`. It worked when `POST /v1/publish/records` returns 200 with a count of `upserted` records.

### `This app no longer shares '<entity>'. Nothing new is accepted for it.`

**What it means.** Code `publish/retired`. A later deploy stopped listing the entity in `publishes`.

**What to do.** Add `"<local>/v<n>"` back to `publishes`, push, press **Update to latest commit**, register the entity again, then publish. It worked when `POST /v1/publish/records` returns 200.

### `'<entity>' belongs to a different source`

**What it means.** Code `publish/entity-owned-elsewhere`. Another source already owns that entity name.

**What to do.** Choose a different local name in your own namespace, update `publishes`, and register again. It worked when the call returns 201.

### `publish at most 1000 records per call`

**What it means.** Code `publish/too-many-records`.

**What to do.** Send batches of at most 1000 records. It worked when each call returns 200.

### `no such resource`

**What it means.** Status 404, code `api/not-found`. The id does not exist, or belongs to another org. The two cases read the same on purpose.

**What to do.** Check the id is complete and copied from your own response. It worked when the call returns 200.

### `the platform failed handling this request. Quote reference <req.id> — the detail is in the platform log, deliberately not in this response.`

**What it means.** Status 500, code `internal`. The platform failed, not your request.

**What to do.** Retry once. If it fails again, give your VMnodes contact the reference and the time it happened. It worked when the call succeeds.

## From the query API

Reading shared records uses `POST /v1/data/query` and the calls beside it, with `Authorization: Bearer <token>`. An app sees only entities it has been granted, and creating a grant needs your VMnodes contact today.


The generic errors, `a valid API token is required` and `no such resource`, are explained under [From the publish API](#from-the-publish-api).

### `no query access to '<entity>'`

**What it means.** Status 422, code `data/denied`. It also reads `no aggregate access to '<entity>'` for an aggregate. The entity does not exist, is not granted to your app, or has no fields turned on. All three read the same on purpose.

**What to do.**

1. Check the name is exactly `<app>.<thing>`, for example `acme-expenses.claim`.
2. Ask your VMnodes contact to grant your app access, and ask an org administrator to turn fields on under **Shares** on the publishing app.

It worked when the query returns rows.

### `field '<field>' is not available to you on '<entity>'`

**What it means.** Code `data/field-denied`. You selected, filtered or sorted on a field your grant does not include.

**What to do.** Select only fields the grant covers, or ask for it to be widened. It worked when the query returns rows.

### `rows of '<entity>' are identified by <grain>, and <hidden> is not available to you — two rows could differ in a way you cannot see.`

**What it means.** Code `data/grain-not-readable`. Your grant leaves out part of what identifies a row. The message ends `Aggregate instead (count, sum, min, max), which needs no row identity.`

**What to do.** Use `aggregate` in place of `select`, or ask for the identifying field to be granted. It worked when the query returns a result.

### `unknown operator '<op>'`

**What it means.** Code `data/bad-op`. A filter used `like`, `=` or another operator.

**What to do.** Use one of `eq`, `ne`, `in`, `gt`, `gte`, `lt`, `lte`, `contains`. It worked when the query returns rows.

### `select is required — select at least one field`

**What it means.** The query body is malformed. This entry covers the group, all status 422:

- `select at least one field`
- `entity is required and must be a string`
- `select must be an array of field names`
- `filter must be an array`
- `each filter entry must be an object with field, op and value`
- `'in' needs an array value` and `'in' needs 1-100 values`
- `orderBy must be an object with a string 'field'`
- `aggregate must be an object`
- `limit must be a positive integer`

**What to do.** Send a body of this shape:

```json
{
  "entity": "acme-expenses.claim",
  "select": ["amount", "status"],
  "filter": [{ "field": "status", "op": "eq", "value": "approved" }],
  "orderBy": { "field": "amount", "dir": "desc" },
  "limit": 50
}
```

It worked when the call returns rows.

### `identity token not valid for this application: <error>`

**What it means.** Status 403, code `identity/on-behalf-of-invalid`. The `X-Vmnodes-On-Behalf-Of` header holds an identity token that is expired, altered, or was made for another app. `only an application may act on behalf of a user` means the token is not an app's own.

**What to do.** Forward the current `X-Vmnodes-Identity` value from the request the person just made, unchanged, and use your app's own token in `Authorization`. It worked when the query returns rows.

### `natural-language queries are not configured on this control plane`

**What it means.** Status 501. `POST /v1/data/ask` is not switched on for your org.

**What to do.** Use `POST /v1/data/query`. It worked when it returns rows.

## In your app (from @vmnodes/identity)

`@vmnodes/identity` verifies the `X-Vmnodes-Identity` header the gateway adds to each request. It throws an `IdentityError` with a `status`. Return that status to the caller.

| Status | Means | Whose problem |
|---|---|---|
| 401 | The identity was refused: no header, an expired or altered token, or a token for another app. | The request. Sign in again, or send it through the app's address. |
| 403 | The person is signed in but lacks the role or group your code asked for. | The person's access. Give them the role on the **People** tab. |
| 503 | The SDK could not reach a verdict because it could not fetch the signing keys. | The platform or your app's network. The person's sign-in is fine. |

### `no identity header — is this app behind the VMnodes gateway?`

**What it means.** Status 401. `currentUser` found no `x-vmnodes-identity` header. The request did not come through the gateway, or your handler passed the wrong headers object.

**What to do.**

1. Pass `req.headers` to `currentUser`.
2. Call the app at `https://<app>.<org>.vmnodes.com` after signing in, or run `npm run dev` in the starter, whose pretend portal adds the header.
3. Do not call `currentUser` in `/health`: the platform's health check sends no header.

It worked when `currentUser` returns the person.

### `identity token failed verification`

**What it means.** Status 401. The header is present, but the token is expired, altered, signed by another issuer, made for a different app, or not signed with RS256. The four causes read the same.

**What to do.**

1. Check `VMNODES_APP_ID` and `VMNODES_ISSUER_URL` hold the values the platform provided (a deployed app gets them without your doing anything).
2. Make the request from a browser through the app's address after signing in again; a token lives a short time.
3. Do not copy a token made for another app.

It worked when `currentUser` returns the person.

### `could not verify identity: the VMnodes portal's key set was unreachable or unusable — this is not a problem with your sign-in`

**What it means.** Status 503. The SDK could not fetch the keys at `<VMNODES_ISSUER_URL>/auth/jwks`, so it reached no verdict. An error the SDK does not recognise also gives 503.

**What to do.**

1. Check the app can reach the address in `VMNODES_ISSUER_URL` over the network and that the value was not changed.
2. Retry. If it keeps returning 503 for every request, contact your VMnodes contact with the time it happened.

It worked when `currentUser` returns the person.

### `VMNODES_ISSUER_URL or VMNODES_PORTAL_URL is required (set by the platform)`

**What it means.** An `Error` thrown by `new VmnodesIdentity()` when neither variable is set. This happens off the platform, or in a build step. The message `VMNODES_APP_ID is required (set by the platform at install).` is the same problem for `VMNODES_APP_ID`.

**What to do.**

1. Locally, run `npm run dev` in the starter, which sets both and starts a pretend portal. Or set them yourself.
2. Create `VmnodesIdentity` when the app starts, not while building the image.

It worked when the app starts and `/health` answers.

### `role '<role>' required`

**What it means.** Status 403. The person does not hold the role `requireRole` asked for. The role name must match `vmnodes.json` exactly.

**What to do.**

1. Check the role name in your code is the name in `vmnodes.json`.
2. On the app's **People** tab, press **Change roles** for the person, tick the role and press **Save roles**.
3. Ask the person to reload the page.

It worked when `requireRole` stops throwing.

### `group '<group>' required`

**What it means.** Status 403. The person is not in the group `requireGroup` or `requireGroupId` asked for.

**What to do.** Ask your VMnodes contact to add the person to the group, or attach a group that holds them under **Groups** on the **People** tab. It worked when `requireGroup` stops throwing.

## When signing in

The portal at `https://apps.<org>.vmnodes.com` signs you in with a six-digit code sent by email. A refusal appears on the sign-in page as `That didn't work: <message>`. A code lasts 10 minutes and a person has five tries per code.

### `you are not a member of <displayName>`

**What it means.** The address is not a member of that org. A code is sent only to members, and the page does not say which happened. Nothing arrives, and the page reads `A code only goes to an address that is a member of <org>. If nothing arrives, check that this is the address you were invited with, and look in your junk folder.`

**What to do.**

1. Use the address the invitation was sent to.
2. Ask an org administrator to add your address.
3. Check your junk folder.

It worked when the code arrives and the page opens the portal.

### `incorrect code`

**What it means.** The six digits are wrong.

**What to do.** Type the code from the latest email. After five wrong tries, request a new code. It worked when the portal opens.

### `no active code — request a new one`

**What it means.** The code expired, was already used, or was never issued. This entry also covers `too many attempts — request a new code`.

**What to do.** Open **Send another code**, enter your email address, press **Send code**, and use the new code. It worked when the portal opens.

### `we couldn't send the code just now. Try again in a minute.`

**What it means.** The email did not go out.

**What to do.** Wait a minute and press **Send code** again. If it fails twice, contact your VMnodes contact with the time it happened. It worked when `Code sent to <address>` appears and the email arrives.

### `You asked for a code less than a minute ago. If it has arrived, use it. If not, ask for another after a minute.`

**What it means.** This is a notice, not an error. One code can be requested per minute for an address.

**What to do.** Use the code in the email. If none has arrived, wait a minute and press **Send another code**. It worked when the portal opens.

### `email code sign-in is switched off on this control plane — use your organisation's identity provider`

**What it means.** Sign-in by email code is not available for your org. The wording names a setting you cannot change.

**What to do.** Use **Sign in with Microsoft** if the page offers it. If not, contact your VMnodes contact. It worked when the portal opens.

### `Not authorised`

**What it means.** A page at the app's address, with status 403. It reads `Your account is signed in, but it has no entitlement to this application.` and `Ask an administrator to grant you access, then reload the page.` You are signed in but have not been given access to this app.

**What to do.**

1. Ask an org administrator to open the app's **People** tab, press **Change roles** for you, tick a role and press **Save roles**. Giving a role also gives access. If the app has no roles, ask your VMnodes contact.
2. Reload the app's address.

It worked when the app's page opens.

### `Sign-in link expired`

**What it means.** A page with status 403. It reads `That sign-in link was already used, has expired, or was opened in a different browser.`

**What to do.** Press **Sign in again** and finish in the same browser tab, without reusing an old link. It worked when the app's page opens.

### `invalid or expired token`

**What it means.** A bare JSON body, `{"error":"invalid or expired token"}`, status 401, from the app's address. A request sent an `Authorization: Bearer` token that the gateway does not accept. This entry also covers `{"error":"API tokens are not accepted at this gateway"}`.

**What to do.** For a browser, drop the header and sign in. For a script, ask your VMnodes contact for a token. A request with no header and no cookie is not refused: it gets a 302 to the sign-in page. It worked when the request reaches the app.

## Related

- [Build and run](reference/build-and-run.md)
- [`vmnodes.json`](reference/vmnodes-json.md)
- [Identity SDK](reference/identity-sdk.md)
- [Publish API](reference/publish-api.md)
