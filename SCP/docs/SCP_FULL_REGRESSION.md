# SCP full regression: module hierarchy and dynamic role-based access

`scripts/run-scp-full-regression.js` runs the SCP regression in the mandatory module order. Before any module runs, it discovers what the configured account can actually reach on the selected project. Module suites run only when that access exists. Full-suite npm commands use this runner; `npm run test:scenarios -- <file>` retains direct scenario selection.

## Commands

```powershell
npm run test:scp:full:plan        # Registration only: lists every stage's cases, no browser
npm run test:scp:full             # Execute, Google Chrome (headless unless HEADLESS=false)
npm run test:scp:full:headed
npm run test:scp:full:demo        # Headed, highlighted, read-only
npm run test:scp:full:inventory   # Also runs the owned-record Inventory mutation chain
npm run test:scp:full:owned       # Inventory + owned FDI + owned Shipment, with automatic qualified data handoff
npm run test:scp:access           # Access discovery (SCP-UM-001) and User Management only

node scripts/run-scp-full-regression.js --execute --module=procurement-log --module=inventory-management
node scripts/run-scp-full-regression.js --execute --access-matrix=reports/<earlier-run>/access-matrix.json
node scripts/run-scp-full-regression.js --execute --include-unqualified   # Only once the stated inputs exist
```

Every invocation writes a new `reports/scp-full-regression-*` folder. It contains `manifest.json`, `access-matrix.json`, `execution.json`, a list of failed/blocked/access-validation-failed scenarios, one sub-folder per stage (native HTML, detailed HTML/PDF, traces) and the consolidated `SCP_Full_Regression_Report.html`/`.pdf`.

Registration creates HTML without opening Chrome. Execution creates HTML and PDF. An earlier `--access-matrix` is retained for comparison; fresh discovery always determines current access. Each business scenario checks access again for its active account and project. Environment failures and unobserved rights remain Blocked/Unknown rather than being treated as permission denial. Credential profile names select login credentials only; they do not define expected permissions.

## Single browser session

An executed run launches Google Chrome **once**, before access discovery, and closes it only after the consolidated report is written (or when the run is terminated). The flow is: launch browser → login → select project → modules 1–11 in order → reports → close browser.

- The orchestrator starts Chrome with a throwaway profile and a DevTools port bound to `127.0.0.1`. Each stage process (Playwright or Cucumber) attaches to it over CDP and uses its single default context and tab. A stage process only disconnects when it ends; it never closes the browser.
- In this mode the Playwright `browser`, `context` and `page` fixtures all resolve to the shared browser, context and tab, so no fixture can launch another browser or open another tab. Traces are recorded per scenario on the shared context.
- Session continuity: a stage reuses the signed-in session when it belongs to the configured account and re-selects `SCP_PROJECT_NAME` if an earlier stage left another project selected.
- Account switching (access discovery, FDI access cases) happens in the same tab. Cookies and all storage for the SCP and SSO origins are cleared first, and the signed-in identity is asserted after login, so no previous user's state carries over.
- Before and after every stage the orchestrator checks the browser process and DevTools endpoint. If Chrome crashed or stopped responding, the interruption is recorded in `manifest.json` and the report, remaining stages are **Blocked**, and no replacement browser is launched.
- Exceptions, where the application flow needs two simultaneous sessions: the invited-user activation flows (User Management regression, Project Management FDI-inspector invitation) open a second context in the **same** browser instance and close it afterwards, because they verify that the Admin session stays active while the invitee signs in. PDF reports are rendered by a separate headless renderer, since PDF printing is not available in a headed browser.
- `--isolated-browser` restores the previous behaviour of one browser per stage process.

## Execution speed

| Mode | Flag | Behaviour |
|---|---|---|
| Normal | `--normal` (default when headed) | 700 ms visual pause after each major action and around each named step (`SCP_ACTION_INTERVAL_MS`, `STEP_WAIT_MS`; 500–1,000 ms is the intended range). The executing module is outlined in the left navigation. |
| Fast | `--fast` (default when headless) | No artificial pauses; Playwright auto-waiting and condition-based waits only. |
| Demo | `--demo` | Normal pacing plus element highlighting and 100 ms `slowMo`; read-only. |

Pauses are for visual pacing only. Synchronisation always uses Playwright's auto-waiting, element-state waits and the shared readiness check (loaders hidden). In headed runs evidence screenshots capture the visible viewport, because full-page capture resizes the window and causes flicker; headless runs keep full-page screenshots. The mode and interval are recorded in `manifest.json` and shown in the report header.

```powershell
npm run test:scp:full:normal        # headed, normal pacing, single browser
npm run test:scp:full:owned:normal  # same, with owned-record mutations
npm run test:scp:full:fast          # headless, fast
```

## Execution hierarchy

The order is defined once in [config/scp-module-registry.js](../config/scp-module-registry.js). A contract test fails if it changes:

1. Project Management · 2. User Management · 3. Supplier List · 4. Procurement Log · 5. Inventory Management · 6. First Delivery Inspection · 7. International Shipment · 8. Management Dashboard · 9. Analytics · 10. Enterprise · 11. Document Management

Access discovery runs first as a preflight, because every module depends on it. It is reported under User Management as SCP-UM-001. A failed stage never stops later stages or modules.

Each registry stage is one of:

- **Reviewed:** runs by default. These are the suites the reviewed application runner already qualifies.
- **Mutation:** `inventory-mutations`. It runs with `--with-inventory-mutations` and follows the new material → new supplier → submittal → completed-delivery chain.
- **Unqualified** (`qualified: false`): reported as **Skipped** together with the input it still needs. These suites create or change records without qualified allocations. They run only with `--include-unqualified`.

`requiresAccess` declares the modules a stage's business chain needs. If any of them is not accessible to the account, the stage is **Blocked**. For example, the Inventory mutation chain needs Project Management, Supplier List and Procurement Log.

## Dynamic access (SCP-UM-001)

[tests/regression/user-management/scp-dynamic-access.spec.js](../tests/regression/user-management/scp-dynamic-access.spec.js) handles each account in its own browser context. SCP business writes are aborted, and the test fails if one is attempted. For each account it:

1. Logs in and captures the associated projects: the project selector list plus the session's `userInfo.projects`.
2. Selects each target project in turn. After every switch it captures the navigation, reloads the page, captures it again and fails on any item carried over from the previous project.
3. Captures the left navigation tree. Group toggles are expanded dynamically (`NAV_GROUPS` plus any `aria-expanded="false"` control) and notification badges are stripped from labels.
4. Opens every module route by URL. It records whether the page opened, any redirect or denial text, 401/403 API responses, and whether the selected project was kept.
5. Records action-control visibility, such as Add Supplier or Add Submittal. This is visibility only and does not prove server-side enforcement.
6. Records the session's effective role and permission codes for that project.
7. Compares the observations with the authoritative expectations, if they were provided, and merges the result into `access-matrix.json`.

Accounts and projects:

- With no expectations file, the configured account is checked on `SCP_PROJECT_NAME`. Set `SCP_ACCESS_PROJECTS` to a comma-separated list of projects, or to `all`, to check more.
- With `SCP_ACCESS_EXPECTATIONS` set, every account and project in the file is checked. See [test-data/scp-access.example.json](../test-data/scp-access.example.json).
- Each project entry with expectations must name its `source`, meaning the Organization Admin configuration it came from. Placeholder values are rejected.

**No role-based assumptions.** Nothing infers expected access from a role name or from the application's own permission codes. The `sessionPermissions` per module are indicative mappings. They are reported as informational findings and never set a status. Without an expectations file, statuses are recorded as *observed*, not *validated*.

| Condition | Status |
|---|---|
| Opened from navigation (expected, or no expectation) | Accessible |
| Not in navigation and route not reachable (expected, or no expectation) | Not Accessible |
| Expected accessible but not granted, or expected denied but reachable from navigation or direct URL, or an action control differs from its expectation | Access Validation Failed |

The orchestrator gates each module on the result for the **primary account** (the account matching `SCP_USERNAME`) on `SCP_PROJECT_NAME`:

| Result | Effect on module stages |
|---|---|
| Not Accessible | Reported as Not Accessible; no stages run |
| Access Validation Failed, observed inaccessible | Reported as Access Validation Failed; no stages run |
| Access Validation Failed, observed accessible | Stages run; the access result stays on the module |
| Discovery failed or produced no result | Blocked |

## Statuses, retries and reruns

The detailed reporter recognises `not-accessible` and `access-validation-failed` test annotations. Results are reported as Passed, Failed, Skipped, Blocked, Not Accessible or Access Validation Failed. Retries are unchanged: at most two attempts per managed step, no whole-test retry, and a mutation is not repeated without an existence verifier.

A scenario title can declare its requirement ID (`SCP-UM-001 …`). Otherwise the ID is derived from the file and title.

To rerun failed scenarios:

```powershell
node scripts/rerun-scp-scenarios.js reports/scp-full-regression-<run>/execution.json --status=all            # plan
node scripts/rerun-scp-scenarios.js reports/scp-full-regression-<run>/execution.json --id=SCP-UM-001 --execute
```

`--status` also accepts `access`. Reruns reuse recovery checkpoints, so validated prerequisite records are not recreated. Keep the original run's `SCP_ACCESS_EXPECTATIONS`, `SCP_ACCESS_PROJECTS` and allocation variables set: the rerun tool refuses to run when the current registration no longer matches the original case.

After the full run finishes, publish a separate HTML/PDF review with explicitly selected targeted results:

```powershell
npm run report:scp:recoveries -- reports/scp-full-regression-<run> reports/targeted-recovery-<run>/<scenario>/execution.json
```

Pass additional execution JSON files to include more recoveries. The review preserves original counts/errors and source evidence, uses the latest selected outcome for the same account/project/scenario, and maintains the module reporting hierarchy. It refuses to publish an unfinished full run. Successful original prerequisite flows remain available in their checkpoints.

Supplier List also has a guarded form-readiness and cancellation scenario. It waits for the supplier-user initialization response before filling fields and never saves a supplier. Inventory mutations use the same readiness check before saving their owned supplier.

The dedicated FDI flow (`SCP-FDI-101`) uses a passed owned delivery allocation in `SCP_FDI_OWNED_DATA`, enabled with `SCP_FDI_OWNED_MUTATIONS=true`. It verifies the exact inspection ID, self-assignment, persisted draft answers, uploaded photo and completion. Every mutation is restricted to that inspection; shared settings, questions, assignments to other users and provider sync are blocked. Reruns verify saved assignment/draft/photo/completion before performing any action. The full runner includes this stage when enabled.

Shipment route qualification reads only the selected project's shipment list. An incomplete origin/port allocation is Blocked before creating a new shipment; existing shipment records are never used as mutation targets.

With `--with-owned-mutations`, a passed Inventory case with matching material/component/delivery/GRN identities supplies the FDI and Shipment reference allocation. Route qualification supplies origin and port labels by joining records from the same project and source submittal. The Shipment flow creates its own planned submittal, flag and container, then verifies shipping edits and status. Source shipments remain read-only. These additional owned flows require staging and restrict every write to their exact owned IDs.

`SCP_INVENTORY_DATA` takes precedence. If it is absent, the owned runner can reuse the existing approved workspace discovery at `reports/inventory-discovery/environment.json` when its project matches the configured project. Every referenced site/material/location is checked live before creation. Missing or invalid allocations do not abort independent modules.

Bulk recovery checks the saved upload job before any submission. Successful uploads reuse their existing activities and terminal status; in-progress jobs block resubmission. Negative runs reuse their existing atomic-failure job and download its error file through Chrome. A positive recovery reconciles exact row comments, quantities and record IDs, including the effect of Returns on net Procurement received quantity, before proceeding. Ambiguous or duplicated saved rows stop the workflow.

## Verified behaviour (26 Oct 2026, staging, configured account)

Read-only discovery on three projects with different roles for the same account: SCP_Testing_Ram (Subcontractor, 62 permission codes), VC SCP 001 (Supplier, 87) and NRVC_Hall (Project Admin, 229). Evidence is in `reports/access-discovery-multi-20261026/`.

- No navigation was carried over between projects, and the project context was kept on all 33 module probes.
- **Finding:** on SCP_Testing_Ram (Subcontractor), International Shipments is absent from the navigation, but `/international-shipments` opens by direct URL with **+ Log Shipment** visible. Whether this is a defect depends on the configured Subcontractor permissions. Supply an authoritative expectation to classify it.
- Subcontractor and Supplier roles show almost the same navigation and action controls as Project Admin, including Invite Users and Add Supplier. This is recorded as observed. Validating it needs the Organization Admin configuration.

## Limits

- Action checks cover control visibility only. Enforcement on submit is not exercised, because that would require writes.
- Some modules declare no action controls. Inventory **Add Activity** was removed from the registry because it was not visible on the landing page without a site context.
- Discovery takes about 2 minutes per project.
