# Apps

Understand what an app is on VMnodes, how it goes online, what runs it, and how it is updated. Read this before you write the app's server or its `Dockerfile`.

## App and address

An app is one web application running on VMnodes. It has a name, and its address is `https://<app>.<org>.vmnodes.com`, for example `https://acme-notes.acme.vmnodes.com`. The org's portal is at `apps.<org>.vmnodes.com`.

You choose the name in **App name** on the **Put an app online** page, and it sets the app's address.

- Use 3 to 30 lowercase letters, digits and hyphens, starting with a letter, with no doubled hyphen and no hyphen at either end.
- A name that is already used in the org is refused: "You already have an app called <name>. Choose a different name."
- Some names are reserved, including `test`, `dev`, `prod`, `staging`, `admin`, `api`, `www`, `apps`, `docs`, `help`, `status`, `mail`, `billing` and `support`. They are refused with `That name is reserved.` Add a word, for example `acme-notes`.
- The app's name also starts every record type the app shares: `acme-notes.note`. See [Sharing](sharing.md).

## Launch

A launch puts an app online for the first time, from a repository. An administrator does it with **Put an app online**. VMnodes then:

1. creates the app and gives the administrator access to it, and every role it declares;
2. clones the repository over https and builds the latest commit on its default branch;
3. scans the built image for serious security problems;
4. deploys the image to the org's production environment;
5. waits until the app answers, and only then calls the launch live.

A launch makes one app in production. There is no staging copy. The launch page shows the badge **Starting**, then **Working** when it succeeded or **Not working** when it failed. **Try again** starts a new launch of the same name and repository.

## What runs

VMnodes builds your repository into an image and runs that image as one container.

- **Port 3000.** The app must listen on port 3000, on all addresses. VMnodes does not read your code to find the port and sets no `PORT` variable, so the default in your server must be 3000. An app that listens elsewhere fails the launch with "Your app started but isn't answering on port 3000. Check it listens on port 3000."
- **`GET /health`.** After the container starts, VMnodes requests `/health`, then `/` only if `/health` answers 404. Any answer below 500 counts as up. It waits up to 60 seconds. An app that exits first fails the launch with "Your app stopped while starting." Serve `/health` with no sign-in and make it return 200.
- **How it is built.** A `Dockerfile` at the repository root is used as it is. With no `Dockerfile`, a Node project builds if it has a `package-lock.json` and a `package.json` whose `scripts.start` is exactly `node <file>`, or, with no such script, whose `main` names a file that exists. Anything else is refused. Details are in [Build and run](../reference/build-and-run.md).
- **Resources.** Every app gets the same fixed size. You cannot choose one.
- **Environment.** VMnodes sets `VMNODES_APP_ID`, `VMNODES_APP_NAME`, `VMNODES_ENVIRONMENT`, `VMNODES_ISSUER_URL` and `VMNODES_PORTAL_URL`, plus `DATABASE_URL` and the publish settings when the app asks for them. You cannot set other variables or secrets from the portal. The full list is in [Environment variables](../reference/environment.md).

> **Trap:** the security scan refuses an image with serious findings, and the launch fails with "We found serious security problems in the software your app is built on, so it is not online. Update your app's packages to newer versions, then start it again." Update the packages, and start from a current base image as the starter's `Dockerfile` does.

## Update

An update rebuilds the latest commit of the same repository and replaces the running app. An administrator presses **Update to latest commit** in the **Deployment** card on the app's **People** tab.

- It cannot change the repository or the branch.
- It reads `vmnodes.json` again from the new commit.
- It checks the new version answers before calling it done. If it fails, the card reads "The update didn't go online, so your app is still running the previous version." and the old version keeps serving.
- **An update does not give anyone a role the new commit adds.** Give it with **Change roles**.
- **An update replaces the container.** Anything the app wrote anywhere except its database is cleared, and without `"database": true` the card warns "Updating replaces your app's container. Anything not saved in its database is cleared." See [Data](data.md).
- Only one update runs at a time.
- An app that has no repository on record shows a form, **Deploy from this repository**, instead of the button.

## Watch, read logs, roll back

- **Status.** The **Usage** page lists each app as Working, Restarting, Stopped or Not responding. Not responding means the app is running but failed three checks in a row.
- **Logs.** In **Console**, open the app and its **Logs** tab. It shows the last 50 lines.
- **Roll back.** In **Console**, open the app's **Deployments** tab and press **Roll back to this** on an earlier deployment.
- **Stop and start.** There is no portal button for either.

## Related

- [Build and run](../reference/build-and-run.md)
- [Environment variables](../reference/environment.md)
- [Data](data.md)
- [Getting started](../getting-started.md)
