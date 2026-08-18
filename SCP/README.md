# SCP Playwright Automation

This project is a reusable Playwright Page Object Model scaffold for the SCP application.

## Structure

```text
SCP/
  config/              Runtime configuration helpers
  fixtures/            Shared Playwright fixtures
  pages/               Page objects and reusable components
  pages/tabs/          Tab-level page objects
  test-data/           Data for configured tabs and flows
  tests/smoke/         Fast availability checks
  tests/regression/    Functional tab-level checks
  tests/support/       Test wrappers, steps, and assertions
  utils/               Common utilities
```

## Setup

```bash
cd SCP
npm install
npx playwright install
```

Create `SCP/.env` from `.env.example`, then set:

```text
SCP_BASE_URL=
SCP_USERNAME=
SCP_PASSWORD=
SCP_TAB_NAMES=First Real Tab,Second Real Tab
```

## Run

```bash
npm run test:smoke
npm run test:regression
npm run test:headed
npm run test:management-dashboard:headed
npm run test:first-delivery-config:headed
```

## Current Automated Flow

The first SCP flow automates:

1. Open the Voyage Control SSO login page.
2. Login with `SCP_USERNAME` and `SCP_PASSWORD`.
3. Select `Supply Chain Planner`.
4. Open the SCP management dashboard.
5. Open `Project Management`.
6. Open `First Delivery Inspection Config`.

Set `SCP_ACTION_INTERVAL_MS` in `.env` to control the pause between page operations.

## Adding More Tabs

1. Add the tab name to `SCP_TAB_NAMES` or `test-data/scp-tabs.json`.
2. Create a page object under `pages/tabs/` when the tab has unique actions.
3. Add smoke or regression coverage under `tests/`.

The base classes already provide reusable navigation, login, visibility checks, and highlighted interactions.
