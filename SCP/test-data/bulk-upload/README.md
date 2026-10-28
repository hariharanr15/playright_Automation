# Bulk-upload fixtures

Keep source workbooks under `<module>/templates/` so future Inventory and other bulk-upload formats have independent contracts. Do not place generated positive, negative or downloaded error workbooks alongside immutable templates: those belong in the run's `artifacts/.../bulk-upload/<module>/` directory.

Inventory's supplied template is copied byte-for-byte from `inventory_upload_template (6).xlsx` (SHA-256 `987100558977FBE8751C4F614F2220C908E3757AA1EB0F90CE07AB048988AE00`). Its sample business rows and hidden lists are historical examples, not approved stock transactions. Tests download a current site-scoped template, check the same 12-column contract, and populate dedicated dynamic records.

`utils/bulk-upload/workbook.py` uses Python's standard library only; set `SCP_PYTHON` if Python is not on PATH. All browser automation remains in the existing JavaScript Playwright framework. Source workbooks are never overwritten; existing validation lists, styles and other sheets are retained in generated files.

The separate `scp-inventory-bulk-upload.spec.js` contains one atomic-rejection negative scenario and one positive four-action scenario using the verified automatic delivery receipt. Repeated failures in the recording are not copied into tests. The template has **Submittal No** and **Date Required On Site**, not a separate **Submittal Date** column. These values and the optional PO number are taken from and cross-checked against the exact owned Procurement submittal/component; no column or date is invented.

Run only the Inventory bulk cases from `SCP` after configuring the approved allocation and a unique report directory as described in `docs/INVENTORY_MANAGEMENT_COVERAGE.md`:

```powershell
$env:SCP_INVENTORY_MUTATIONS = 'true'
node node_modules/@playwright/test/cli.js test --config=playwright.inventory.config.js scp-inventory-bulk-upload.spec.js
```

Each case creates its own material, item, supplier mapping, submittal and component. Do not retry a successful upload using the same generated workbook: doing so would create additional stock movements. Downloaded error workbooks and the exact submitted rows are retained with that case's evidence.

