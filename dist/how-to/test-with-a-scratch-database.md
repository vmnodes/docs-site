# Test with a scratch database

Run your app's database tests on your own computer, against a private Postgres that you start, use and stop yourself. Read this before the first launch of any app with `"database": true`, and before every update that changes what the app stores.

The platform gives your app a real database only online. Without a local one, `npm test` skips its database checks. The starter, for example, ends with `SKIP postgres section` and `passed=45 failed=0`. Your SQL would then run for the first time on the customer's data.

## What you need

- The PostgreSQL programs `initdb`, `pg_ctl`, `createdb` and `pg_isready`, version 14 or later. Check with `initdb --version`. On a Mac with Homebrew they come from `brew install postgresql@16`.
- A folder outside your repository for the database's files. These steps use `../scratch-db`, next to the repository, so nothing is committed by accident.

If you cannot install PostgreSQL, say so in your report. Then launch with extra care: open the app's `/health` after the first launch and after every update, and confirm the data you added is still there.

## 1. Pick a port nobody is using

```bash
PGPORT_SCRATCH=55432
pg_isready -h 127.0.0.1 -p $PGPORT_SCRATCH
```

It worked when this prints `127.0.0.1:55432 - no response`. If it prints `accepting connections`, something else is already listening there. It is not yours: never connect to it, never send it a password, and never stop it. Pick another number between 49152 and 65535 and check again.

## 2. Create and start your own Postgres

```bash
initdb -D ../scratch-db -U app --auth=trust
pg_ctl -D ../scratch-db -l ../scratch-db/server.log -w \
  -o "-p $PGPORT_SCRATCH -c listen_addresses=127.0.0.1 -c unix_socket_directories=''" start
```

It worked when the last line is `server started`.

- `--auth=trust` means no password: the server only listens on `127.0.0.1`, so nobody else can reach it.
- `unix_socket_directories=''` turns off the local socket file. Postgres refuses to start when that file's full path is longer than 103 characters, which a deep project folder easily reaches. The log then reads `is too long (maximum 103 bytes)`. These steps use TCP only, so the folder's depth does not matter.

## 3. Make an empty database and run the tests

The tests expect an EMPTY database. Drop and recreate it before every run, so nothing left over from an earlier run or an earlier version decides the result:

```bash
dropdb -w --if-exists -h 127.0.0.1 -p $PGPORT_SCRATCH -U app scratch
createdb -w -h 127.0.0.1 -p $PGPORT_SCRATCH -U app scratch
TEST_DATABASE_URL=postgres://app@127.0.0.1:$PGPORT_SCRATCH/scratch npm test
```

It worked when there is no `SKIP postgres` line and the last line reads `failed=0`. For the starter it reads `passed=52 failed=0`.

`-w` means never ask for a password. Without it, a `createdb` that reaches the wrong server waits forever at a password prompt.

## 4. Stop it

```bash
pg_ctl -D ../scratch-db -m fast -w stop
```

It worked when the last line is `server stopped`. Stop only the server you started, by its folder. Never stop a Postgres by its name, its port or a process search: on a shared computer it may be somebody else's. Delete `../scratch-db` when you no longer need it.

## Traps

- **A `TEST_DATABASE_URL` that already has your tables**, for example because you started the app itself against it. The starter's test removes what it creates, but a table it did not create makes it refuse: `FAIL TEST_DATABASE_URL already has a notes table; use an empty scratch database`. Recreate the database (step 3).
- **Testing an upgrade.** To prove an update keeps the existing data, first load the OLD version's tables and rows, then run the new version's start-up against them. [Keep data through updates](keep-data-through-updates.md) shows how, with `test/migrate.js`.
- **Pointing the tests at the app's real `DATABASE_URL`.** The platform's database is reachable only from inside your app's container, and the tests would write to the customer's data. Use a scratch database only.

## Related

- [Keep data through updates](keep-data-through-updates.md)
- [Change an app](change-an-app.md)
- [Data](../concepts/data.md)
- [Getting started](../getting-started.md)
