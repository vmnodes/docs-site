# Getting started

Take the VMnodes starter from nothing to a running app that you have tried, changed and updated. Read this first: every other page assumes you have done it once.

The starter is a team noticeboard. Anyone signed in can read notes, and people with the `starter.editor` role can post them. It already verifies sign-in, checks a role, keeps its notes in a database, shares them and answers `/health`.

## Before you start

You need three things:

1. **An org and an administrator account.** Sign-up is by invite today: ask your VMnodes contact for an invite code and the sign-up address. When sign-up finishes you are signed in at `https://apps.acme.vmnodes.com` (with your own org name in place of `acme`) as the org's administrator.
2. **Compute.** On the org's first screen, **Get your space ready**, press **Get compute**. The page counts through "Creating your host.", "Installing the software your apps run on." and "Setting up your web address.". It worked when the **Your apps** page offers **Put an app online**. Only an administrator sees this button.
3. **A git repository the platform can read**, and a computer with Node 22 or later, `npm` and `git`. The repository is either public at an `https://` address, or a private GitHub repository you give VMnodes access to in step 4.

## 1. Download the starter

```bash
curl -fsSLO https://docs.vmnodes.com/downloads/vmnodes-starter.tar.gz
tar -xzf vmnodes-starter.tar.gz
mv vmnodes-starter acme-notes
cd acme-notes
ls package.json vmnodes.json Dockerfile
```

It worked when `ls` prints all three names. The repository root must hold `package.json`, `vmnodes.json` and `Dockerfile`, because VMnodes reads them from the root.

## 2. Run it on your computer

```bash
npm install
npm test
npm run dev
```

`npm test` runs the app against a pretend sign-in gateway and ends with a line `passed=N failed=0`. If it does not, fix that before anything else.

`npm run dev` starts the app on port 3000 and a pretend portal on port 4100, and prints `Open http://127.0.0.1:4100 in your browser.` It keeps running until you press Ctrl+C. Open `http://127.0.0.1:4100`.

It worked when the page is headed **Noticeboard**, reads "Signed in as Eden Editor (editor@example.test)" and shows a **New note** box with a **Post note** button. The pretend portal signs you in as an editor.

Switch who you are by visiting these two addresses:

```
http://127.0.0.1:4100/_as/reader
http://127.0.0.1:4100/_as/editor
```

After `/_as/reader`, reload `http://127.0.0.1:4100`: the **New note** box is gone and the page reads "You can read notes. Posting needs the `starter.editor` role." After `/_as/editor` the box is back. Locally the page ends "Notes are kept in memory, so they are cleared when the app restarts or is updated." because `npm run dev` sets no database.

Stop the dev command with Ctrl+C.

## 3. Push it to a git repository

Create an empty repository on GitHub, then:

```bash
git init -b main
git add .
git commit -m "Start from the VMnodes starter"
git remote add origin https://github.com/acme/acme-notes.git
git push -u origin main
```

It worked when the repository's page on GitHub lists `server.js`, `vmnodes.json`, `Dockerfile` and `vendor`. VMnodes always builds the latest commit on the repository's default branch; you cannot choose another branch or a tag.

## 4. Put the app online

1. Sign in to your org's portal at `https://apps.acme.vmnodes.com`. The sign-in sends a six-digit code to your email. You land on **Your apps**.
2. Press **Put an app online**. The page of that name opens, with the section **1. Where is the code?**
   - **Public repository:** paste its `https://` address into **Or paste a public repository's URL**. The address must have no username, password or token in it.
   - **Private GitHub repository:** press **Connect GitHub**, install VMnodes Builds on that repository on GitHub's own screen, and you are brought back. Choose the repository from the **Repository** list. If it is not listed, open **Can't see your repo? Paste its URL**.
3. Under **2. Name it**, type `acme-notes` into **App name**. Use 3 to 30 lowercase letters, digits and hyphens, starting with a letter.
4. Press **Put it online**.

It worked when you land on a page headed `acme-notes` with a **Starting** badge. The **Build log** section shows the step it is on, one at a time: "Waiting to start…", "Creating your application…", "Building your image…", "Checking your image for security issues…" and "Deploying your app…". The page refreshes itself. A launch takes a few minutes.

## 5. Watch the launch

Leave the page open. The launch ends one of two ways.

- **It worked:** the badge reads **Working**. An **Open acme-notes** button and a **View app page** button appear. A line reads "You have every role acme-notes declares: starter.editor." The **Build log** ends "Your app is live."
- **It failed:** the badge reads **Not working**, a sentence says why, and a **Try again** button starts a new launch of the same name and repository. Look the sentence up in [Troubleshooting](troubleshooting.md).

If the page says "Your app is live, but your access to it couldn't be set up. Press Try again.", press **Try again** once: only the access step is retried.

## 6. Open the app

Press **Open acme-notes**. Your browser is already signed in, so the app opens at `https://acme-notes.acme.vmnodes.com`.

On a new app's first launch, the browser can show a certificate warning such as `ERR_CERT_AUTHORITY_INVALID` for a few minutes after the badge reads **Working**, while the app's https certificate is issued. Wait a few minutes and reload. Never click through the warning.

It worked when the page is headed **Noticeboard**, reads "No notes yet.", shows a **New note** box, and ends "Notes are kept in this app's database, across restarts and updates." Type a note and press **Post note**: the page returns with your note in the list.

Two more addresses on the app show what the app sees. `/health` needs no identity from your app, so the platform's check can reach it. Opened in the browser you are signed in with, it shows, for example `{"status":"ok","app":"acme-notes","version":"0.1.0","buildCommit":"<40 characters>","publishing":true,"storage":"postgres"}`. `/api/me` lists who you are and your roles.

## 7. Take the role off yourself, then put it back

Seeing what a reader sees needs no second person.

1. On the launch page press **View app page**, then open the **People** tab.
2. Find the row marked "(you)". Its **Roles** column shows `starter.editor`. Press **Change roles**. A box opens headed "Change roles for" and your name.
3. Untick `starter.editor` and press **Save roles**. It worked when your row reads "No roles".
4. Reload the app. The **New note** box is gone and the page reads "You can read notes. Posting needs the `starter.editor` role. Ask whoever runs this app to give it to you." You can still open the app: taking a role away does not take away access.
5. Put the role back: **Change roles** on your row, tick `starter.editor`, **Save roles**. Reload the app. The **New note** box is back.

Nothing is redeployed. A role change reaches the app on your next request.

## 8. Change the app and update it

Change the heading, commit and push:

```bash
node -e 'const f="server.js",fs=require("fs");fs.writeFileSync(f,fs.readFileSync(f,"utf8").replace("<h1>Noticeboard</h1>","<h1>Team board</h1>"))'
npm test
git commit -am "Rename the heading"
git push
```

Then in the portal open the app's **People** tab and find the card headed **Deployment**. It shows "Current commit:" and the commit now running. Press **Update to latest commit**.

It worked when the card reads "Updating to" and the new commit, then "Your app is now running the latest commit." An update usually goes live within about two minutes. The card can keep reading "Updating to" for a while after the new version is live, so check the app itself: open `/health` in your signed-in browser. When its `buildCommit` is the commit you pushed, the update is live. Reload the app: the heading reads **Team board** and your notes are still there, because the starter's `vmnodes.json` says `"database": true`. If the update fails, the card reads "The update didn't go online, so your app is still running the previous version." and the old version keeps serving.

An update does not give you any role the new commit adds. Give yourself a new role with **Change roles**.

## What to read next

You have now done every step an app goes through. Your own app differs from the starter in its name, its roles and what it keeps. Pick the how-to that matches your task from the [index](index.md).

## Related

- [Sign-in and identity](concepts/sign-in-and-identity.md)
- [`vmnodes.json`](reference/vmnodes-json.md)
- [Apps](concepts/apps.md)
- [Troubleshooting](troubleshooting.md)
