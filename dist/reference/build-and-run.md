# Build, run and security checks

This page lists how VMnodes builds your repository, what your app must do to be started and kept online, what the security scan blocks, and what an update does. Read it when a launch or update fails, or before you choose how to package an app.

## How a launch and an update run

Both take the same steps, in this order: resolve the commit, build, scan, deploy, check the app answers.

1. **Launch** (**Put an app online**) first creates the app and gives the person who launched it access. It then clones the latest commit of the repository's default branch over `https`.
2. **Update** (**Update to latest commit**, on the **People** tab, in the **Deployment** card) rebuilds the latest commit of the same repository and branch. Only an administrator sees it, and only for an app that was launched from the portal. An update cannot change the repository or the branch. One update runs at a time per app.
3. The platform waits up to 10 minutes for the security scan of the new image.
4. The new version starts, and the platform checks it answers (see [Health checks](#health-checks)).
5. Traffic moves to the new version only after it answers.

If an update fails at any step, the previous version keeps serving. The portal says "The update didn't go online, so your app is still running the previous version." A failed update leaves the app as it was, with one exception: changes to roles, the database and published entities are applied before the new version starts and are not undone. See [Changes between commits](vmnodes-json.md#changes-between-commits).

An update replaces the container. Anything the app stored inside its container is gone afterwards; keep data in the database (`"database": true` in `vmnodes.json`).

Time limits: each git step 120 seconds; the image build 600 seconds on the standard builder, 15 minutes on the cloud builder; pushing the image 300 seconds; a deployment that has not finished after 15 minutes is stopped.

### What the launch page tells you

The launch page shows one of a fixed set of sentences. Any failure while building that the set does not cover, including a bad `vmnodes.json`, a missing lock file and installed packages committed to the repository, shows as:

`We couldn't read that repository or build it. Try again, or check the repository is public or GitHub is connected.`

A failure while creating the app or starting it shows as `The launch failed. Try again, or contact support.` When you see either, check your repository against the rules on this page and on [vmnodes.json reference](vmnodes-json.md), fix it, commit, and launch or update again. For the exact message, ask your VMnodes contact.

## Build paths

The platform picks one path by looking at the repository root. It does not look in subdirectories, so a repository with the app in a subfolder is not buildable; put the app at the root.

| Root contains | Path |
|---|---|
| A file named exactly `Dockerfile` | Your `Dockerfile` is used as it is. |
| No `Dockerfile`, and a `package.json` | The platform's generated Node build. |
| No `Dockerfile`, and `requirements.txt`, `pyproject.toml` or `Pipfile` | Not supported on every builder. |
| Anything else | Refused. |

A `Dockerfile` is the path that works for every language and every builder. The rest of this page assumes you may need either.

### Your own Dockerfile

Use a `Dockerfile` when you want control, when the app is not Node, or when you use the identity package from the starter's `vendor/` folder. The starter's file is a complete example:

```dockerfile
FROM node:22-alpine
WORKDIR /app

COPY package.json package-lock.json ./
COPY vendor ./vendor
RUN npm ci --omit=dev --no-audit --no-fund

# Remove the package managers from what runs; they are only needed to install.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

ARG BUILD_COMMIT
ENV BUILD_COMMIT=$BUILD_COMMIT

COPY server.js publish.js store.js ./

EXPOSE 3000
USER node
CMD ["node", "server.js"]
```

The starter's full file also refuses to build when `BUILD_COMMIT` is empty or is not 40 lowercase hexadecimal characters. Keep that check; it stops an image from reporting a made-up version.

Rules for your own file:

- The app listens on port 3000 on all addresses.
- The image contains no `.git` folder. Do not `COPY . .` unless `.dockerignore` lists `.git`.
- Pin a supported Node or Python version, not `latest`. See [End-of-life check](#end-of-life-check).

### Node without a Dockerfile

When the root has a `package.json` and no `Dockerfile`, the platform builds the app with its own template. It needs all three of these:

- **A `package-lock.json`.** A `yarn.lock` or `pnpm-lock.yaml` alone is refused.
- **A start command that names one file.** Either `"scripts": { "start": "node server.js" }` (the command must be exactly `node` and one file name), or a `"main"` field naming a file that exists in the repository.
- **No dependency that must be built.** The template runs `npm ci --omit=dev`: it installs production dependencies only and runs no build step. Commit built output, or use a `Dockerfile`.

What the template builds: the `node:22-alpine` image, `npm ci --omit=dev` on a copy of only `package.json` and `package-lock.json`, then your files copied in with `.git` removed, `npm` removed from the final image, `EXPOSE 3000`, running as the `node` user, started with `node <your file>`.

Because the install step sees only `package.json` and `package-lock.json`, a dependency of the form `file:vendor/...` is not present when `npm ci` runs. To use the vendored `@vmnodes/identity` package, use your own `Dockerfile` that copies `vendor` before `npm ci`, as above. Without a `Dockerfile`, check the identity header with `jose` directly; see [the raw contract](identity-sdk.md#raw-contract-for-any-language).

Refusals, with the code the platform gives each:

- `build/node-template-no-lockfile`: `Your repository has no package-lock.json file, so there is no exact list of dependency versions to install. Run "npm install" in your project and commit the package-lock.json file it creates, then try again.`
- `build/node-template-wrong-lockfile`: `Your repository has a yarn.lock file, but this platform installs dependencies with npm, which needs a package-lock.json file. Run "npm install" in your project, remove yarn.lock, and commit both changes, then try again.` The same message names `pnpm-lock.yaml` when that is the file found.
- `build/node-template-no-entry`: `Your package.json does not say how to start your app. Add a "start" script that runs exactly "node <your-file>" (for example: "start": "node server.js"), or a "main" field naming a file that exists in your repository, then try again.`

### Python and other languages

For a repository with no `Dockerfile` and a `requirements.txt`, `pyproject.toml` or `Pipfile`, whether the build works depends on how the platform is set up. Write a `Dockerfile`. For any other language, a `Dockerfile` is the only path.

### Nothing recognisable

With no `Dockerfile`, no `package.json` and no Python file at the root, the build is refused with `build/no-strategy`: `no Dockerfile, and no recognisable Node (package.json) or Python (requirements.txt, pyproject.toml or Pipfile) project at the repository root. Nothing was built.`

## Installed packages in the repository

A repository that has folders of installed packages committed is refused, because the build would copy them over the exact versions your lock file asks for. Folders counted, searched up to four levels deep: `node_modules`, `bower_components`, `.venv` and `site-packages`, and `vendor` only when a `go.mod`, `composer.json` or `Gemfile` sits beside it. A Node project's `vendor/` folder is fine.

The repository passes when `.dockerignore` at the root has a line for each folder in the form `**/<folder>` or `**/<folder>/`, or when you stop committing the folder. A bare `node_modules` line does not count; write `**/node_modules`.

Add to `.dockerignore`:

```
**/node_modules
```

The refusal is `build/contaminated-context`: `Your repository includes <a folder|folders> of installed packages (<"folder", ...>). The build would copy them into your app and quietly replace the exact versions your lockfile asks for. Add <"**/folder", ...> to a file called .dockerignore at the top of your repository, or stop committing <that folder|those folders>, then launch again. Nothing was built.`

## The BUILD_COMMIT argument

The platform always passes `--build-arg BUILD_COMMIT=<sha>`, where `<sha>` is the resolved 40-character commit it built. Declare `ARG BUILD_COMMIT` and copy it into `ENV` if your app reports its version, as the starter's `/health` does. The platform sends it whether or not your `Dockerfile` uses it. The generated Node build declares it for you.

## Health checks

### Launch check

After the new container starts, the platform asks it for `GET /health` directly, with no signed-in person, so `/health` must not require sign-in. If `/health` answers `404`, it asks for `/` instead.

- Any status below 500 counts as answering. Redirects are not followed.
- It tries every 2 seconds, with 3 seconds allowed per try, for 60 seconds from start.
- It gives up early if the container stops.

Failures read:

- `Your app stopped while starting.`
- `Your app started but isn't answering on port 3000. Check it listens on port 3000.`

Make `/health` return `200` with a small JSON body and no database call, so it answers quickly.

### Ongoing check

Once an app is online, the platform repeats the same check every 60 seconds. After three failures in a row, about 3 minutes, the app's state on the portal's **Usage** page under **Your apps** shows **Not responding**. The other states are **Working**, **Restarting** and **Stopped**. The check is paused while a deploy, stop or restart is in progress.

## Resources

Every app launched from the portal runs with the same fixed limits:

| Resource | Value |
|---|---|
| Memory | 2048 MiB maximum (512 MiB baseline) |
| CPU | A relative share of 512, which weighs the app against its neighbours; it is not a fixed cap |
| Port | 3000 |
| Restart | The container restarts if it exits |
| Logs | Rotated at 10 MB, three files kept; the Console shows the last 50 lines |

You cannot change these from the portal.

## Security scan

Each image is scanned for known security problems rated critical or high before it is started.

| Finding | Result |
|---|---|
| A `.git` folder inside the image | Refused always |
| An image the scanner cannot read | Refused always |
| A scan still running when the platform stops waiting | Refused always |
| Critical findings, or a scan that failed | Refused or reported, depending on how the platform is set up. Fix them either way |
| High findings only | Deployed, with a warning |


The portal says, for each refusal:

- `Your app's image contains your repository's history (.git), which can expose deleted secrets. It was not started.` Add `.git` to `.dockerignore`, or copy only the files the app runs.
- `We found serious security problems in the software your app is built on, so it is not online. Update your app's packages to newer versions, then start it again.`
- `We could not finish checking your app for security problems, so it is not online. Start it again.`
- `We couldn't read your app's image to check it, so it was not started. Try again in a few minutes.`
- `We're still checking your app's image, so it was not started. Try again in a minute.`
- `The security check on your app's image did not finish. Start it again.`
- `Your app has not passed its security check, so it is not online. Start it again.`

For high findings only, the app is online and the portal says `Your app is online, but some of the software it's built on has a known security problem (1 serious). Updating its packages will fix most of them.` With more than one finding it says `has known security problems (<n> serious)`.

The starter removes `npm` and `corepack` from the final image because every high finding on the starter was inside npm's own bundled packages.

## End-of-life check

After the build, the platform identifies the Node or Python in the image and checks it.

- A version whose release line has reached end of life is refused with `build/runtime-eol`: `Node <cycle> reached end of life on <date> and gets no security fixes.` followed by the version to move to.
- A version below the required security patch is refused when it is on an old release line, and warned about otherwise: `Node <version> is below the required security floor <floor>. Closes <CVE, ...> Move to <floor> or later.`
- A release line within 90 days of end of life, or one the platform cannot identify, gets a warning only.

Use a Node release that still receives security fixes. The platform's own template uses Node 22. Re-check your base image when you update.

## The app's address and name

- An app is at `https://<app>.<org>.vmnodes.com`. The portal is at `https://apps.<org>.vmnodes.com`.
- The app name is 3 to 30 characters: lowercase letters, digits and hyphens; it starts with a letter, does not start or end with a hyphen, has no doubled hyphen, and is not all digits.
- The name must not be reserved. Reserved names are: `apps`, `api`, `www`, `admin`, `portal`, `auth`, `login`, `signup`, `start`, `connect`, `grafana`, `status`, `docs`, `help`, `support`, `billing`, `mail`, `cp`, `id`, `sso`, `static`, `cdn`, `assets`, `internal`, `test`, `dev`, `staging`, `prod`, `vmnodes`, the names of connectors (`xero`, `microsoft-graph`, `sharepoint`, `hubspot`, `salesforce`, `myob`, `servicenow`, `google-workspace`), and a few company names.
- The portal's name errors are `Must be 3 to 30 characters.`, `Must contain only lowercase letters, digits and hyphens.`, `Must start with a letter.`, `Must not start or end with a hyphen.`, `Must not contain a doubled hyphen.`, `Must not be all digits.` and `That name is reserved.`
- The path `/_vmnodes/` on an app's address belongs to the gateway; do not serve anything under it. The gateway's own cookie, `__Host-vmn_app`, is not for your app to read.

## Related

- [vmnodes.json reference](vmnodes-json.md)
- [Environment variables](environment.md)
- [Identity SDK](identity-sdk.md)
- [Apps and updates](../concepts/apps.md)
