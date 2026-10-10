# Swanston Market — Autonomous Supermarket

A fictional 48-product supermarket near Swanston Street / Melbourne Town Hall, with a 60-day simulated operating history and remote-manager reporting. Built for CSE3CWA / CSE5006 Assignment 4. Not affiliated with IGA.

## Run locally

Install **Node.js 24.x (with npm)**. Node 20 is not supported: this application uses Node's built-in SQLite driver. No external SQLite server, account, API key or environment file is needed.

From the extracted project directory:

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. `dev` builds React locally and starts Express; it does not run a hot-reload server. Stop with Ctrl+C. For subsequent starts without source changes, use `npm start`. To rebuild separately, use `npm run build`.

The included pnpm lockfile also supports `pnpm install --frozen-lockfile` then `pnpm dev` with pnpm 11. The supplied pnpm workspace configuration permits the pinned esbuild build step. npm runs the required installation scripts normally.

Optional environment variables: `PORT` (default 3000), `DB_PATH` (default `data/supermarket.sqlite`). Relative database paths resolve from the project directory. Use the defaults to inspect the submission. The server binds only to the local machine.

## Submitted Run

- Run ID: **61c60483-1542-41a2-8ee7-90e012725062**
- Database: **data/supermarket.sqlite**, supplied in the ZIP.
- Seed: **260925**; model version: **1.0**.
- Period: **7 September–5 November 2026**, 60 consecutive days.
- Opening inventory: **A$3,488.80**, below the A$40,000 cap. The cap is not a spending target. Unused inventory budget does not become cash.
- Opening operating cash: **A$15,000.00**.
- Submitted history contains **59,056** records and is selected automatically at startup.

Do not seed or reset the database to inspect the submission. `npm run seed` is an idempotent recovery command: it creates a Submitted Run only if none exists. Additional runs are created in **Model & setup → Run 60 days**, with an integer seed. They are stored separately; select the Submitted Run again using the history selector. Model changes require a new run and must never be retroactively applied to old history.

## Where to inspect the requirements

- **Overview:** Part 1, 60-day performance, baskets, weekday/weekend comparison, day-by-day customer activity, category contribution and strongest/weakest sellers. Click a bar to inspect that day.
- **Inventory & brain:** Part 2, all required alert counts (including zeros), expiry, replenishment, closing inventory and condition/action/outcome examples. Click an evidence link to open that product/day.
- **Commercial findings:** Part 3, three observation → evidence → diagnosis → implication → recommendation chains and their limitations.
- **Assurance:** Part 4, history completeness, inventory, expired sales, transaction revenue, operating cash and next-day delivery checks. Download the full run evidence if desired.
- **Daily audit:** choose any day 1–60; filter by record type/product and expand individual records. Transaction IDs connect transaction totals to sale lines. Lot IDs connect receipts to sales/expiry. Order sequence IDs connect decisions, payments and next-day receipts. Monetary values in raw evidence are **integer cents**; website report amounts are dollars.
- **Model & setup:** the frozen assumptions, opening catalogue, prices, quantities, shelf lives, budget and cash; also the new-run control.

## Architecture and data flow

React renders six views from Express JSON endpoints. `server/catalogue.js` declares the educational product world and assumptions. `server/simulation.js` operates the store; `server/brain.js` holds stock-signal and affordability rules. A run commits atomically in one SQLite transaction; an error rolls it back rather than retaining an incomplete history.

SQLite is the primary store. `runs` holds each frozen configuration, including its full product catalogue and initial quantities. `history` holds typed, sequenced rows for customers, sale lines, transactions, opening inventory, receipts, write-offs, orders, cash, Brain decisions and daily snapshots. Payloads are JSON fields **inside SQLite rows**, not a separate JSON-file database. Product IDs and lot/order/transaction references enable audit joins. Every row belongs to a run and day. SQLite triggers reject UPDATE/DELETE for both tables; the application offers no historical edit/delete endpoint.

`server/reports.js` aggregates stored history for the selected run, and independently reconciles daily snapshots and transaction totals with underlying movements. Money is handled in integer cents. Browser reporting does not rerun the stochastic model. All four acceptance areas and the daily view share the selected run ID. Findings substitute that run's recorded figures; their interpretation remains qualified by the declared model.

API: `GET /api/runs`, `POST /api/runs` with `{ "seed": 123 }`, `GET /api/runs/:id/report`, `GET /api/runs/:id/days/:day`, and `GET /api/runs/:id/export`. There are no update/delete routes. This is a local educational application, not a multiuser production service.

## Model and Store Brain

Eight categories contain six products each. Unit prices/costs are illustrative; sizes are named. Fresh/bakery shelf life is 3 days, ready meals 4, chilled 10; ambient products do not expire within this model. Opening quantities are `ceil(popularity × 8)` for perishables and `ceil(popularity × 28)` for ambient products. This is a conservative initial assortment, not an attempt to use the entire budget.

Daily visitors: weekday baseline 150, weekend 105; Friday multiplier 1.1; independent daily multiplier 0.8–1.2. Missions: lunch 45% (1–4 requested lines), top-up 40% (3–7), essentials 15% (2–5). A line requests one unit, or two with 15% probability. Repeated product selections combine. Category preferences differ by mission, followed by within-category popularity weighting. Hours are recorded as mission-specific marks (lunch 11–14, top-up 16–21, essentials 8–19); the customer sequence is generated in arrival order and hour labels do not constitute an intra-day inventory clock. Hourly congestion and chronological rush-hour stockouts are not modelled. All customers, including visitors with no fulfilled purchase, are retained. Unavailable demand is recorded; no substitutions occur.

At each morning: receive previous-day orders, then discard lots whose expiry day is reached. Receipt day plus shelf life determines expiry. Sales consume the oldest lots first (equivalent to first-expiring first under fixed shelf lives). End-of-day demand forecast is the maximum of 0.5 and the trailing 7-day average requested units, including lost demand. Stock at/below 1.5 days' forecast is low; zero is sold out. After Day 7, stock above both 10 units and 14 times average daily sales is slow-moving. Within 2 days of expiry generates a warning.

The Brain orders low/sold-out products to 5 days' demand for ambient stock or the smaller of 3 and shelf-life-minus-one days for perishables. Slow-mover orders are suppressed. Products with least days of cover are prioritised; quantities are capped by cash. Payment is at ordering and delivery the next morning. No Day 60 orders. Forecast demand can still create shortages or waste: the rules are explainable, not optimal.

## Validation

Run:

```sh
npm test
```

Tests cover five 60-day seeds, lot/inventory/revenue/cash reconciliation, one-day delivery, append-only protection, preservation of previous runs, deliberate corruptions caught by assurance, a zero-opening-cash stress run, partial/deferred purchase quantities and slow-mover thresholds. The zero-cash stress run is test-only; normal application runs always start with A$15,000. It does not itself force a cash-constrained event because daily sales fund purchases, so direct affordability tests cover that branch.

All six automated tests and all six browser views passed, including mobile overflow checks. A clean copy was installed, built and started; creating a new run preserved the Submitted Run unchanged. The Submitted Run has PASS for every assurance check. A simulation took approximately 0.4 seconds and report generation approximately 0.35 seconds in the development environment; hardware affects timings. The optional `scripts/browser-check.mjs` exercises all six views and mobile layout using Playwright (not needed to run or mark the app).

## AI collaboration and student review

OpenAI Codex assisted with catalogue drafting, model design, React/Express/SQLite implementation, tests, reporting and this documentation. During the assisted development, review corrected a report-generation bottleneck by indexing transaction references, repaired mobile chart overflow, strengthened assurance against deliberately corrupted records, and linked commercial findings to the affected product's actual first exception day. Uniform product demand was avoided in favour of explicit mission/category/popularity weights. These are development review examples, **not a claim that the student has already independently reviewed the work**.

Before submission, the student must run the application, review and adopt or change the assumptions, understand the code and checks, and revise this paragraph to describe their own actual review decisions. Do not claim personal testing or decisions that did not occur. `VIDEO_GUIDE.md` provides a six-minute walkthrough to adapt after review.

## Limitations and remaining handover

No empirical Melbourne footfall or retailer calibration; no substitution, seasonality, promotions, theft, supplier failures, rent, utilities, hardware, tax or corporate overhead. Fixed product-level shelf lives simplify real expiry distributions. All opening lots have the same receipt day. High simulated gross margins follow the assumed prices and mix; gross profit and cash accumulation are not net profit or evidence of commercial viability. The Submitted Run records zero slow-mover and cash-constrained alerts; the UI states zero and tests exercise the underlying rules. Local-only operation, synchronous simulation and JSON payload queries are proportionate to this scale, not a production architecture.

Submit the source ZIP and a **separate 4–8 minute MP4 with working audio**, showing your face and student ID as required. The video must be recorded by you; it is not included or represented as completed. Do not submit a separate business report in place of the website. Review the uploaded MP4 before final LMS submission.

