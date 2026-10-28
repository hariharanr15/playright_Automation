# Project Setup Wizard Automation

The page object is `pages/project-management/project-setup-wizard.page.js`; regression tests are under `tests/regression/project-setup-wizard/`.

Set `SCP_WIZARD_PROJECT` to a dedicated project whose wizard is accessible. The structure regression verifies the nine-step order, titles, footer notes, row limits, Edit controls, Back/Skip/Next and Skip navigation. A completed project that redirects away from the wizard is not a suitable fixture.

To exercise creation/editing, set `SCP_WIZARD_CREATE_DATA=true`, set `SCP_WIZARD_UOM` to a valid master UOM, and optionally set `SCP_WIZARD_PHONE` to a valid phone number accepted by the application. The project must have fewer than five entries in each new step. This test creates records, edits them, rejects invalid email/phone and fractional conversion multipliers, rejects negative lead time, accepts zero lead time, edits the mapping, finishes setup and checks category/material/supplier persistence in admin screens. Created data remains in the dedicated project; the active project selection is restored afterward.

```powershell
$env:HEADLESS = 'true'
npx.cmd playwright test tests/regression/project-setup-wizard --workers=1
```

Missing project/mutation fixtures produce explicit skips. The suite has not been validated against a dedicated wizard project in this session. Popup and field locators follow the supplied labels and established page-object patterns and require confirmation against that project's deployed UI.

Remaining checks need fixtures or clarified rules: first-five ordering, actual completion checkmarks, dropdown exclusion of records outside the displayed sets, repeated additions at the five-record limit, persistence of supplier-material mappings in the admin mapping view, and the unchanged First Submittal workflow. The structure test checks the displayed maximum and a disabled/hidden Add action when five records are already visible.
