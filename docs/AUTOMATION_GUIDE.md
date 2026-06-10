# Automation Guide

This project contains Playwright automation for Voyage Control booking, booking-list,
equipment-management, and user-management flows.

## Main Commands

```powershell
npm run test:smoke
npm run test:regression
npm run automate:full-application
npm run automate:user-management
npm run automate:booking-list-exports
```

Use the `:headless` variants for unattended runs where available.

## Active Areas

```text
playwright.config.js
run-full-application.js
fixtures/baseTest.js
pages/
scripts/
tests/smoke/
tests/regression/
utils/
```

## Generated Output

Automation output is generated under these folders and can be cleaned when no
longer needed:

```text
reports/
screenshots/
test-results/
PDF download/
```

Keep `auth.json` only when you want to reuse the current logged-in browser
session.
