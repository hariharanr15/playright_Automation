# Procurement Log – Functional Discovery (SCP Staging)

| Item | Value |
|---|---|
| Discovery date | 2026-11-02 |
| Environment | Staging only: `stg-login.voyagecontrol.com` → `stg-supplychain-app.voyagecontrol.com` |
| Account | The user's own SSO account. The user typed the password into the MCP browser; it was never passed to tools or written to logs |
| Project / site | `NRVC_Hall` / default site `Site T2 Pmr2-2611011614` (app opened on `LLE - Test`; switched by hand) |
| Method | Playwright MCP, single Chromium session, one tab. **Read-only so far**: forms were opened and closed without saving, and the empty Add was used only to trigger validation |
| Status | Draft. Part 1 is read-only (list page, filters, forms, detail drawer, templates). Part 2 (§6) covers write flows on NRVC_Hall and was approved by the user on 2026-11-02 ("you can create new records"). No automation code has been written |
| Role | **Project Admin** (confirmed by the user, 2026-11-02) |

Evidence tags are the same as in [PM_FUNCTIONAL_DISCOVERY.md §1](PM_FUNCTIONAL_DISCOVERY.md): **[O]** observed today, **[R]** product-owner rule, **[I]** inferred and unverified.

Screenshots and downloaded files are in `.playwright-mcp/` (`proc-01…09*.png`, `submittal-upload-template.xlsx`, `component-upload-template.xlsx`, `Submittal-Report-20261102.xlsx`). That folder is untracked scratch, so copy anything worth keeping into `evidence/`.

## 1. Entry and context [O]

- Menu: `Procurement Log` → `/procurement-log`. The Help link points to `voyagecontrol.com/support-procurementlog`.
- On NRVC_Hall the side menu also shows `International Shipments`, which LLE - Test doesn't have (**[I]** it's controlled by project configuration).
- After a full reload the project stays selected, the site shows `Select Venue` for about 2–4 s, and the grid shows **`0 items`** before loading (57). Automation must wait for the site name before reading the count.
- After a reload every filter goes back to its default (date range, search, status and watched all reset; rows per page goes back to 25).

## 2. List page [O]

### 2.1 Toolbar
| Control | Behaviour observed |
|---|---|
| Start / End date | Defaults to **today − 1 month → today** (02/10/2026 → 02/11/2026). The inputs are **read-only**, so dates must be picked from the calendar (month and year dropdowns plus Previous/Next). The month list stops at the current month. **The range filters on `Created At`, not Date Required On Site**: a record with Required 05/12/2026 created on 31/10 shows in the October range. Range 01/11–02/11 gave 16 items |
| Search submittals… | Runs on **Enter** (typing alone didn't refresh within 2 s), ignores letter case, and matches Material Name (`43 inches` gave 6 items). Clearing it and pressing Enter restores the list |
| Status | Multi-select listbox: `Delivered`, `Not Ordered`, `Partial Delivery`, `Ordered`, `Not Ordered At Risk`, `Partial Delivery At Risk`, `Ordered At Risk`. The button shows the number selected (`Status1`). Delivered gave 30 items, and every row shown was Delivered |
| Add Submittal | Opens the modal (§3) |
| Filters | Opens the **Advanced Filter** builder (§2.2) |
| Only my watched | Sends `watched_only=1&watched_categories=<26 categories>&watched_trades=Electrical` to the server. The count stayed at **57**, so it's unclear whether every record matches a watch or the filter is ignored (Q-PL-3) |
| Assign Responsible | With no rows selected: red toast "Select one or more rows before assigning a Responsible user." |
| Bulk Delete | With no rows selected: red toast "Select one or more rows before deleting." |
| Import ▾ | `Import Submittal`, `Download Template`, `Import Component`, `Download Component Template` (§5) |
| Export | Downloads `Submittal_Report_YYYYMMDD.xlsx` immediately, honouring the current filters (§5.3) |
| `N items` | Total count for the current filters |

### 2.2 Advanced Filter [O]
- Each condition row has `(` / `( )`, a **Column** (every grid column), an operator (`=`, `!=`, `<`, `>`, `<=`, `>=`, `Contains`), a **Value**, `)` / `( )` and **Remove**. Buttons: `Add Condition`, `Apply Filter`, `Clear Filter`.
- Supplier Name `Contains` `LG` gave 11 items, all LG. `lg` gave the same 11, so **matching ignores letter case**.
- `Clear Filter` closes the panel and returns to 57 items.
- No AND/OR selector was seen with one condition (**[I]** it may appear with two or more; not tested).
- Each interaction with the builder logs React "two children with the same key" errors, caused by the three columns all named `Spec Section No` (OBS-PL-1).

### 2.3 Grid [O]
- Columns, in order: Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, EPD Exists, Date Required On Site, Status, Source, Actual Delivery Date, **Total Count 1386, Total Count 1574, Total Count 15, Total Count 87**, **Spec Section No ×3**, Responsible, ⋮. **[I]** The "Total Count …" and duplicate "Spec Section No" columns are custom fields from Procurement Log Configuration ([PM §5.13](PM_FUNCTIONAL_DISCOVERY.md)), probably added by earlier automation runs.
- Material Name shows `+N` when a submittal has more than one material (e.g. `43 Inches +2`).
- **Columns** button opens a "Show / hide columns" list of checkboxes plus `Show all`. Unticking `Source` removed its column, and `Show all` restored it. **Escape doesn't close the panel**, and while it's open it blocks clicks on the grid; click `Columns` again to close it.
- Sorting: clicking a header sorts **ascending** first (checked on Submittal No over 57 rows).
- Left/right arrow buttons above the grid scroll the columns sideways.
- Pagination: `Rows per page` offers 10 / 25 (default) / 50 / 100, with Previous, page numbers and Next. At 100, all 57 rows show and Next is disabled.
- Data on NRVC_Hall today: 57 submittals, all `Source = Manual`; mostly automation records (`Inventory manual entry <hex>`, `Structural Steel Material Specification NNN`).

### 2.4 Row ⋮ menu [O]
`Edit` · `Assign Responsible` · `Delete` · `Alert` · `Flag International`. Only Edit was opened (§3); the others change data and weren't clicked.

### 2.5 Row click → Submittal detail drawer [O]
- Clicking a row opens a right-hand drawer and updates the URL to **`/procurement-log?submittal=<uuid>`** (a link to one submittal). The chevron button closes it and removes the parameter.
- Header: `Materials:` chips (`(primary)` marker), "No other materials mapped to this supplier", a `+` (New material) button.
- **Details:** Spec section no., Spec Description, Material, Schedule ID, Submittal no., Total Value of Ordered Items, Value of items Pending to be delivered, Date Req. on site, Required QTY, Received QTY. Buttons: `Add Component` and a **Bulk upload Components** icon.
- **Components table:** "Select components to apply a bulk action", `Select not-confirmed`. Columns: (select), (expand), Date Req. on site, Material, QTY, Status, Lead time in weeks, Lead time status, Expected Delivery, UOM, Actions.
- Component actions: `Lead Time`, `Order`, `Other Actions ▾` → `Trigger Alert`, `Update Status`, `Audit Trail`, `Delete`.
- The components table first shows "No data found" and fills in about 1 s later, so automation must wait for rows.
- Example (INV-SUB-51c5…): the component has Date Req 31/10/2026, QTY 344 Pounds, Partial Delivery At Risk, lead time 2 weeks, Not Confirmed, Expected 14/11/2026. But the header shows **Date Req. on site `-`, Required QTY `- Pounds`, Received QTY `- Pounds`, Total Value of Ordered Items `-`** and Value Pending `$31.50` (OBS-PL-4).

### 2.6 Component Audit Trail [O]
- Panel `Audit Trail` with a date range (defaults to last month), Search, an `All Fields` dropdown, and columns `Date | Edited By | Action | Field | Old Value | New Value`.
- On INV-SUB-51c5… there were 35 entries: `SubmittalSchedule — Created/Updated` (by the user's email), plus `FirstDeliveryInspection — Created/Updated`, `ShippingDetails — Created` and `ConditionAtDelivery — Created` (by `system`).
- **This audit trail does record FDI changes** (status, assigned to, inspected by). That bears on PM R67 and FDI-29, which said "audit trail not found" (Q-PL-5).
- 14 of the 35 entries are field `record id` changing from `-` to `-`, which is noise (OBS-PL-6).

## 3. Add Submittal / Edit Submittal modal [O]

| Field | Type | Notes |
|---|---|---|
| Spec selection no.* | text + `Skip for Now` | The label says "selection"; the grid says "Spec Section No" (OBS-PL-7) |
| Spec description* | text + `Skip for Now` | |
| Schedule Id* | text + `Skip for Now` | |
| Submittal no.* | text + `Skip for Now` | |
| Suppliers* | picker `Choose Suppliers` | Unfiltered list of about 90 project suppliers; no search box seen |
| Materials* | picker `Choose Materials` + `New material` | "First selected material is the primary." |
| Total Count 1386 / 1574 / 15 / 87 | number | Custom fields, all optional |
| Button | `Add` (create) / `Update` (edit) | Closed with ✕ |

- **Validation (empty Add):** "Spec selection no. is required", "Spec description is required", "Schedule Id is required", "Submittal no. is required", "Suppliers is required", "At least one material is required". Nothing was created (still 57 items).
- **`Skip for Now` fills the field with the literal `Pending`**. That explains the `Pending`/`pending` values in the grid. The red "is required" message **stays visible** after Skip fills the field (OBS-PL-8).
- Edit opens with the same fields filled in. Supplier and material show as chips.

## 4. Status values [O]
Grid / filter labels: Not Ordered, Not Ordered At Risk, Ordered, Ordered At Risk, Partial Delivery, Partial Delivery At Risk, Delivered. The export uses the raw values (`partial_delivery_at_risk`).

## 5. Import / Export [O]

### 5.1 Submittal template (`submittal_upload_template.xlsx`)
One sheet `Template` with headers only (no sample rows, no data validation):
`Spec Description, Schedule Id, Material Name, Submittal No, Supplier Name, Source, Actual Delivery Date, Total Count 1386, Total Count 1574, Total Count 15, Total Count 87, Spec Section No, Spec Section No, Spec Section No`.
- The template follows the project's log configuration: custom columns are included and **Spec Section No appears 3 times**.
- **Date Required On Site, Status, EPD Exists and Responsible are not in it** (**[I]** they come from components or other actions).

### 5.2 Component template (`component_upload_template.xlsx`)
`DateReqOnSite, Material, QTY, Status, Purchase Order No, PO Date, Submittal No`, headers only.

### 5.3 Export (`Submittal_Report_20261102.xlsx`)
- Sheet `Filtered Submittals`, 57 data rows, the same as the grid.
- 47 columns, **a different set from the grid**: Submittal ID, Spec Section No, Spec Description, Submittal No, Schedule ID, Actual Delivery Date, Supplier, Date Required On Site, Ball In Court, Cost Code, Created By, … about 20 Procore-related columns …, Supplier Name, EPD Exists, Supplier ID, Material Name, Material Master ID, UOM, UOM ID, Project ID, Created At.
- Problems: the custom "Total Count" columns are missing; `Supplier` is empty while `Supplier Name` is filled; Specification ID holds the literal text `None`; Status is the raw value; dates are Excel serials with no date format applied (OBS-PL-9).

## 6. Write flows (part 2, 2026-11-02) [O]

Run tag `PLD1102`. Records created on NRVC_Hall (none deleted): **PLD1102-SUB-01**, **pld1102-sub-01**, **PLD1102-SUB-04** (imported), one component on SUB-01 (PO `PLD1102-PO-01`) and one imported component on SUB-04. SUB-01 is also flagged as an international shipment.

### 6.1 Add Submittal
- **Supplier picker is single-select** (no search). **The Materials list is empty ("No options.") until a supplier is chosen**, and then shows only that supplier's materials, with a `Search…` box. Materials are multi-select.
- **Schedule Id accepts digits only** ("Only numbers are allowed"). But `Skip for Now` writes `pending` into the same field, and an existing record has Schedule Id `pending` (OBS-PL-12).
- Success: toast "Submittal added successfully", the count goes up, and the custom number field is saved. The Spec value fills all three `Spec Section No` columns. Status and Date Required show `-` until a component exists.
- **Primary material = the first one clicked** (43 Inches, then 1.2L Kappa Engine). The grid shows `43 Inches +1`. The picker button lists them alphabetically, which is misleading but harmless.
- **Duplicate check on Add:** the same Submittal No in a different case with a trailing space (`pld1102-sub-01 `) + the same material gives **409** "A submittal already exists for Submittal No 'pld1102-sub-01' and Material '43 Inches', added on 02 Nov 2026. If you don't see it in the Procurement Log, widen your date range filter…". So the check **ignores case and surrounding spaces, and the key is Submittal No + Material**.
- The same Submittal No with a **different material is accepted**. It's stored trimmed but keeps its case (`pld1102-sub-01`), so two submittals now show "the same" number in different case (Q-PL-8).

### 6.2 Edit Submittal
- Edit → Update shows "Submittal updated successfully".
- **The duplicate check doesn't run on Edit.** Changing pld1102-sub-01's material to 43 Inches was accepted, so it now duplicates PLD1102-SUB-01 + 43 Inches, which Add had rejected (OBS-PL-13, defect candidate). The record was left as evidence.

### 6.3 Detail drawer after creation
- The materials bar becomes editable: chips with ×, a `+ Add material` dropdown and `+`.
- The header shows Supplier but no Schedule ID here, while the older Inventory record showed Schedule ID and no Supplier. **[I]** The layout depends on the data.
- Currency follows the project (₹ INR). The older record showed `$31.50`.

### 6.4 Components
- **Add Component:** Date Req. on Site* (calendar), QTY*, Material* (dropdown of the submittal's materials, defaulting to `(primary)`), Material and UOM (read-only, from Material Master, e.g. Pieces), PO no., PO Date, Value (INR prefix), Currency (`Project default (INR)` + 20 currencies), Upload File. Empty ADD gives "Date Req. on Site is required" and "Quantity is required". The date error **stays on screen after a date is picked** (same pattern as OBS-PL-8).
- Saving gives the toast **"Schedule added successfully!"** ("component" in the UI, "schedule" in the API and messages). With a PO no., the status is **Ordered**, lead time defaults to **1 week**, and Expected Delivery = **PO Date + lead time** (02/11 + 1 week = 09/11). The header picks up Date Req. 30/11/2026 and Required QTY 10. The grid row now shows Date Required 30/11/2026 and Status Ordered.
- **Total Value of Ordered Items stays ₹0.00** while Value Pending = ₹1,000.00 for an Ordered component worth 1000 (OBS-PL-14).
- **Lead Time** → "Update Lead Time": Lead Time In Weeks + Lead Time Confirmed checkbox, Submit. Setting 3 + Confirmed gave Lead time status `Confirmed` and Expected Delivery 23/11/2026 (PO date + 3 weeks). No toast.
- **Order** opens **"Edit Component"** (the same form filled in, button `Update`). Changing QTY 10 → 12 saved, but the toast said **"Schedule added successfully!"** on an update (OBS-PL-15).
- **Update Status** (Other Actions) → Status (the 7 statuses) + Status Comments, `ADD`. Choosing **Delivered** returned **200 "SubmittalSchedule updated successfully"**, but the status **stayed `ordered`**. Only the comment was saved, and the UI showed no message. The schedule list reports `grn_required: true` and `pre_shipping_required: true` for this project (OBS-PL-16, Q-PL-9).
- **Trigger Alert** → "Send Notification" with a pre-filled message: "Delivery for Item 43 Inches of Qty (12) is expected by 23-11-2026 ReqOnSiteDate 30-11-2026." The recipients aren't shown, so it was **not sent** (Q-PL-10).
- **Audit Trail** on the new component logged Created, actual quantity 10→12, lead time 1→3, confirmed False→True and expected delivery 09→23 Nov. **Update Status left no entry** (OBS-PL-17).

### 6.5 Row actions
- **Assign Responsible** (row): "Submittal PLD1102-SUB-01 has no Responsible user yet." Choose from 25 project users, then `Assign` (disabled until a user is chosen) or `Cancel`. Toast: "Responsible user assigned." The grid's Responsible column updates.
- **Bulk Assign Responsible** on 2 selected rows: "The user you choose becomes Responsible for the **2** selected submittals, replacing anyone assigned before." Toast: "Responsible user assigned to 2 submittal(s)." The selection clears afterwards.
- **Flag International** → "Flag as International Shipment": Manufacturer Name (pre-filled with the supplier), Manufacturer Country* and Manufacturer City, then `Flag`. With an empty country: "Manufacturer country is required." Success: "Submittal flagged as international shipment."
  - The row menu doesn't change (no Unflag, no marker), and **flagging again opens an empty form and is accepted again** (OBS-PL-18). International Shipments still lists the submittal only once.
  - On International Shipments → Risk Dashboard the row reads PLD1102-SUB-01 / 43 Inches / LG / South Korea / Transit Est. 20 days / **Required Date `-`** / **status `Pending Order`**. The component has Date Req. 30/11 and is Ordered (OBS-PL-19).
- Not clicked: row `Alert` (may notify outside parties), `Delete` and `Bulk Delete` (records are never deleted, R14).

### 6.6 Import
- Import Submittal / Import Component: file chooser, then "Upload Confirmation: You are about to upload <file>. Are you sure you want to proceed?" with Cancel / Upload.
- **Submittal import with `Source` empty: fails with 400** "All rows failed validation, missing fields, or invalid data types." The failure report (columns snake_case, duplicates named `spec_section_no.1/.2`, plus `reason`) gives only **"Validation error"**, with no field named. The toast gives no link to the report (OBS-PL-20).
- PM **Bulk Upload Status** lists that fully failed Submittals upload with **Status `-`**. R20 says it should show `Failed`, so this is **SCP-DEF-001 again, now on Submittals uploads**.
- With `Source = Manual`: 200 "All 1 submittals uploaded successfully." Toast "File Uploaded Successfully", the row appears (Source Manual, custom count saved). So **Source is required on import** but neither the template nor any message says so.
- **Component import** (`2026-12-15`, `43 Inches`, 5, `Not Ordered`, no PO, `PLD1102-SUB-04`): "All 1 components uploaded successfully." The grid shows Date Required 15/12/2026 and Status Not Ordered. An ISO date string was accepted. The response includes a `failed_file` path even with 0 failures.

### 6.7 Part 3 – rules, alert, delivery → GRN → Delivered, deletes (2026-11-02) [O]

**Product-owner answers (rules for this module):**
| # | Rule |
|---|---|
| PL-R1 | Trigger Alert may be sent during automation |
| PL-R2 | Delete and Bulk Delete may be tested (on records the run created) |
| PL-R3 | **The same Submittal No with several materials is expected** (Q-PL-8 answered). OBS-PL-13 still stands: Edit can create the exact Submittal No + **same** Material pair that Add rejects |
| PL-R5 | A delivery's Item Name may list other materials (e.g. `50 Inches` on a `43 Inches` component) |
| PL-R6 | A Delivered submittal must show its Actual Delivery Date in the Procurement Log grid |
| PL-R4 | **On this project a component reaches `Delivered` only through the delivery → GRN flow** (Q-PL-9 answered). OBS-PL-16 becomes a UX issue: Update Status offers Delivered, then silently ignores it |

**Trigger Alert (sent):** toast "Notification sent successfully". `POST /api/notification_system/` stores `to_whom: "subcontractor"`, `subcontractor_ids: null` and the message text, so the actual recipients aren't visible (Q-PL-10 partly open).

**Delivery → GRN flow** (PLD1102-SUB-01, component 43 Inches × 12). Each step was done in the UI and its result observed:
1. Clicking the component's **Material cell** opens the component view (URL adds `&schedule=<id>`). It has buttons `+ Log Delivery`, `Edit Component` (disabled), `Delete Component` (disabled) and `QR Label`. It shows Required / Received / Rejected / Remaining QTY, Value Delivered and Remaining Value, plus `Details` / `Files` tabs. The delivery grid columns are Location, Item name, Quantity, Conversion Factor, Good / Damage / Shortage / Over / Returned QTY, Base UOM QTY, Expected / Actual Date of Delivery and actions.
2. **+ Log Delivery** → "Add Delivery": Expected Date Of Delivery*, Actual Date Of Delivery, Location* (site locations, e.g. `Loc X Pmr2-2611011614`), Item Name* (offered **50 Inches and 43 Inches** for a 43 Inches component, Q-PL-11), Required Remaining Qty (read-only), QTY*. Saved with no toast. The row shows Conversion Factor `1 Pieces` and Base UOM QTY `12 Pieces`. Row actions: `Pre Shipping Info`, `files`, `Print / download QR label`, `Edit`.
3. **Pre Shipping Info** → "Add Pre-Shipping Details": **26 questions**, each with a Comment (some inputs have `type="bool"`; any text is accepted) and Complete (`YES` / `NA` / `NO`), plus a supplier note. Validation: "Answer every Questions" (Y/N missing) and then "Please complete all fields before submitting." (comments missing), so **every comment is mandatory**. Confirm gives "Shipping Details updated successfully!" and two "Notification sent successfully" toasts.
4. **Approve Pre-Shipping Checklist** shows the answers read-only (**questions listed in a different order** from the entry form, answers still matched), a note box, and `Reject` / `Approve`. Approve gives "Checklist Generated Successfully!" and the icon becomes `Approved`.
5. **Edit** → "Edit Delivery": set Actual Date Of Delivery 02/11/2026, then `Update`. Good QTY becomes 12, and the header shows Remaining QTY 0 and Remaining Value ₹0.00. New actions appear: `Update Shipping Info`, `Update Delivery Condition`, `Generate GRN`.
6. **Update Shipping Info** → "Add Shipping Info": Shipping Mode (`Vc Booking System` / `Other`; Other used per the booking rule), Shipping Reference Number, Shipping From, Comments. Toast: "Shipping Details updated successfully!"
7. **Update Delivery Condition** → "Add Delivery Conditions": Good / Damage / Shortage. It **opens with Good 0 although the grid already shows Good QTY 12** (OBS-PL-21). Set Good 12, giving "Delivery Conditions updated successfully!", QTY Received 12 and Value Delivered ₹1,000.00. The header date then shows as `30-11-2026` (dashes) instead of `30/11/2026` (OBS-PL-22).
8. **Generate GRN** gives "GRN Generated Successfully!". `POST /api/shipping_details/generate_grn_pdf/` returns `GRN_<schedule_delivery_id>.pdf` (4,129 bytes) in `submittals/<schedule>/<delivery>/`. No browser download.
9. Result: the component status is **Delivered** and Received QTY is 12. In the submittal header, **Total Value of Ordered Items is now ₹1,000.00** and Pending ₹0.00, so that field behaves like a *delivered* value and the label is misleading (OBS-PL-14 refined). Grid: Status `Delivered`, but **Actual Delivery Date still `-`** (OBS-PL-3 confirmed with our own data).
10. The expanded component row shows Value as **`$1,000.00`** for an INR value; the header shows ₹ (OBS-PL-23).

**Deletes (own records only):**
- Component Other Actions → `Delete` asks "Delete Confirmation: Are you sure you want to proceed?" (Cancel / Delete). After deleting, the component list shows "No data found" with no toast. **The submittal header still shows the deleted component's Date Req. and Required QTY until the page is reloaded** (OBS-PL-24).
- Row ⋮ → `Delete` asks "1 submittal(s) will be deleted. Are you sure you want to proceed?" → "1 record(s) deleted." (PLD1102-SUB-04).
- **Bulk Delete** on 2 rows ticked one by one (PLD1102-SUB-05/06, imported for this test) asks "2 submittal(s) will be deleted…" → "2 record(s) deleted."
- Left in place: PLD1102-SUB-01 (Delivered, with GRN, flagged international) and pld1102-sub-01 (OBS-PL-13 evidence).

### 6.8 Part 4 – remaining flows on PLD1102-SUB-07 (2026-11-02) [O]

Record: **PLD1102-SUB-07** (LG / 43 Inches, component QTY 10, value ₹500, PO `PLD1102-PO-07`). It ends as **Partial Delivery**.

- **Component without PO:** status `Not Ordered`, lead time 1 week, `Not Confirmed`, Expected Delivery `-`. Value of items Pending already includes the not-ordered value (₹500).
- **Select not-confirmed** ticks every not-confirmed component and shows `N component selected` with **Set Lead Time**, **Shift ROJ Dates** and **Clear**.
  - **Shift ROJ Dates** → "Shift required-on-site dates for N component": "Offsets the ROJ date on every selected row. Preview the proposed moves before applying." Fields: Offset (days, negative pulls in), Basis (`Working days` / `Calendar days`), checkbox "Also move committed lines (PO placed / delivered / in transit)", buttons Cancel / Preview / Apply (disabled until Preview). Preview: "1 will move · 0 skipped … 2026-11-30 → 2026-12-07 (+7d)", then `Apply (1)` gives "Required-on-site date updated on 1 component." and the selection clears. The submittal header kept the old date until reload (same as OBS-PL-24).
  - **Set Lead Time** → "Set lead time for N component: Applies the same value to every selected row." Fields: Lead time (weeks) and "Mark lead time as confirmed"; Apply is disabled until a value is entered. Result: "Lead time updated on 1 component." For a not-ordered line, Expected Delivery then shows the ROJ date (07/12/2026).
- **Order (add PO):** Order → Edit Component with PO no. + PO Date → status `Ordered`, Expected Delivery = PO date + lead time (02/11 + 2 weeks = 16/11). The toast again said "Schedule added successfully!" (OBS-PL-15).
- **Upload PO File** (expanded component row): dialog "Upload PO File" with "Click here to select the file" and `Upload`. **Upload with no file gives "Missing file." and the dialog closes.** Uploading a PDF gives "File uploaded successfully!" and the file name is shown under `po File`. The app also showed **"Could not extract any line items from the PO PDF."**, so PO PDFs are parsed for line items (Q-PL-13).
- **Partial delivery (4 of 10):** Log Delivery QTY 4 was accepted. **Over-delivery is blocked:** QTY 20 gives "Quantity exceeds available quantity (10 Pieces)". "Required Remaining Qty" still showed **10** after a 4-piece delivery had been logged but not yet received (Q-PL-14).
- **Pre-shipping rules:** any `NO` answer **disables Confirm Checklist with no explanation** (OBS-PL-25). `NA` and `YES` allow it.
- **Reject path:** Approve dialog → `Reject` (**no note required**) closes with no toast. The delivery shows a `Rejected` icon and Pre Shipping Info disappears. Clicking `Rejected` opens **"Update Pre-Shipping Details"** with the earlier answers, so it can be resubmitted. Resubmit gives "Shipping Details updated successfully!", then Approve again.
- **After approval, Edit Delivery kept the Actual Date read-only (no calendar) until the page was reloaded** (OBS-PL-26). After reload: Actual Date 02/11, then Update.
- **Delivery Conditions on a partial:** Good and Damage are editable; **Shortage is read-only and calculated against the component quantity, not the delivery quantity.** Good 3 + Damage 1 on a 4-piece delivery gave Shortage **6** (10 − 3 − 1) where 0 was expected (OBS-PL-27). Saved, the delivery row reads Good 3 / Damage 1 / Shortage 6 / Base UOM 4 Pieces.
- Component header after conditions: **Required QTY "10 undefined"**, **QTY Received "4 undefined"** after reload (missing unit of measure, OBS-PL-31), QTY Rejected 1, Remaining 6, Value Delivered **₹200** (4 × ₹50, so the damaged unit counts as delivered value, Q-PL-16) and Remaining ₹300. **After reload the symbols switched to `$200.00` / `$300.00`** (OBS-PL-23 confirmed).
- **Generate GRN** here is an image with only a `title` and no alt text (on SUB-01 it had alt text). The last icon's alt says "Edit" while its title says "View Delivery Details". GRN generated, and the component status became **Partial Delivery**. Submittal header: Received 4, Ordered value ₹200, Pending ₹300.
- **Row Alert** (row ⋮ → Alert): side panel with Submittal No., Material, Spec Description, `Add Alert`, and a table Field Type | Condition | Value | Message | Users | Status ("No alerts configured yet for this Submittal"). With no rules, the `get-alert-schedule` request returns **404** instead of an empty list.
  - "Create Alert": Field Type* (only the numeric custom fields, `Total Count …`), Condition* (`=`, `>=`, `<=`) + value, Alert (message), User (multi-select of **names only**, three identical "Hariharan Raja" entries, OBS-PL-29), `Submit`. **An empty Submit goes to the server and returns "Failed to create alert. Please try again."** (no client validation, OBS-PL-28).
  - Created rule: "Alert created successfully!". The row shows the raw key `total_count_1386`, `>=`, 5, the message, Users `admin` (none picked) and Status `Created`, with actions Edit / Delete Alert.
- **QR Label** (component view): dialog "SUBMITTAL QR / Submittal" showing a QR for `https://stg-supplychain-app.voyagecontrol.com/s/<submittal id>`. It encodes the **submittal**, even though it was opened from a component. **PNG sticker** downloads `submittal-<id8>-qr.png`. A copies box (default 30) + **PDF sheet** downloads `submittal-<id8>-qr.pdf`, with the note "PDF lays out the label N times on US Letter (Avery 5160)."
- **Files tab** (component view): clicking `Files` doesn't switch; the delivery table stays and no files list appears (OBS-PL-30).
- **New material** (drawer `+`): inline form Category* (+ new category), Material Name*, UOM*, Parent Material, Lead Time (Weeks)*, `Add`. Created "PLD1102 Material 01" in category `Cat U PMR2-2611011614`, UOM Pieces, lead time 2. Toasts: "Material added successfully." and "Material added to submittal.". **The name is stored in title case: "Pld1102 Material 01"** (OBS-PL-32).
- **Remove material chip (×)** removes it at once with **no confirmation**: "Material removed from submittal".
- Console on the component view: `list_location_by_site_id?site_id=` (empty) returns **400** on every load (OBS-PL-33).


### 6.10 Product-owner answers (2026-11-02, round 2) – rules PL-R7…PL-R16
| # | Question | Rule |
|---|---|---|
| PL-R7 | Q-PL-1 | The `bulk_edit_log` 403 is an access issue and will be fixed (treat it as a defect) |
| PL-R8 | Q-PL-3 | "Only my watched" shows records of the materials or users assigned to the logged-in user in PM > Watched Materials (per project) |
| PL-R9 | Q-PL-4 | Export must match the grid columns, including custom fields (OBS-PL-9 is a defect) |
| PL-R10 | Q-PL-5 | There is no FDI audit trail (the component audit trail is not a substitute) |
| PL-R11 | Q-PL-6 | Default date range: From = today − 1 month, To = today |
| PL-R12 | Q-PL-8 | Submittal No can be updated via Edit |
| PL-R13 | Q-PL-9 | A Delivered status must show on both the submittal page and the component page (OBS-PL-16 is a defect) |
| PL-R14 | Q-PL-10 | Trigger Alert goes to the subcontractor, the supplier and the user |
| PL-R15 | Q-PL-14 | Required Remaining Qty must subtract quantities already logged |
| PL-R16 | Q-PL-15 / Q-PL-16 | Every pre-shipping answer must be "YES" to confirm; damaged quantity counts toward Value Delivered and QTY Received |

**Q-PL-13** parked: there's no clear visibility on the PO format yet, so PO Validation is tested as observed (upload accepted, message shown).

### 6.9 Still not explored
- Over / Returned QTY (no input seen; possibly from Inventory returns).
- Removing the primary material chip.
- Editing or deleting an alert rule; alert firing (needs the daily alert batch, PM rule: two-phase test).
- Component `Bulk upload Components` icon in the drawer (same template as Import Component, **[I]**).

## 7. Observations and defect candidates
Registered so far (2026-11-02, user approval): OBS-PL-13 = SCP-DEF-042, OBS-PL-3 = SCP-DEF-043. OBS-PL-1 is covered by SCP-DEF-041. Everything else is unregistered; registering it needs approval.

| # | Observation | Proposed |
|---|---|---|
| OBS-PL-1 | Three custom log fields have the same name `Spec Section No` (grid, Columns panel, Advanced Filter, template). That breaks the uniqueness rule (R2/R15) and causes React duplicate-key errors on every filter interaction | Already **SCP-DEF-041** (Procurement Log Configuration accepts duplicate field names) |
| OBS-PL-2 | `GET /api/submittal_master/bulk_edit_log/?pending=true` returns **403** on every Procurement Log load. **[I]** It's linked to `Procurement Log: Bulk Edit` being unticked for Project Admin ([PM §5.19](PM_FUNCTIONAL_DISCOVERY.md)); the UI should not call an endpoint the role can't use | Confirm the role (Q-PL-1) |
| OBS-PL-3 | All 25 `Delivered` submittals show Actual Delivery Date `-`; confirmed on PLD1102-SUB-01 after a full delivery → GRN (§6.7) | **Registered as SCP-DEF-043** (2026-11-02, user approval) |
| OBS-PL-4 | Detail drawer header shows Date Req., Required QTY, Received QTY and Total Value as `-` while the component has 31/10/2026 and 344 Pounds | DEF-C candidate (needs the expected rule) |
| OBS-PL-5 | Status filter has no `Pending` option. That's correct: `Pending` is a Skip-for-Now field value, not a status | Not a defect |
| OBS-PL-6 | The audit trail lists `record id` `-`→`-` entries (14 of 35) | Low-severity candidate |
| OBS-PL-7 | Form label "Spec selection no." but grid and template say "Spec Section No" | Low-severity candidate |
| OBS-PL-8 | After `Skip for Now` fills the field, the "is required" error stays on screen | Low-severity candidate (UX) |
| OBS-PL-9 | Export columns differ from the grid; custom fields are missing; `Supplier` is empty; literal `None`; raw status; unformatted dates | Q-PL-4 |
| OBS-PL-10 | Columns panel doesn't close on Escape and blocks clicks on the grid underneath | Low-severity candidate (UX) |
| OBS-PL-11 | The date range filters on Created At, but nothing on screen says so; users will expect Date Required On Site | Q-PL-6 |
| OBS-PL-12 | Schedule Id accepts digits only, but `Skip for Now` stores `pending` (non-numeric) in it | Low-severity candidate (inconsistent rule) |
| **OBS-PL-13** | **Duplicate check is skipped on Edit**: an edit can create a Submittal No + Material pair that Add rejects with 409 (evidence: pld1102-sub-01 / 43 Inches on NRVC_Hall) | **Registered as SCP-DEF-042** (2026-11-02, user approval) |
| OBS-PL-14 | Total Value of Ordered Items is ₹0.00 for an Ordered component worth 1000, while Pending shows ₹1,000.00 | DEF-C candidate (needs the formula) |
| OBS-PL-15 | The component update (Order → Update) toast says "Schedule added successfully!" | Low-severity candidate (wrong message) |
| **OBS-PL-16** | Update Status → Delivered returns 200 "updated successfully" but the status doesn't change, and the UI says nothing | **DEF-C candidate** (silent no-op), unless Delivered must come from GRN/pre-shipping (Q-PL-9), in which case the option should be blocked or explained |
| OBS-PL-17 | Update Status (comment saved) leaves no audit-trail entry | Candidate |
| OBS-PL-18 | Flag International stays in the menu after flagging and can be submitted again; there's no flagged marker or Unflag | Low-severity candidate (UX) |
| OBS-PL-19 | International Shipments shows Required Date `-` and `Pending Order` for a submittal whose component has Date Req. 30/11 and is Ordered | Candidate (cross-module sync) |
| OBS-PL-21 | Delivery Conditions dialog opens with Good 0 while the delivery already shows Good QTY 12 | Low-severity candidate |
| OBS-PL-22 | Header date format switches from `30/11/2026` to `30-11-2026` after the delivery condition update | Low-severity candidate |
| OBS-PL-23 | Expanded component row shows `$1,000.00` for an INR value (header shows ₹) | Candidate (currency symbol) |
| OBS-PL-24 | After deleting a component, the submittal header keeps its Date Req. and Required QTY until reload | Low-severity candidate (stale UI) |
| OBS-PL-25 | A `NO` answer disables Confirm Checklist with no message | Candidate (UX; confirm rule Q-PL-15) |
| OBS-PL-26 | After checklist approval, Edit Delivery keeps Actual Date read-only until reload | Candidate (stale UI) |
| OBS-PL-27 | Shortage is calculated against the component QTY, not the delivery QTY (4-piece delivery, Good 3 + Damage 1 gives Shortage 6) | DEF-C candidate |
| OBS-PL-28 | Create Alert with empty fields is sent to the server: "Failed to create alert. Please try again." | Low-severity candidate (validation) |
| OBS-PL-29 | Alert user picker shows names only; duplicate names can't be told apart | Low-severity candidate |
| OBS-PL-30 | Component view `Files` tab doesn't switch | Candidate |
| OBS-PL-31 | Component header shows `10 undefined` / `4 undefined` (missing UoM), same pattern as SCP-DEF-007 | Candidate (likely the same root cause as SCP-DEF-007) |
| OBS-PL-32 | New material name is stored in title case ("PLD1102 Material 01" → "Pld1102 Material 01") | Q: intended? |
| OBS-PL-33 | `list_location_by_site_id` called with empty `site_id` returns 400 on every component-view load; `get-alert-schedule` returns 404 when there are no rules | Low (console noise) |
| OBS-PL-20 | Submittal import fails when Source is empty, but the template doesn't mark it as required, the failure reason is just "Validation error", the toast doesn't link to the report, and Bulk Upload Status shows `-` instead of `Failed` (= SCP-DEF-001) | Candidate + existing SCP-DEF-001 |

## 8. Outstanding questions
- **Q-PL-1** ~~Which role?~~ **Project Admin** (answered 2026-11-02). Still open: is it expected that the page calls `bulk_edit_log` (403) for a role without `Procurement Log: Bulk Edit`?
- **Q-PL-2** Should a `Delivered` submittal always have an Actual Delivery Date? Or is the date per component (FDI or delivery) and only shown at submittal level for imports?
- **Q-PL-3** Does "Only my watched" filter correctly? 26 categories plus the Electrical trade are watched and the count didn't change (57 → 57). Which record should drop out?
- **Q-PL-4** Should Export match the visible grid columns (including custom fields), or is the full Procore-shaped dump intended?
- **Q-PL-5** Does the component Audit Trail meet the FDI audit-trail need from the PM review (R67, FDI-29)? Or does the FDI page need its own?
- **Q-PL-6** Is filtering the date range on Created At intended?
- **Q-PL-7** ~~May I run write flows?~~ **Yes, new records may be created** (answered 2026-11-02). Still open: may Delete / Bulk Delete be tested on records the session created itself?
- **Q-PL-8** ~~Same Submittal No + different material?~~ **Expected** (PL-R3). Still open: should the stored Submittal No keep the case it was typed in (`pld1102-sub-01` beside `PLD1102-SUB-01`)?
- **Q-PL-9** ~~Delivered via Update Status?~~ **Only through delivery → GRN** (PL-R4). Still open: should Update Status hide `Delivered` or show a message instead of silently ignoring it?
- **Q-PL-10** ~~May alerts be sent?~~ **Yes** (PL-R1). Still open: who receives them? The stored record says `to_whom: subcontractor` with no subcontractor IDs.
- **Q-PL-11** ~~Other materials in a delivery's Item Name?~~ **Yes, expected** (answered 2026-11-02, PL-R5).
- **Q-PL-13** PO PDF upload reports "Could not extract any line items from the PO PDF." What format is expected, and does it matter that Project Admin lacks `PO: Apply` / `PO: Validate`?
- **Q-PL-14** Should "Required Remaining Qty" subtract quantities already logged (not yet received)? Today it stays at the full QTY.
- **Q-PL-15** Is "any NO blocks Confirm Checklist" the intended rule? If so, should the UI say why?
- **Q-PL-16** Should a damaged quantity count toward Value Delivered / QTY Received?
- **Q-PL-12** ~~Should the grid show Actual Delivery Date once Delivered?~~ **Yes** (answered 2026-11-02, PL-R6). Registered as SCP-DEF-043.
