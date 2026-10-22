# Dates and time zones

Show "today", due dates, weeks and booking times in the business's own time zone, not the server's. Read this before you build anything that shows a date, decides what is overdue, counts by day or week, or takes a time from a form.

## The rule

Your app's server runs in UTC. The platform sets no time-zone variable, and the official Node images default to UTC. So `new Date()`, `toISOString()` and a date taken with `.slice(0, 10)` are all UTC.

For a business in Sydney, 9:30 in the morning on 23 October is still 22 October in UTC. An app that uses UTC dates shows that morning's returns as returned "yesterday", calls a loan due today overdue, and counts early-morning bookings on the wrong day.

Keep two kinds of value apart:

| Value | Example | Store it as | Show it |
|---|---|---|---|
| An instant: when something happened or is booked | returned at, starts at | a UTC timestamp (`timestamptz`, or an ISO string ending in `Z`) | converted to the business's zone with `dateIn` |
| A calendar date a person chose | due back on, date it came in | the date string `YYYY-MM-DD`, with no time | as it is |

Decide "today", "overdue" and "this week" in the business's zone. Never decide them from the server's clock alone.

## 1. Know the business's time zone

Ask the customer which city they work in, and use its IANA name, such as `Australia/Sydney` or `Europe/London`. If nobody can answer, choose one, write the question in your report, and print the zone on the page (step 4), so a wrong guess is visible.

Set it in your `Dockerfile`. The portal has no place to set a variable:

```dockerfile
ENV APP_TIME_ZONE=Australia/Sydney
```

It worked when the app's page names that zone (step 4).

## 2. Add the date helpers

Save this as `dates.js`. It needs nothing beyond Node: the zone rules come with Node's built-in `Intl`.

```js
// Calendar dates and wall-clock times in the business's time zone. The server's clock is UTC.
export const TIME_ZONE = process.env.APP_TIME_ZONE || "Australia/Sydney";

const parts = (instant, timeZone) => Object.fromEntries(
  new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(instant).map((p) => [p.type, p.value]));

/** The calendar date, "YYYY-MM-DD", that `instant` falls on in `timeZone`. */
export function dateIn(instant, timeZone = TIME_ZONE) {
  const p = parts(new Date(instant), timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Today's date in `timeZone`. */
export const todayIn = (timeZone = TIME_ZONE, now = new Date()) => dateIn(now, timeZone);

/** The Monday that starts the calendar week holding `date` ("YYYY-MM-DD"). */
export function mondayOf(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** A wall-clock time typed in `timeZone` ("YYYY-MM-DDTHH:MM", as <input type="datetime-local"> sends it), as a UTC instant. */
export function wallTimeToInstant(local, timeZone = TIME_ZONE) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) throw new Error(`expected YYYY-MM-DDTHH:MM, got ${local}`);
  const asUtc = new Date(`${local}:00Z`).getTime();
  const offsetAt = (t) => { const p = parts(new Date(t), timeZone); return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t; };
  const first = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(first)); // a second pass settles times near a daylight-saving change
}
```

How to use it:

- **"Today" and "overdue".** `const today = todayIn()`. A loan is overdue when `dueOn < today`. Compare as strings: `YYYY-MM-DD` sorts in date order. A loan due today is not overdue.
- **The date an instant falls on.** `dateIn(returnedAt)`, never `returnedAt.slice(0, 10)`.
- **This week.** A booking is in the calendar week starting Monday when `mondayOf(dateIn(b.startsAt)) === mondayOf(todayIn())`. Say on the page which week you mean.
- **A time typed into a form.** `<input type="datetime-local">` sends a wall-clock time with no zone, such as `2026-11-05T10:30`. Store `wallTimeToInstant(value).toISOString()`. To fill the input back in, show the instant in the business's zone.

## 3. Test them

Save this as `test/dates.js` and run `node test/dates.js`.

```js
import assert from "node:assert/strict";
import { dateIn, todayIn, mondayOf, wallTimeToInstant } from "../dates.js";
let passed = 0;
const check = (name, got, want) => { assert.deepEqual(got, want, name); passed++; console.log(`ok   ${name}`); };
// 13:30 UTC on 22 Oct is already 23 Oct in Sydney (UTC+11 in October): the bug the UTC date causes.
check("an instant's Sydney date, not its UTC date", dateIn("2026-10-22T13:30:00Z", "Australia/Sydney"), "2026-10-23");
check("the same instant's UTC date", dateIn("2026-10-22T13:30:00Z", "UTC"), "2026-10-22");
check("today in a zone", todayIn("Australia/Sydney", new Date("2026-10-22T22:00:00Z")), "2026-10-23");
check("Monday of a Thursday", mondayOf("2026-10-22"), "2026-10-19");
check("Monday of a Sunday is the Monday before", mondayOf("2026-10-25"), "2026-10-19");
check("Monday of a Monday is itself", mondayOf("2026-10-19"), "2026-10-19");
check("10:30 Sydney in November is 23:30 UTC the day before", wallTimeToInstant("2026-11-05T10:30", "Australia/Sydney").toISOString(), "2026-11-04T23:30:00.000Z");
check("10:30 Sydney in June (no daylight saving) is 00:30 UTC", wallTimeToInstant("2026-06-05T10:30", "Australia/Sydney").toISOString(), "2026-06-05T00:30:00.000Z");
check("the day daylight saving starts, after the change", wallTimeToInstant("2026-10-04T03:30", "Australia/Sydney").toISOString(), "2026-10-03T16:30:00.000Z");
check("the day daylight saving starts, BEFORE the change (one pass gets this an hour out)", wallTimeToInstant("2026-10-04T01:30", "Australia/Sydney").toISOString(), "2026-10-03T15:30:00.000Z");
check("New York in July", wallTimeToInstant("2026-07-01T09:00", "America/New_York").toISOString(), "2026-07-01T13:00:00.000Z");
check("a round trip gives the typed date back", dateIn(wallTimeToInstant("2026-11-05T00:15", "Australia/Sydney"), "Australia/Sydney"), "2026-11-05");
assert.throws(() => wallTimeToInstant("5 Nov 10:30"), /expected YYYY-MM-DDTHH:MM/); passed++;
console.log(`\npassed=${passed} failed=0`);
```

It worked when the last line is `passed=13 failed=0`. The daylight-saving cases matter: one conversion pass gets a time typed just before the clocks change an hour wrong.

If your `package.json` has no `"type": "module"`, rename both files to `.mjs`.

## 4. Say the zone on the page

Print the zone wherever a date or a time appears, for example "Times are Sydney time (Australia/Sydney)." A person reading the page can then catch a wrong zone at once, and so can the next person who changes the app.

## Traps

- **`toISOString().slice(0, 10)` for a date a person sees.** It is the UTC date. Use `dateIn`.
- **`new Date("2026-11-05")`.** It is midnight UTC, which in Sydney is 11 in the morning. Keep a chosen date as its string.
- **The browser's zone on the server's behalf.** A default of "today" filled in by the browser uses the visitor's zone, which is not always the business's. Use it only as a starting value, and decide overdue and counts on the server.
- **Shared records.** Publish instants as UTC ISO strings ending in `Z`. A reading app then converts them into its own business's zone.

## Related

- [Environment variables](../reference/environment.md)
- [Build a form-and-list app](form-and-list.md)
- [Share data](share-data.md)
