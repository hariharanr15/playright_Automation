# FDI Automation Coverage

Run the FDI module in headless Chrome:

```powershell
$env:HEADLESS = 'true'
npx.cmd playwright test tests/regression/first-delivery-inspections --workers=1
```

## Implemented checks

- FDI Settings heading and exact checkbox labels; saving/reloading all Yes and all No states; preventing contradictory photo settings. Original project settings are restored in a finally block.
- Optional unconfigured-project defaults (`SCP_FDI_UNCONFIGURED_PROJECT`) and project isolation (`SCP_FDI_SECOND_PROJECT`).
- Fresh Material/Supplier/Submittal/delivery lifecycle: Self Assign, Unassign Self, Admin Assign, saved answers, conditional report fields, no-linked-documents state, invalid file rejection, mandatory-photo submission rejection, PNG/JPG photo upload and popup navigation in edit/view modes, completion and Sync.
- Optional reassignment to `SCP_FDI_REASSIGN_INSPECTOR`, loss of the previous assignee's actions, assignment back, and saved-answer retention. The target must be a different enabled inspector mapped to the generated Material, for example through All Materials. Missing prerequisites are reported as a coverage-gap annotation.
- Existing smoke and operational flows create their own PNG photo files in the test output directory.
- Inclusive delivery-date boundary and combined-filter checks use the deployed calendar controls and clear the dates together with all other filters.
- A dedicated photo regression accepts `SCP_FDI_PHOTO_SUBMITTAL` (an assigned draft with uploads enabled). It uploads PNG/JPG and checks popup navigation. `SCP_FDI_PHOTO_COMPLETE=true` additionally submits that disposable report and checks completed viewing.
- Seeded access tests use separate browser contexts per account, assert Procurement Log visibility and actions, FDI visibility and actions, and optionally linked document states/viewers. No access expectations are inferred from the application's returned permission flags.

## Seeded access cases

Copy `test-data/fdi-access.example.json` to a local file, replace placeholders with dedicated seeded test records, and set `SCP_FDI_ACCESS_CASES` to its path. Set the credential environment variables named by each case. Do not store passwords in JSON. Configured cases fail if their credential variables are missing; an absent case file produces an explicit skipped prerequisite test.

Add independent cases for Project Admin, each relevant role in the Project-Owning Organisation, Supplier Organisation match/mismatch, no Supplier, role-permission intersection, Responsible user outside the Supplier Organisation, and a Responsible user whose role has already changed. Each case names explicit expected records and action booleans. Use records present on the first unfiltered FDI page; the suite does not traverse pagination, so do not use off-page records for negative visibility assertions. Procurement checks search each exact submittal and wait for its filtered API response.

Optional `report` expectations on a visible inspection contain `settings` (all four checkbox labels mapped to booleans), `specSectionNo`, and `documents` (file names). An empty `specSectionNo` checks the exact missing-spec message; a populated value and empty document array check the no-documents state. Populated documents check file names and popup viewers.

Set `report.submitWithoutPhotos` to true only for a dedicated disposable draft assigned to the case's account, with photo upload enabled and mandatory photos disabled. This fills, saves, and submits the report with zero photos. It completes the record, so reseed it before repeating the test.

## Remaining integration coverage

- Notification recipients require a notification capture service or a defined notification API/event fixture. UI action visibility does not prove delivery or suppression of Notify events.
- Responsible assignment replacement, allowed-role selection, immediate cross-session access, and assignment retention during an actual role change need dedicated mutable accounts/records. The Procurement Log page object exposes `assignResponsible` with eligible/excluded dropdown assertions, but no mutation test runs against shared accounts by default.
- The assignment helper supports eligible/excluded inspector assertions; direct-material and category eligibility combinations need seeded configuration, including disabled and unrelated inspectors.
- Optional-photo submission with zero photos requires the disposable fixture described above. Supported formats beyond PNG/JPG, completed-report settings history, and upload limits require additional records or confirmed rules.
- The companion Spec Documents story and exact upload limits/supported format list have not been supplied.
- The base listing story's prohibition on pending View conflicts with the Responsible-user View grant; see `FDI_LISTING_REQUIREMENTS.md` before configuring pending Responsible-user cases.

This repository contains automation, not the SCP application implementation. Changes here verify deployed application behavior; they do not implement its server-side permissions or UI features.
