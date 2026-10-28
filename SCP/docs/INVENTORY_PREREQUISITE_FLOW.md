# Inventory prerequisite flow

Inventory mutation scenarios call `createDataset` before opening an owned activity or uploading stock movements. Each scenario generates a new material, SKU, supplier, specification, submittal and purchase order. The same generated names, quantities and saved IDs are reused throughout its workflow.

1. Read a valid reference category/UOM from the configured staging project, then create and verify the new material and base-unit SKU.
2. Create a new supplier, then map that supplier to the new material.
3. Create the submittal and component and verify the exact material/supplier relationship in Procurement Search.
4. Order the component; log its full delivery at the allocated site/location; complete and approve the mandatory pre-shipping checklist; save actual delivery date, shipping information and delivery conditions; generate the GRN and validate its saved filename, folder and positive file size against the exact delivery ID. The deployed Generate GRN action stores the PDF and returns metadata rather than emitting a browser download.
5. Only after delivery succeeds, enter Inventory, resolve the saved item/submittal/schedule IDs, and start the scenario's Inventory operations.

Business identities and quantities are generated per scenario. Category, UOM, site and location come from the configured allocation and live project data. A shipping mode is selected from the application's available options and retained in the scenario data. Form-format defaults remain reusable test inputs.

Every prerequisite is an awaited Playwright step. Exceptions stop the dependent chain immediately; the helper attaches the failed stage, generated data, completed stages and screenshot, while Playwright retains the trace. `ctx.owned.deliveryCompleted` is set only after delivery succeeds, and opening an owned activity requires it. Failed prerequisites do not expose an owned dataset to later operations.

Completed Procurement delivery creates an Inventory incoming-load record. The expected starting stock is the generated delivered quantity. The helper reconciles that quantity with the initial ledger and retains the delivery history. Later manual and bulk assertions add their movements to that verified baseline, and overdraft tests exceed the total available stock rather than assuming an empty material.

Receiving the fully delivered schedule again is a negative case: the server must reject the excess quantity without changing stock/history. Valid dependent cases use the delivered stock directly. The positive bulk file contains Internal Movement, Issue To Construction, Loss and Return; its incoming receipt was already created and verified by the delivery prerequisite.

The four local prerequisite contract checks exercise material failure, supplier/material-mapping failure, the activity gate and generated-supplier/overdraft upload inputs. These checks do not count as browser business-flow coverage. Existing read-only smoke/calendar checks against allocated records are separate from the new-record mutation lifecycle.

Run the focused delivery-to-Inventory transfer scenario in Chrome:

```powershell
$env:SCP_INVENTORY_DATA = 'reports/inventory-discovery/environment.json'
$env:SCP_INVENTORY_MUTATIONS = 'true'
$env:SCP_INVENTORY_RUN_DIR = 'reports/inventory-delivery-NEW-RUN'
$env:PLAYWRIGHT_HEADLESS = 'false'
node node_modules/@playwright/test/cli.js test --config=playwright.inventory.config.js tests/regression/inventory-management/scp-inventory-management.spec.js --grep 'Inventory manual: Internal Movement' --workers=1
```

Use a new evidence directory for each execution. Earlier Inventory results that stopped setup after component creation do not validate this prerequisite flow.
