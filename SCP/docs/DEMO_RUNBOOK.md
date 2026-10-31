# SCP automation – demo runbook

This runbook is for the client demo of SCP Smoke and Regression automation on staging (NRVC_Hall) in Google Chrome.

## Before the demo (about 10 minutes)

1. Close any other test runs. Only one run may use the staging account at a time, because runs share the account, the header project and the header site.
2. Open a terminal in the `SCP` folder.
3. Check that `SCP/.env` holds the staging accounts. The passwords are not shown here.

## Run everything with one command

```
npm run demo
```

The command runs these parts one after another, in a visible Chrome window, maximised:

| Part | What it covers | Approx. time |
|---|---|---|
| PM Smoke | Project Management, all 17 pages, read-only | 10 min |
| PM Regression part 1 | 92 read-only and form checks | 12 min |
| PM Regression part 2 | Data-creating checks on NRVC_Hall: reference data, materials, sites, uploads, inspectors, question sets, messages, watches. Every name carries a `PMR2-<date-time>` token; changed settings are restored | 55 min |
| SCP full regression | The other 10 modules: User Management, Supplier List, Procurement Log, Inventory, First Delivery Inspection, International Shipment, Management Dashboard, Analytics, Enterprise, Document Management | 2 h |

On screen, the banner at the top shows the current suite, scenario and step. The active menu tab and subtab are outlined.

To run only part of it:

| Command | What it runs |
|---|---|
| `npm run pm:smoke` | PM Smoke only |
| `npm run pm:regression` | PM Regression part 1 only |
| `npm run pm:regression2` | PM Regression part 2 only |
| `npm run demo -- --skip-full` | All three PM suites, without the full regression |

## Reports

At the end, the console prints `Demo summary: …\reports\demo-<time>\index.html`. That page lists every suite with its counts and links to the reports:

- **PM reports** are grouped by module and submodule. Each step shows its attempts, a screenshot on failure, and "Observed: …" notes where the expected result has not been confirmed yet.
- **The full regression report** is `SCP_Full_Regression_Report.html`, with a PDF next to it.

## Reading the statuses

| Status | Meaning |
|---|---|
| Passed | All checks of the scenario passed. |
| Known Defect | The application behaved as a registered defect (`config/scp-known-defects.js`, SCP-DEF-001…040). This is an application issue, not an automation issue. |
| Skipped | Intentionally not run. The reason is shown, for example: needs another module (part 3), needs a next-day batch, would change data that cannot be restored, or needs product-owner approval. |
| Blocked | The scenario needs input that the team has not provided yet, such as an independent source file or an archive fixture. |
| Failed | A new, unexplained failure. Each step has two attempts. Failures are listed for a later re-run, for example `npm run pm:regression2 -- --only=<IDs>`. |

## Known application behaviour to mention

- Reloading a page switches the header site to the newest site (SCP-DEF-037).
- System messages cannot be deleted (HTTP 500, SCP-DEF-032). The automation deactivates its own messages instead.
- Common UoM is shared across projects (SCP-DEF-040).
- Site uploads show no status in Bulk Upload Status (SCP-DEF-038).

## Live demo of the other 10 modules: `npm run demo:flow`

`npm run demo:flow` runs all modules except Project Management in about 5 minutes. It follows the same rules as the PM flow: one sign-in, one project (NRVC_Hall) and one site (Warehoust _NR), left-menu navigation in order, a banner on screen, and nothing saved.

Each scenario is labelled **[Positive]** or **[Negative]** in the report:

| Module | Positive | Negative |
|---|---|---|
| Management Dashboard | Tiles, Alerts, Notifications, Tasks | – |
| Enterprise (5 pages) | Each page opens with data | – |
| Procurement Log | Submittals listed | No-match search and reset; empty Add Submittal rejected |
| First Delivery Inspections | List; a completed inspection opens read-only | – |
| International Shipments | Shipments listed | – |
| User Management | Users listed | Invite Users cannot be sent with empty required fields |
| Supplier List | Suppliers listed | No-match search; empty Add Supplier rejected |
| Inventory Management | Stock listed for the site | No-match search and reset |
| Document Management (5 pages) | Each page opens | – |
| Analytics (8 pages) | Each page opens with data | SubContractor Issues no-match search |

The report is `reports/pm-flow/flow-<time>/report.html`. A different site can be set with `SCP_DEMO_SITE`.

### Suggested demo order (about 25 minutes)
1. `npm run pm:smoke` (10 min): Project Management.
2. `npm run demo:flow` (5 min): the other 10 modules, positive and negative.
3. Open both reports, and the full regression report from the unattended `npm run demo` run, as proof of depth.
