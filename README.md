# CivicTrack

A working responsive prototype for a fictional city, Navanagar. Built with vanilla JavaScript, CSS, a Node 24 server and SQLite, with no package dependencies.

## Run locally

```sh
npm start
```

Open http://localhost:3000. Node.js 24 or later is required. Data persists in `data/civictrack.sqlite`; restart the server without losing reports or votes. Set `PORT` to choose another port. The server binds to the local machine only.

## Try the complete workflow

1. Use the identity menu in the upper right to select Maya Rao.
2. Select **Report an issue**. Supply a title, category, description and photo. Choose a fictional ward center for simulated GPS, or use browser GPS (real locations outside Navanagar are rejected).
3. Switch to **Ward officer** and open **Ward officer demo**. Open the new report, start work, then submit a repair note and photo.
4. Switch to **Arjun Mehta**, open **Verify a fix**, review the repair, choose that ward's demo location and confirm it.
5. Switch to **Sana Khan** and confirm the same fix. The complaint now closes. A rejection instead returns it to In progress, clears current-round votes, and leaves the history intact.
6. View its hash-chained history. Use **How it works → Check the status log** to verify the entire chain.
7. As the officer, **Recalculate today's scores**, then view the public leaderboard and trends.

Guests can browse the map, complaints, ward rankings and score trends without a demo identity. Server-side rules require two different nearby citizens within 500 meters, prevent self-verification and duplicate voting, and prevent staff from closing complaints. GPS inputs and identities are intentionally simulated and spoofable in this prototype; this is not production authentication or proof of physical presence.

## Scoring

Each ward's score is rounded to the nearest integer:

`60 × closed / all + 25 × closed within 7 days / all + 15 × closed / (closed + awaiting verification)`

An empty ward scores 0. Verification is required for all closures. Counts in the dashboard reflect current data; public scores are the most recent daily snapshot. The officer can explicitly recalculate the current day's snapshot for demos.

The local server checks every 30 seconds and recalculates after midnight Asia/Kolkata even with no browser open. On restart it catches up to today's date; missed historical days are not fabricated. A Cloudflare Worker build provides a `scheduled` handler, but Sites does not configure a cron trigger in this project: the hosted app catches up on visits. Unattended hosted scoring requires a separately configured scheduled trigger. The first 29 days of seed trends are explicitly labeled simulated.

## Verification and storage

```sh
npm test
npm run build
```

Tests exercise the full complaint lifecycle, illegal transitions, proximity, self-voting, duplicates, rejection, tamper detection, IST scheduling, public access, and concurrent writes. `npm run build` creates a self-contained Worker ESM in `dist/server/index.js`. Hosted structured data uses a D1 binding called `DB` and schema migrations in `drizzle/`; local data uses SQLite with the same schema. Optimistic compare-and-swap writes prevent concurrent requests from dropping updates.

Photos are resized by the browser and stored with the report in the database for this small prototype, with a 700 KB approximate photo limit. They are public evidence: don't upload sensitive personal information. Production would use object storage, verified accounts, role authorization, rate limits, independently anchored audit checkpoints, and stronger location verification. The hash chain detects inconsistent edits but cannot prevent an administrator from replacing and rehashing the whole database.

The illustrated map is an original SVG schematic with selectable wards, not real GIS boundaries. All 96 initial complaints and historical scores are fictional. No municipal integrations, ML, blockchain, native app, push notifications, payments, or multilingual features are included.
