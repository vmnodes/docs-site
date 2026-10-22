# VMnodes documentation

VMnodes runs web apps for a business, and these docs tell you how to build one that runs on it. Start here to find the page that matches your task.

## What VMnodes is

VMnodes is a managed runtime for software built for a small or mid-sized business. An org's administrator puts an app online from a git repository in a web portal, and VMnodes builds it, runs it at its own address and keeps it running. A gateway in front of every app signs people in and tells the app who each person is, so the app never builds a login page. VMnodes also gives each app roles, an optional database, and a way to share its records with other apps in the org.

## Who these docs are for

These docs are written for AI coding agents that build an app for a customer who is not technical, and for the people who read over the agent's shoulder. Every page says what to do and what you see when it worked, so you can tell done from not done.

## If you are an AI agent, read these in order

1. [Getting started](getting-started.md): download the starter, run it, put it online, change it.
2. [Sign-in and identity](concepts/sign-in-and-identity.md): how a request reaches your app and how your app must check who sent it.
3. [`vmnodes.json`](reference/vmnodes-json.md): the one file that declares your roles, your database and what your app shares.
4. The how-to below that matches your task.

Read the other concept pages when a task touches them: [orgs and people](concepts/orgs-and-people.md), [apps](concepts/apps.md), [roles](concepts/roles.md), [data](concepts/data.md), [sharing](concepts/sharing.md), [connectors](concepts/connectors.md).

## How-tos

| Your task | Read |
|---|---|
| Build an app where people fill in a form and see a list | [Build a form-and-list app](how-to/form-and-list.md) |
| One person submits, another approves | [Submit and approve](how-to/approvals.md) |
| Keep data when the app is updated | [Keep data through updates](how-to/keep-data-through-updates.md) |
| Share your app's records with other apps in the org | [Share data](how-to/share-data.md) |
| Read records another app shares | [Read shared data](how-to/read-shared-data.md) |
| Change an app someone else built | [Change an app](how-to/change-an-app.md) |

When something fails, search [Troubleshooting](troubleshooting.md) for the exact message you saw. Facts you may need while building are in the reference pages: [environment variables](reference/environment.md), [build and run](reference/build-and-run.md), [the identity package](reference/identity-sdk.md), [the publish API](reference/publish-api.md) and [limits](reference/limits.md).

## What VMnodes does for you

- Builds your repository into a running app, from a root `Dockerfile` or from a Node project with a `package-lock.json`.
- Gives the app its own address, `<app>.<org>.vmnodes.com`, over https.
- Signs people in and adds a signed identity header to every request, so the app never shows a login page or stores a password.
- Keeps people out who have not been given access to the app.
- Holds the roles your app declares, and lets an administrator give them to people.
- Creates a private database and passes its connection string in `DATABASE_URL` when `vmnodes.json` says `"database": true`.
- Passes a publish token and API address to the app when `vmnodes.json` lists something under `publishes`.
- Checks the new version answers before calling an update done, and keeps the old version running when an update fails.
- Scans the built image for serious security problems and refuses to put one online that has them.

## What your app must still do

- Listen on port 3000 on all addresses. VMnodes sets no `PORT` variable.
- Answer `GET /health` without asking anyone to sign in.
- Verify the identity header with `@vmnodes/identity`. Reading the token without checking its signature proves nothing.
- Check roles on the server, on every request that needs one.
- Read `DATABASE_URL` and keep anything worth keeping in that database.
- Declare roles, the database and shared record types in `vmnodes.json`.
- Send records to the publish API itself, if the app shares data.
- Escape any user text before putting it in a page.

## Related

- [Getting started](getting-started.md)
- [Sign-in and identity](concepts/sign-in-and-identity.md)
- [`vmnodes.json`](reference/vmnodes-json.md)
- [Troubleshooting](troubleshooting.md)
