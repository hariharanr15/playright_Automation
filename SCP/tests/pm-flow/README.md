# Project Management flow (Smoke / Regression)

Scenarios: `docs/functional-discovery/PM_SMOKE_SCENARIOS.md` and `PM_REGRESSION_SCENARIOS.md`.

## Run

```bash
npm run pm:smoke                                   # all smoke scenarios
npm run pm:smoke -- --only=PM-SMK-009,PM-SMK-019   # re-run selected scenarios (sign-in always runs first)
npm run pm:smoke -- --headless                     # without a visible window
```

Each run writes `reports/pm-flow/<suite>-<timestamp>/`:

- `report.html` – totals, results by module › submodule, every step with attempts, errors and screenshots, and the re-run command
- `results.json` – the same data for tooling
- `screenshots/` – one image per failed attempt

## How a run behaves

- Google Chrome, maximised to the screen (`viewport: null`, `--start-maximized`).
- One sign-in (Project Admin from `SCP/.env`) and one project selection (`SCP_PROJECT_NAME`, default NRVC_Hall) per run; every scenario runs in the same tab.
- Scenarios follow the left-menu order. `PmNavigator.open()` clicks a menu entry only when the browser is not already on that page, and expands a group only when it is closed.
- Every step gets at most **two attempts** (open lists and modals are closed in between). After a second failure the step is recorded as Failed with a screenshot and the flow continues. A failed `critical` step (such as opening the page) blocks only the rest of its own scenario. If sign-in fails, the remaining scenarios are recorded as Blocked.
- Visual cues: a banner in the page header shows suite, scenario and step; the active Project Management menu path is outlined; the element being used is briefly outlined.
- Pause between steps: `PM_FLOW_STEP_INTERVAL_MS` (default 800).

## Files

| File | Purpose |
|---|---|
| `pm-smoke.spec.js` | Smoke scenarios PM-SMK-001…020 |
| `support/pm-flow.js` | Run harness: output folder, visuals, navigator, runner, report |
| `support/pm-runner.js` | Scenario / step execution, two attempts, continue on failure, results |
| `support/pm-navigator.js` | Project Management menu map, navigate-only-when-needed, modal clean-up |
| `support/pm-visuals.js` | Header banner, menu highlight, element outline |
| `support/pm-report.js` | HTML report |
| `../../playwright.pm-flow.config.js` | Chrome, headed, one worker, no Playwright retries |
| `../../scripts/run-pm-flow.js` | `npm run pm:smoke` / `pm:regression` launcher |
