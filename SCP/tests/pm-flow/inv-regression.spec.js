// =====================================================================================================================
// Inventory Management – regression (INV-REG-01 … INV-REG-25)
//
// What this suite proves: stock in SCP moves correctly. Every activity a site team records (issue to construction,
// loss, return, incoming load, movement between locations, bulk upload) must change the stock ledger by exactly the
// recorded quantity, invalid entries must be rejected without changing stock, and Inventory must stay consistent
// with the Procurement Log.
//
// Human-readable test cases: docs/functional-discovery/steps/INV_REGRESSION_STEPS.md (same IDs and steps).
// Test data: test-data/inventory-regression.json. Material, supplier and site: tests/pm-flow/support/pl-flow.js.
//
// Preconditions
//  - Project Admin on the project in .env (NRVC_Hall); test site "Warehoust _NR" unless SCP_PL_SITE says otherwise.
//  - The test material ("43 Inches") has stock at the first location of the site. The Procurement regression creates
//    it through delivery → GRN, so run it before this suite.
//  - Writes approved on NRVC_Hall: manual activities, uploads, and one extra location for Internal Movement (INV-R4).
//
// Safety rules
//  - The Add Activity date field is never clicked: it freezes the browser tab (known defect SCP-DEF-002).
//  - Steps that save something run once (`attempts: 1`). A retry could record the same activity twice.
//
// How to run: npm run inventory:regression   → report in reports/pm-flow/inv-regression-<time>/report.html
// =====================================================================================================================
const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { runPmSuite } = require('./support/pm-flow');
const { plKit, SITE } = require('./support/pl-flow');
const { writeXlsx, readXlsxRows } = require('./support/pl-files');
const { SiteSelectorPage } = require('../../pages/site-selector.page');
const { InventoryManagementPage } = require('../../pages/inventory-management/inventory-management.page');
const { InventoryBulkUploadPage } = require('../../pages/inventory-management/inventory-bulk-upload.page');
const { SiteDetailsPage } = require('../../pages/project-management/site-details.page');
const testData = require('../../test-data/inventory-regression.json');

const SUITE = 'Inventory Management Regression';
const MODULE = 'Inventory Management';

// Every record this run creates carries the run tag (for example "INR2611211030"), so it can be found again.
const RUN_TAG = `INR${new Date().toISOString().replace(/\D/g, '').slice(2, 12)}`;
const SECOND_LOCATION_NAME = `Loc ${RUN_TAG}`;
const SECOND_SITE = process.env.SCP_INV_SITE2;
const TEMP_FOLDER = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-reg-'));

// Patterns from the test data file.
const RUN_SUBMITTAL = new RegExp(testData.submittals.runSubmittalPattern);
const PREFERRED_SUBMITTAL = new RegExp(testData.submittals.preferredSubmittalPattern);
const PLACEHOLDER_OR_RUN_LOCATION = new RegExp(testData.locations.placeholderOrRunLocationPattern, 'i');
const MESSAGES = Object.fromEntries(Object.entries(testData.expectedMessages)
  .filter(([key]) => key !== '_comment')
  .map(([key, pattern]) => [key, new RegExp(pattern)]));
const CHANGES = testData.stockChanges;
const INVALID = testData.invalidQuantities;

// Report entry for one scenario: ID, module, kind (Positive / Negative / Integration …) and title.
const scenarioInfo = (id, title, kind, extra = {}) => ({
  id, module: MODULE, submodule: kind, suite: SUITE, title: `[${kind}] ${title}`, navPath: [MODULE], ...extra
});

// A "real" location is one that can hold stock: not a placeholder entry and not a location created by an earlier run.
const isRealLocation = option => !PLACEHOLDER_OR_RUN_LOCATION.test(option);
const isNotPlaceholder = option => !/^(Choose|Select)/.test(option);

test.describe.configure({ mode: 'serial' });
test.setTimeout(90 * 60 * 1000);

test('Inventory Management – regression', async ({ page, browserName }) => {
  await runPmSuite({ page, browserName, suite: SUITE, scenarios: async ({ run, config }) => {
    // ---------- Page objects and shared helpers ----------
    const procurement = plKit(page); // sign-in and Procurement Log navigation shared with the Procurement suites
    const MATERIAL = procurement.MATERIAL;
    const inventory = new InventoryManagementPage(page);
    const upload = new InventoryBulkUploadPage(page);
    const siteSelector = new SiteSelectorPage(page);
    const siteDetails = new SiteDetailsPage(page);

    // Values one scenario reads and a later scenario checks (each use is named in the scenario that needs it).
    const shared = { offered: {} };

    /** Opens the Inventory Management list on the test site. */
    const openInventoryList = () => inventory.openListOnSite(siteSelector, SITE);

    /** Opens the stock ledger ("Actions" view) of the test material. */
    const openLedger = async () => {
      await openInventoryList();
      await inventory.openMaterialView(MATERIAL, 'Actions');
    };

    /** Opens the "Location" view of the test material (stock per location). */
    const openLocationView = async () => {
      await openInventoryList();
      await inventory.openMaterialView(MATERIAL, 'Location');
    };

    /** Reads the material's stock at one location from the Location view. */
    const stockAtLocation = async location => {
      await openLocationView();
      return inventory.readStockAtLocation(location);
    };

    /** The first location that can hold stock, from the locations the last form offered. */
    // Pinned at setup (step 8) to the real location with the most stock, so the run never depends on one location
    // being refilled. Falls back to the first real location the form offered.
    const sourceLocation = () => shared.sourceLocationName || (shared.offered.locations || []).find(isRealLocation);
    const sameName = name => option => option.trim().toLowerCase() === String(name).trim().toLowerCase();

    /**
     * Submittals to try, in order: the preferred long-lived ones first, then the newest run submittals.
     * `accept` narrows the candidates; a text accepts exactly that submittal.
     */
    const submittalCandidatesFor = accept => offered => {
      if (typeof accept === 'string') return [accept];
      const usable = offered.filter(accept);
      const preferred = usable.filter(option => PREFERRED_SUBMITTAL.test(option));
      const others = usable.filter(option => !PREFERRED_SUBMITTAL.test(option)).reverse();
      return [...preferred, ...others].slice(0, testData.submittals.maximumCandidates);
    };

    /**
     * Records an inventory activity on the open ledger: opens Add Activity, fills it for the test material and,
     * unless `save` is false, clicks "ADD". What the form offered is kept in `shared.offered`.
     */
    const recordActivity = async ({ action, quantity, fromLocation, toLocation, submittal = option => RUN_SUBMITTAL.test(option),
      schedule, waitForSchedule = true, save = true }) => {
      await inventory.openActivityForm();
      shared.offered = await inventory.fillActivityForm({
        item: MATERIAL,
        action,
        fromLocation: fromLocation || (shared.sourceLocationName ? sameName(shared.sourceLocationName) : isRealLocation),
        toLocation,
        quantity,
        comments: `${RUN_TAG} ${action}`,
        supplier: isNotPlaceholder,
        subcontractor: isNotPlaceholder,
        submittalCandidates: submittalCandidatesFor(submittal),
        schedule,
        waitForScheduleMs: waitForSchedule ? 2000 : 0
      });
      if (save) await inventory.clickAddAndWaitForOutcome();
    };

    /** Opens a submittal in the Procurement Log and then the test material's component. */
    const openComponentInProcurementLog = async submittalNumber => {
      await procurement.openLog();
      await procurement.search(submittalNumber);
      await procurement.rows().first().getByRole('cell').nth(1).click();
      await page.getByText('Other Actions').first().waitFor({ timeout: 30000 });
      await procurement.componentRow(MATERIAL).getByRole('cell', { name: MATERIAL }).click();
      await procurement.settle(1500);
    };

    // =================================================================================================================
    // INV-REG-SETUP – Sign in and check that there is stock to work with
    // =================================================================================================================
    const setup = await run.scenario(scenarioInfo('INV-REG-SETUP', `Sign in on ${config.projectName}`, 'Setup', { always: true }), async s => {
      // STEPS 1–5: Sign in as Project Admin, open Supply Chain Planner, choose the project and the test site.
      await procurement.signIn(s, config);

      // STEP 6: Open Inventory Management from the left menu.
      // Purpose: every scenario starts from this list. Expected: the list shows at least one material.
      await s.step(`Sidebar › "Inventory Management" → list shows items`, async () => {
        await procurement.menu(MODULE).catch(() => null);
        await openInventoryList();
      }, { critical: true });

      // STEP 7: Search the test material and read its stock.
      // Purpose: the scenarios below remove up to about 7 units, so the run stops here when there is not enough stock.
      // Expected: the "Inventory" column of the material is above 3 (stock delivered by the Procurement regression).
      await s.step(`Inventory Management › search "${MATERIAL}" → grid Inventory (4th column) is above 3, stock delivered by the Procurement regression`, async () => {
        shared.startingStock = await inventory.readListInventory(MATERIAL);
        s.observe(`Run ${RUN_TAG}; ${MATERIAL} inventory ${shared.startingStock}`);
        expect(shared.startingStock).toBeGreaterThanOrEqual(testData.minimumStartingStock);
      }, { critical: true });

      // STEP 8: Choose the location every activity of this run takes stock from.
      // Purpose: one run uses about 8-9 units at its source location. Until 21 Nov the source was always the first
      // real location (Gate 5), which ran down while other locations held hundreds of units. Now the real location
      // with the most stock is chosen, and its stock is confirmed with the form's own "Available at" hint (the
      // figure the save check uses; the Location view can differ, SCP-DEF-053).
      // Expected: a real location whose hint shows at least minimumSourceLocationStock units; it is used for the run.
      await s.step(`Row "⋮" › "Location": rank real locations by QTY; for the best ones, Ledger › "Add Activity" (Loss, QTY 1, from that location, no save) → "Available at <location>: N" is at least ${testData.minimumSourceLocationStock}; that location is used for the run`, async () => {
        await openInventoryList();
        await inventory.openMaterialView(MATERIAL, 'Location');
        const candidates = (await inventory.readLocationStocks())
          .filter(location => isRealLocation(location.name))
          .sort((first, second) => second.quantity - first.quantity)
          .slice(0, testData.maximumSourceLocationCandidates);
        const checked = [];
        for (const candidate of candidates) {
          await openLedger();
          await recordActivity({ action: CHANGES.loss.action, quantity: 1, save: false, fromLocation: sameName(candidate.name) });
          const formOption = (shared.offered.locations || []).find(sameName(candidate.name));
          const hint = formOption ? await inventory.readAvailableStockHint() : { text: 'not offered by the form', quantity: 0 };
          await inventory.closeActivityFormIfOpen();
          checked.push(`${candidate.name}: Location view ${candidate.quantity}, form "${hint.text}"`);
          if (formOption && hint.text.toLowerCase().includes(candidate.name.toLowerCase()) && hint.quantity >= testData.minimumSourceLocationStock) {
            shared.sourceLocationName = formOption;
            break;
          }
        }
        s.observe(`${checked.join(' · ')} → source: ${shared.sourceLocationName || 'none'}`);
        expect(shared.sourceLocationName, `No real location has ${testData.minimumSourceLocationStock}+ units of ${MATERIAL} (${checked.join('; ')}); deliver stock with the Procurement regression (npm run procurement:regression)`)
          .toBeTruthy();
      }, { critical: true });
    });
    if (setup.status !== 'Passed') {
      run.abort('Setup failed (needs stock from the Procurement regression)');
      return;
    }

    // =================================================================================================================
    // INV-REG-01 – A GRN in the Procurement Log creates an "Incoming Load" in the stock ledger
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-01', 'GRN creates Incoming Load', 'Integration'), async s => {
      // STEP 1: Open the ledger of the test material.
      // Purpose: goods received through the Procurement Log must reach Inventory without manual entry.
      // Expected: at least one "Incoming Load" row (written by the GRNs of the Procurement runs).
      await s.step(`Search "${MATERIAL}", row "⋮" › "Actions" → ledger has at least one "Incoming Load" row (GRNs of the Procurement runs)`, async () => {
        await openLedger();
        const incomingLoadRows = inventory.ledgerRows().filter({ hasText: 'Incoming Load' });
        // The ledger rows load after the table is shown, so wait for them instead of counting at once.
        await expect.poll(() => incomingLoadRows.count(), { timeout: 20000, message: 'No "Incoming Load" row in the ledger' }).toBeGreaterThan(0);
        s.observe(`${await incomingLoadRows.count()} Incoming Load rows`);
      });

      // STEP 2: Read the ledger's Closing Balance.
      // Purpose: the list and the ledger must show the same stock. Expected: Closing Balance = stock read at setup.
      await s.step(`Ledger → "Closing Balance" equals the grid Inventory quantity read at setup`, async () => {
        expect(await inventory.readClosingBalance()).toBe(shared.startingStock);
      });
    });
    run.skip(scenarioInfo('INV-REG-21', 'Damaged units counted as received (PL-R16)', 'Integration'),
      'Checked in the Procurement regression (PL-REG-DLV-13: Incoming Load = delivered QTY incl. damaged)');

    // =================================================================================================================
    // INV-REG-13 – The form only offers suppliers, submittals and schedules of the chosen material
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-13', 'Pickers filtered by material', 'Positive'), async s => {
      // STEP 1: Fill an "Issue To Construction" activity without saving it.
      // Purpose: users must only be able to link an activity to records of this material.
      // Expected: the run supplier, run submittals (PL…-SUB-…) and at least one schedule are offered.
      await s.step(`Ledger › "Add Activity": action "Issue To Construction", QTY 1, no save → Supplier list has the run supplier, Submittal list has run submittals (PL…-SUB-…), Schedule list is not empty`, async () => {
        await openLedger();
        await recordActivity({ action: CHANGES.issueToConstruction.action, quantity: 1, save: false });
        const { suppliers, subcontractors, submittals, schedules } = shared.offered;
        s.observe(`Suppliers: ${suppliers.join(', ')} · Subcontractors: ${subcontractors.length} · Submittals: ${submittals.length} · Schedules: ${schedules.join(', ')}`);
        expect(submittals.some(option => RUN_SUBMITTAL.test(option))).toBe(true);
        expect(suppliers).toContain(procurement.SUPPLIER);
        expect(schedules.length).toBeGreaterThan(0);
      });

      // STEP 2: Read the "Available at <location>: <qty>" hint.
      // Purpose: the hint tells the user how much can be issued; INV-REG-12 compares it with the location stock.
      // Expected: the hint is shown with a quantity.
      await s.step(`Add Activity form → hint "Available at <location>: <qty>" is shown and its value is recorded`, async () => {
        const hint = await inventory.readAvailableStockHint();
        s.observe(hint.text);
        shared.availableHint = hint.quantity;
      });

      // STEP 3: Close the form without saving. Expected: the form closes and nothing is recorded.
      await s.step(`Press Escape → Add Activity form closes without saving`, () => inventory.closeActivityFormIfOpen());
    });

    // =================================================================================================================
    // INV-REG-12 – The "Available at" hint equals the stock at that location
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-12', 'Available stock hint = location balance', 'Positive'), async s => {
      // STEP 1: Open the material's Location view and read the stock of the form's From Location.
      // Purpose: the hint and the location stock must agree, or users issue stock that is not there.
      // Expected: the location quantity equals the hint recorded in INV-REG-13.
      await s.step(`Row "⋮" › "Location" → QTY of the From Location row equals the "Available at" hint`, async () => {
        const location = sourceLocation() || '';
        const locationStock = await stockAtLocation(location);
        s.observe(`Form hint ${shared.availableHint}, Location view ${locationStock} at ${location}`);
        // Pending team confirmation (SCP-DEF-053): which of the two figures is the correct stock.
        expect(shared.availableHint, `Form "Available at" hint differs from the Location view at ${location} (OBS-INV-14)`).toBe(locationStock);
      });
    });

    // =================================================================================================================
    // INV-REG-02 – "Issue To Construction" reduces the stock by the issued quantity
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-02', 'Issue To Construction', 'Positive'), async s => {
      const { action, quantity, expectedChange } = CHANGES.issueToConstruction;
      let balanceBefore;

      // STEP 1: Record the activity and save it.
      // Purpose: issuing material to the construction site is the most common stock movement.
      // Expected: the form closes, which means the activity was saved.
      await s.step(`Ledger › "Add Activity": action "${action}", From Location (first real one), QTY ${quantity}, first Supplier/Subcontractor, run Submittal + Schedule, "ADD" → form closes (saved)`, async () => {
        await openLedger();
        balanceBefore = await inventory.readClosingBalance();
        await recordActivity({ action, quantity });
        expect(await inventory.isActivityFormOpen(), `Form still open: ${await inventory.readActivityMessages()}`).toBe(false);
      }, { critical: true, attempts: 1 });

      // STEP 2: Reopen the ledger.
      // Expected: the Closing Balance changed by exactly the issued quantity and an "Issue To Construction" row is listed.
      await s.step(`Ledger → "Closing Balance" changes by ${expectedChange} and a "${action}" row is listed`, async () => {
        await openLedger();
        expect(await inventory.readClosingBalance()).toBe(balanceBefore + expectedChange);
        await expect(inventory.ledgerRows().filter({ hasText: action }).first()).toBeVisible();
      });

      // STEP 3: The list page refresh after an activity is a separate rule, checked in INV-REG-15.
      await s.step(`Landing grid refresh after the activity → verified separately in INV-REG-15`, async () => s.observe('checked in INV-REG-15'));
    });

    // =================================================================================================================
    // INV-REG-15 – The list page shows the new stock right after an activity (no page reload)
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-15', 'Grid refreshes after an activity', 'Positive'), async s => {
      // STEP 1: Record a "Loss" of 1, close the ledger and go back to the list through the menu (not a reload).
      // Purpose: users read stock on the list page; a stale figure leads to wrong decisions.
      // Expected: the list shows 1 unit less than the ledger before the loss (today it is stale, OBS-INV-4).
      await s.step(`Ledger › "Add Activity": action "Loss", QTY 1, "ADD"; Escape, sidebar › "Inventory Management" (no reload) → grid Inventory of ${MATERIAL} is 1 lower (OBS-INV-4 if stale)`, async () => {
        await openLedger();
        const balanceBefore = await inventory.readClosingBalance();
        await recordActivity({ action: CHANGES.loss.action, quantity: CHANGES.loss.quantity });
        await page.keyboard.press('Escape');
        await procurement.menu(MODULE).catch(() => null);
        await procurement.settle(1000);
        const listStock = await inventory.readListInventory(MATERIAL);
        s.observe(`Grid ${listStock}, expected ${balanceBefore - 1}`);
        expect(listStock, 'Grid inventory is stale after a manual activity (OBS-INV-4)').toBe(balanceBefore - 1);
      }, { attempts: 1 });
    });
    run.skip(scenarioInfo('INV-REG-03', 'Loss', 'Positive'), 'Loss 1 is executed and its balance checked in INV-REG-15');

    // =================================================================================================================
    // INV-REG-04 – A "Return" reduces stock and is written back to the Procurement Log
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-04', 'Return reduces stock and writes back to Procurement', 'Integration'), async s => {
      let balanceBefore;

      // STEP 1: Record a "Return" of 1 against a run submittal and its schedule.
      // Purpose: returned goods leave the site stock and must show on the purchase they came from.
      // Expected: the activity is saved.
      await s.step(`Ledger › "Add Activity": action "Return", QTY 1, run Submittal + Schedule, "ADD" → activity submitted`, async () => {
        await openLedger();
        balanceBefore = await inventory.readClosingBalance();
        await recordActivity({ action: CHANGES.return.action, quantity: CHANGES.return.quantity });
        shared.returnSubmittal = shared.offered.chosenSubmittal;
      }, { critical: true, attempts: 1 });

      // STEP 2: Reopen the ledger. Expected: the Closing Balance is 1 lower than before the return.
      await s.step(`Ledger → "Closing Balance" is 1 lower than before the Return`, async () => {
        await openLedger();
        expect(await inventory.readClosingBalance()).toBe(balanceBefore + CHANGES.return.expectedChange);
      });

      // STEP 3: Open the same submittal's component in the Procurement Log.
      // Expected: a "Return" row is listed on the component.
      await s.step(`Procurement Log › search ${shared.returnSubmittal}, open the submittal, click component "${MATERIAL}" → a "Return" row is listed`, async () => {
        await openComponentInProcurementLog(shared.returnSubmittal);
        await expect(page.getByRole('row').filter({ hasText: 'Return' }).first()).toBeVisible({ timeout: 15000 });
      });
    });

    // =================================================================================================================
    // INV-REG-05 – A manual "Incoming Load" is accepted on a partly delivered schedule and shows in the Procurement Log
    // =================================================================================================================
    // INV-REG-05 looks for one submittal that accepts the incoming load and one that rejects it; INV-REG-06 uses both.
    let acceptedIncoming = null;
    let rejectedIncoming = null;
    await run.scenario(scenarioInfo('INV-REG-05', 'Manual Incoming on a partial schedule', 'Integration'), async s => {
      // STEP 1: Try an "Incoming Load" of 1 on up to 8 run submittals, one at a time.
      // Purpose: goods can also be received directly in Inventory, but only up to what was scheduled.
      // Expected: at least one partly delivered schedule accepts it (the form closes); a fully delivered one, if
      // tried, rejects it with "scheduled_quantity" / "Cannot add this activity".
      await s.step(`Ledger › "Add Activity": "Incoming Load", QTY 1 on up to 8 run submittals until one is accepted (form closes) and one rejected ("scheduled_quantity" / "Cannot add this activity")`, async () => {
        // Read the submittals offered for the material once, without saving.
        await openLedger();
        await recordActivity({ action: CHANGES.incomingLoad.action, quantity: CHANGES.incomingLoad.quantity, save: false });
        const offeredSubmittals = shared.offered.submittals;
        const candidates = [
          ...offeredSubmittals.filter(option => PREFERRED_SUBMITTAL.test(option)),
          ...offeredSubmittals.filter(option => RUN_SUBMITTAL.test(option) && !PREFERRED_SUBMITTAL.test(option)).reverse()
        ].slice(0, testData.submittals.maximumIncomingLoadCandidates);
        await inventory.closeActivityFormIfOpen();

        for (const submittal of candidates) {
          if (acceptedIncoming && rejectedIncoming) break;
          await openLedger();
          await recordActivity({ action: CHANGES.incomingLoad.action, quantity: CHANGES.incomingLoad.quantity, submittal });
          const message = await inventory.readActivityMessages();
          if (!shared.offered.chosenSubmittal) {
            // This submittal has no schedule line: nothing was submitted.
            await inventory.closeActivityFormIfOpen();
            continue;
          }
          if (await inventory.isActivityFormOpen()) {
            if (MESSAGES.incomingRejectedOnFullSchedule.test(message)) rejectedIncoming = rejectedIncoming || { submittal, message };
            await inventory.closeActivityFormIfOpen();
          } else {
            acceptedIncoming = acceptedIncoming || { submittal };
          }
        }
        s.observe(`Accepted: ${acceptedIncoming?.submittal || '-'} · Rejected: ${rejectedIncoming?.submittal || '-'}`);
        expect(acceptedIncoming, 'No partial run schedule accepted a manual Incoming Load').toBeTruthy();
      }, { attempts: 1 });

      // STEP 2: Open the accepting submittal's component in the Procurement Log.
      // Expected: its deliveries include one marked "Via Inventory".
      if (acceptedIncoming) {
        await s.step(`Procurement Log › search the accepted submittal, open it, click component "${MATERIAL}" → delivery shows "Via Inventory"`, async () => {
          await openComponentInProcurementLog(acceptedIncoming.submittal);
          await expect(page.getByText(/Via Inventory/).first()).toBeVisible({ timeout: 15000 });
        });
      }
    });

    // =================================================================================================================
    // INV-REG-06 – Receiving more than the scheduled quantity is rejected
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-06', 'Incoming beyond the scheduled quantity rejected', 'Negative'), async s => {
      // STEP 1: If INV-REG-05 met no rejecting submittal, try to receive 99999 on the accepting one.
      // Purpose: stock must not be received beyond what was ordered and scheduled.
      // Expected: the form stays open with "Cannot add this activity" / "exceeds" and the Closing Balance is unchanged.
      await s.step(`Ledger › "Add Activity": "Incoming Load" QTY 99999 on the accepted submittal (only if none was rejected before), "ADD" → form stays open with "Cannot add this activity" / "exceeds"; balance unchanged`, async () => {
        if (!rejectedIncoming) {
          // Returns reopen fully delivered schedules, so the accepted schedule is over-received instead (same rule).
          expect(acceptedIncoming, 'No run schedule to test').toBeTruthy();
          await openLedger();
          const balanceBefore = await inventory.readClosingBalance();
          await recordActivity({ action: CHANGES.incomingLoad.action, quantity: INVALID.overReceipt, submittal: acceptedIncoming.submittal });
          rejectedIncoming = { submittal: acceptedIncoming.submittal, message: await inventory.readActivityMessages() };
          const formStayedOpen = await inventory.isActivityFormOpen();
          await inventory.closeActivityFormIfOpen();
          expect(formStayedOpen, 'Over-receipt of 99999 was saved').toBe(true);
          await openLedger();
          expect(await inventory.readClosingBalance()).toBe(balanceBefore);
        }
        s.observe(`${rejectedIncoming.submittal}: ${rejectedIncoming.message.slice(0, 160)}`);
        expect(rejectedIncoming.message).toMatch(MESSAGES.incomingRejected);
      });
    });

    // =================================================================================================================
    // INV-REG-07 / 08 / 09 – Invalid quantities are rejected and the stock does not change
    // =================================================================================================================
    /**
     * Shared check for an invalid "Loss": the form must stay open with the expected message, and the Closing
     * Balance must not change. `savedHint` explains a known wrong behaviour when the activity is saved anyway.
     */
    const invalidQuantityScenario = (id, title, quantity, expectedMessage, stepText, savedHint = '', messageNote = '') =>
      run.scenario(scenarioInfo(id, title, 'Negative'), async s => {
        // STEP 1: Record a "Loss" with the invalid quantity and click "ADD".
        // Purpose: wrong quantities must never change the stock.
        // Expected: the form stays open with the message below; the Closing Balance is unchanged.
        await s.step(stepText, async () => {
          await openLedger();
          const balanceBefore = await inventory.readClosingBalance();
          await recordActivity({ action: CHANGES.loss.action, quantity });
          const message = await inventory.readActivityMessages();
          s.observe(message.slice(0, 160));
          const formStayedOpen = await inventory.isActivityFormOpen();
          await inventory.closeActivityFormIfOpen();
          expect(formStayedOpen, `Activity was saved${savedHint}`).toBe(true);
          // The stock is checked before the wording, so a wording issue cannot hide a stock change.
          await openLedger();
          expect(await inventory.readClosingBalance(), 'Closing Balance changed after a rejected activity').toBe(balanceBefore);
          expect(message, `Unexpected rejection message${messageNote}`).toMatch(expectedMessage);
        });
      });
    await invalidQuantityScenario('INV-REG-07', 'Overdraw rejected', INVALID.overdraw, MESSAGES.overdraw,
      `Ledger › "Add Activity": action "Loss", QTY 99999, "ADD" → form stays open: "Not enough stock at <location>: only N available, 99999 requested"; balance unchanged`);
    await invalidQuantityScenario('INV-REG-08', 'QTY 0 rejected', INVALID.zero, MESSAGES.zeroQuantity,
      `Ledger › "Add Activity": action "Loss", QTY 0, "ADD" → form stays open: "Quantity cannot be empty or zero or less"; balance unchanged`);
    await invalidQuantityScenario('INV-REG-09', 'QTY with 3 decimals', INVALID.threeDecimals, MESSAGES.threeDecimals,
      `Ledger › "Add Activity": action "Loss", QTY 1.555, "ADD" → form stays open with a "2 decimal places" message; balance unchanged`,
      ' (OBS-INV-10: only the generic "Invalid data provided.")', ' (OBS-INV-10)');

    // =================================================================================================================
    // INV-REG-10 – Moving stock to the same location is rejected
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-10', 'Internal Movement to the same location', 'Negative'), async s => {
      // STEP 1: Fill an "Internal Movement" whose To Location is the From Location, click "ADD".
      // Purpose: a movement must go somewhere else. Expected: "From Location and To Location must be different."
      await s.step(`Ledger › "Add Activity": "Internal Movement", QTY 1, To Location = the From Location, "ADD" → "From Location and To Location must be different."`, async () => {
        await openLedger();
        await recordActivity({ action: CHANGES.internalMovement.action, quantity: CHANGES.internalMovement.quantity, save: false });
        await inventory.setActivityField('To Location', sourceLocation());
        await inventory.clickAddAndWaitForOutcome();
        await expect(page.getByText(testData.expectedMessages.sameLocation).first()).toBeVisible();
        await inventory.closeActivityFormIfOpen();
      });
    });

    // =================================================================================================================
    // INV-REG-11 – Moving stock between two locations keeps the total and moves the quantity
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-11', 'Internal Movement between two locations', 'Positive'), async s => {
      // STEP 1: Make sure the site has a second location; create "Loc <run tag>" in Site Details when it has only one.
      // Purpose: a movement needs a source and a destination. Expected: a second location exists.
      await s.step(`Inventory Management Location dropdown has 2+ locations, else Site Details › site row "ADD" › "Choose Location" "${testData.locations.newLocationType}", name "${SECOND_LOCATION_NAME}", "Add" → second location exists`, async () => {
        await openInventoryList();
        const locations = await inventory.readLocationFilterOptions();
        if (locations.length >= 2) {
          shared.destination = locations.find(location => isRealLocation(location) && !sameName(sourceLocation())(location))
            || locations.find(location => !sameName(sourceLocation())(location)) || locations[1];
          s.observe(`Using existing ${shared.destination}`);
          return;
        }
        const site = await siteSelector.activeSiteName();
        await siteDetails.addLocationToSite(site, { locationType: testData.locations.newLocationType, locationName: SECOND_LOCATION_NAME });
        shared.destination = SECOND_LOCATION_NAME;
        s.observe(`Created ${SECOND_LOCATION_NAME} on ${site}`);
      }, { critical: true, attempts: 1 });

      let sourceBefore;
      let destinationBefore;
      // STEP 2: Note the stock at both locations, then move 1 unit from the source to the destination.
      // The source is a location that can hold stock (not a location created by an earlier run, which is empty).
      // Expected: the form closes (saved).
      await s.step(`Row "⋮" › "Location": note QTY at source and destination; Ledger › "Add Activity": "Internal Movement", From = source, To = second location, QTY 1, "ADD" → form closes`, async () => {
        const sameAsDestination = option => option.toLowerCase() === shared.destination.toLowerCase();
        shared.source = sameAsDestination(sourceLocation())
          ? (shared.offered.locations || []).find(option => isRealLocation(option) && !sameAsDestination(option))
          : sourceLocation();
        sourceBefore = await stockAtLocation(shared.source || '');
        destinationBefore = await stockAtLocation(shared.destination);
        await openLedger();
        // Location names are shown title-cased in the form (OBS-PL-32), so the destination is matched ignoring case.
        await recordActivity({
          action: CHANGES.internalMovement.action,
          quantity: CHANGES.internalMovement.quantity,
          fromLocation: shared.source,
          toLocation: sameAsDestination
        });
        expect(await inventory.isActivityFormOpen(), `Not saved: ${await inventory.readActivityMessages()}`).toBe(false);
      }, { critical: true, attempts: 1 });

      // STEP 3: Read both locations again. Expected: source 1 lower, destination 1 higher.
      await s.step(`Row "⋮" › "Location" → source location QTY is 1 lower and destination QTY is 1 higher`, async () => {
        expect(await stockAtLocation(shared.source)).toBe(sourceBefore - 1);
        expect(await stockAtLocation(shared.destination)).toBe(destinationBefore + 1);
      });
    });

    // =================================================================================================================
    // INV-REG-14 – An activity must not be saved with a schedule of another submittal (known defect SCP-DEF-045)
    // =================================================================================================================
    await run.scenario(scenarioInfo('INV-REG-14', 'Schedule must match the submittal', 'Negative'), async s => {
      // STEP 1: Choose submittal A and its schedule, then switch to submittal B without choosing a new schedule,
      // and click "ADD".
      // Purpose: a stock movement must stay linked to the right purchase.
      // Expected: the save is rejected, or no row is saved that carries A's schedule under B.
      await s.step(`Ledger › "Add Activity": "Loss" QTY 1, pick Submittal A + its Schedule, change Submittal to B without re-picking Schedule, "ADD" → rejected, or no row saved with A's schedule under B`, async () => {
        // Find two run submittals (A has a schedule).
        await openLedger();
        await recordActivity({ action: CHANGES.loss.action, quantity: 1, save: false });
        const submittalA = shared.offered.chosenSubmittal;
        const submittalB = shared.offered.submittals.filter(option => RUN_SUBMITTAL.test(option)).find(option => option !== submittalA);
        await inventory.setActivityField('Submittal', submittalA);
        await page.waitForTimeout(2000); // the Schedule list reloads after the submittal changes (OBS-INV-3)
        await inventory.setActivityField('Schedule', () => true);
        const scheduleA = await inventory.readActivityField('Schedule');
        const poNumberA = scheduleA.slice(scheduleA.indexOf(`${MATERIAL}-`) + MATERIAL.length + 1);
        await inventory.setActivityField('Submittal', submittalB);

        // Note the ledger rows before saving, so the new row can be identified.
        await inventory.closeActivityFormIfOpen();
        await openLedger();
        const rowsBefore = new Set(await inventory.ledgerTable().locator('tbody tr').allInnerTexts());

        // Fill again with A and its schedule, switch to B, save.
        await recordActivity({ action: CHANGES.loss.action, quantity: 1, submittal: submittalA, save: false });
        await inventory.setActivityField('Submittal', submittalB);
        await inventory.clickAddAndWaitForOutcome();
        if (await inventory.isActivityFormOpen()) {
          s.observe(`Rejected: ${await inventory.readActivityMessages()}`);
          await inventory.closeActivityFormIfOpen();
          return;
        }
        await openLedger();
        const newRows = (await inventory.ledgerTable().locator('tbody tr').allInnerTexts())
          .filter(text => !rowsBefore.has(text))
          .map(text => text.replace(/\s+/g, ' '));
        s.observe(`A ${submittalA} (${poNumberA}) → B ${submittalB}; new row: ${newRows.join(' / ').slice(0, 200)}`);
        const savedWithWrongSchedule = newRows.some(text => text.includes(poNumberA) && text.includes(submittalB.replace('-SUB-', '-SPEC-')));
        if (savedWithWrongSchedule) {
          throw new Error(`Inventory activity saved with a schedule from another submittal (${submittalA} schedule ${poNumberA} on ${submittalB})`);
        }
      });
    });

    // =================================================================================================================
    // Bulk upload: INV-REG-19, 17, 16, 18
    // =================================================================================================================
    /** Builds one upload row for the test material (columns in template order). */
    const uploadRow = ({ action, quantity, comments = '' }) => [
      shared.uploadSubmittal, MATERIAL, MATERIAL, shared.uploadDate, shared.uploadPoNumber,
      action, sourceLocation(), '', String(quantity), '', '', comments
    ];
    /** Writes rows under the template header into a new .xlsx file and returns its path. */
    const writeUploadFile = (fileName, rows) => {
      const file = path.join(TEMP_FOLDER, fileName);
      writeXlsx(file, [shared.templateHeader, ...rows], testData.uploadTemplate.sheetName);
      return file;
    };
    /** Opens the upload dialog, uploads the file and returns the result line; on failure adds the error-file reasons. */
    const uploadFile = async file => {
      await openInventoryList();
      await upload.openUploadDialog();
      const result = await upload.uploadAndReadResult(file);
      if (!/failed/i.test(result)) return result;
      const errorFile = await upload.saveErrorFileTo(path.join(TEMP_FOLDER, `err-${Date.now()}.xlsx`)).catch(() => null);
      if (!errorFile) return result;
      const reasons = readXlsxRows(errorFile).slice(1).map(row => row.filter(Boolean).slice(-2).join(': ')).join(' / ');
      return `${result} | ${reasons.slice(0, 300)}`;
    };

    // ---------- INV-REG-19 – Upload with the optional columns left blank ----------
    const templateScenario = await run.scenario(scenarioInfo('INV-REG-19', 'Upload with optional columns blank', 'Positive'), async s => {
      // STEP 1: Download the upload template.
      // Purpose: users fill this file to record many activities at once. Expected: sheet "Inventory Template" with
      // the 12 agreed columns.
      await s.step(`Inventory Management › "Upload" › "Download template" → sheet "Inventory Template" header is ${testData.uploadTemplate.header.join(', ')}`, async () => {
        await openInventoryList();
        await upload.openUploadDialog();
        const templateFile = await upload.saveTemplateTo(path.join(TEMP_FOLDER, 'template.xlsx'));
        shared.templateHeader = readXlsxRows(templateFile, testData.uploadTemplate.sheetName)[0];
        s.observe(shared.templateHeader.join(' | '));
        expect(shared.templateHeader).toEqual(testData.uploadTemplate.header);
      }, { critical: true });

      // STEP 2: Close the dialog and read, from the Add Activity form, a submittal, its schedule date and PO number.
      // Purpose: the upload rows must refer to a real schedule. Expected: the three values are read; the form is closed.
      await s.step(`Upload dialog › "Cancel"; Ledger › "Add Activity" (Loss, QTY 1, no save) → read Submittal, Schedule date and PO number for the upload rows; close the form`, async () => {
        await upload.cancelUploadDialog();
        await openLedger();
        // The ambiguous submittal (it exists twice) is avoided: the upload rejects it (OBS-INV-13), the form does not.
        await recordActivity({
          action: CHANGES.loss.action,
          quantity: 1,
          save: false,
          submittal: option => RUN_SUBMITTAL.test(option) && option !== testData.submittals.ambiguousForUpload
        });
        shared.uploadSubmittal = await inventory.readActivityField('Submittal');
        const schedule = shared.offered.schedules.find(isNotPlaceholder) || '';
        const dateParts = schedule.match(/(\d{4})-(\d{2})-(\d{2})|(\d{2})\/(\d{2})\/(\d{4})/) || [];
        shared.uploadDate = dateParts[1] ? `${dateParts[3]}/${dateParts[2]}/${dateParts[1]}` : dateParts[0];
        // Schedule text format: <date>-<item>-<PO number>
        shared.uploadPoNumber = schedule.slice(schedule.indexOf(`${MATERIAL}-`) + MATERIAL.length + 1);
        s.observe(`${shared.uploadSubmittal} · ${schedule} → ${shared.uploadDate} / ${shared.uploadPoNumber}`);
        await inventory.closeActivityFormIfOpen();
      }, { critical: true });

      let balanceBefore;
      // STEP 3: Upload one "Loss" row of 1 with UoM, Supplier and Comments left blank.
      // Expected: the dialog says "uploaded successfully".
      await s.step(`Build file row (Loss, From Location, QTY 1, UoM/Supplier/Comments blank); "Upload" › choose file › "Upload" → message "uploaded successfully"`, async () => {
        await openLedger();
        balanceBefore = await inventory.readClosingBalance();
        const file = writeUploadFile(`${RUN_TAG}-ok.xlsx`, [uploadRow({ action: CHANGES.loss.action, quantity: 1 })]);
        const result = await uploadFile(file);
        s.observe(result || '(no message)');
        expect(result).toMatch(MESSAGES.uploadSucceeded);
      }, { attempts: 1 });

      // STEP 4: Close the dialog and reopen the ledger. Expected: the Closing Balance is 1 lower.
      await s.step(`Close the dialog; Ledger → "Closing Balance" is 1 lower than before the upload`, async () => {
        await page.keyboard.press('Escape');
        await openLedger();
        expect(await inventory.readClosingBalance()).toBe(balanceBefore - 1);
      });
    });

    if (templateScenario?.status === 'Passed') {
      // ---------- INV-REG-17 – A valid file with two rows applies both rows ----------
      await run.scenario(scenarioInfo('INV-REG-17', 'Upload valid file applies rows top to bottom', 'Positive'), async s => {
        let balanceBefore;
        // STEP 1: Upload "Issue To Construction 1" and "Loss 1", both commented with the run tag.
        // Purpose: a bulk upload must apply every row. Expected: "uploaded successfully".
        await s.step(`Build file with 2 rows (Issue To Construction 1, Loss 1, comments "${RUN_TAG} upload …"); "Upload" › choose file › "Upload" → "uploaded successfully"`, async () => {
          await openLedger();
          balanceBefore = await inventory.readClosingBalance();
          const file = writeUploadFile(`${RUN_TAG}-two.xlsx`, [
            uploadRow({ action: CHANGES.issueToConstruction.action, quantity: 1, comments: `${RUN_TAG} upload ${CHANGES.issueToConstruction.action}` }),
            uploadRow({ action: CHANGES.loss.action, quantity: 1, comments: `${RUN_TAG} upload ${CHANGES.loss.action}` })
          ]);
          expect(await uploadFile(file)).toMatch(MESSAGES.uploadSucceeded);
        }, { attempts: 1 });

        // STEP 2: Reopen the list and the ledger.
        // Expected: list stock and Closing Balance are both 2 lower. When the ledger shows a Comments column, both
        // uploaded rows ("<run tag> upload <action>") are listed.
        await s.step(`Close the dialog, reopen Inventory Management → grid Inventory and ledger "Closing Balance" are both 2 lower than before; both uploaded rows listed when the ledger shows comments`, async () => {
          await page.keyboard.press('Escape');
          await openInventoryList();
          const listStock = await inventory.readListInventory(MATERIAL);
          await inventory.openMaterialView(MATERIAL, 'Actions');
          expect(await inventory.readClosingBalance()).toBe(balanceBefore - 2);
          expect(listStock).toBe(balanceBefore - 2);
          const headers = (await inventory.ledgerTable().getByRole('columnheader').allInnerTexts()).map(text => text.trim().toLowerCase());
          if (headers.some(header => header.startsWith('comment'))) {
            await expect(inventory.ledgerRows().filter({ hasText: `${RUN_TAG} upload` })).toHaveCount(2);
          } else {
            // Not checked row by row: the ledger has no Comments column (columns: headers below).
            s.observe(`Ledger has no Comments column (${headers.join(', ')}); uploaded rows checked through the balance only`);
          }
        });
      });

      // ---------- INV-REG-16 – An upload with one invalid row saves nothing ----------
      await run.scenario(scenarioInfo('INV-REG-16', 'Upload is all-or-nothing', 'Negative'), async s => {
        let balanceBefore;
        // STEP 1: Upload "Loss 1" plus "Loss 99999" (more than the stock).
        // Purpose: a partly wrong file must not leave half the rows applied.
        // Expected: "The upload failed. Nothing was saved."
        await s.step(`Build file with Loss 1 and Loss 99999; "Upload" › choose file › "Upload" → "The upload failed. Nothing was saved."`, async () => {
          await openLedger();
          balanceBefore = await inventory.readClosingBalance();
          const validRowQuantity = 1;
          // The valid row comes first; INV-REG-18 needs its quantity (same From Location as the invalid row).
          shared.uploadQuantityAheadOfInvalidRow = validRowQuantity;
          const file = writeUploadFile(`${RUN_TAG}-bad.xlsx`, [
            uploadRow({ action: CHANGES.loss.action, quantity: validRowQuantity, comments: `${RUN_TAG} atomic` }),
            uploadRow({ action: CHANGES.loss.action, quantity: INVALID.overdraw, comments: `${RUN_TAG} atomic` })
          ]);
          await openInventoryList();
          await upload.openUploadDialog();
          await upload.uploadAndReadResult(file);
          await expect(page.getByText(testData.expectedMessages.uploadFailedNothingSaved).first()).toBeVisible({ timeout: 20000 });
        });

        // STEP 2: Download the error file.
        // Expected: one row marked "Valid (not saved)" and one "Not enough stock" row. Its "available" figure is
        // kept for INV-REG-18.
        await s.step(`Click "Download error file" → sheet has a "Valid (not saved)" row and a "Not enough stock" row; its "available" figure is kept for INV-REG-18`, async () => {
          const errorFile = await upload.saveErrorFileTo(path.join(TEMP_FOLDER, 'errors.xlsx'));
          const rows = readXlsxRows(errorFile).map(row => row.join(' | '));
          s.observe(rows.slice(0, 3).join(' // ').slice(0, 300));
          expect(rows.some(row => /Valid \(not saved\)/.test(row))).toBe(true);
          const stockError = rows.find(row => /Not enough stock/.test(row));
          expect(stockError).toBeTruthy();
          shared.uploadAvailable = Number((stockError.match(/([\d.]+) available/) || [])[1]);
          // The figure is the stock at the row's From Location, not the site total.
          shared.uploadAvailableLocation = sourceLocation();
        });

        // STEP 3: Close the dialog and reopen the ledger. Expected: the Closing Balance is unchanged.
        await s.step(`Click "Close"; Ledger → "Closing Balance" is unchanged`, async () => {
          await upload.closeUploadDialog();
          await openLedger();
          expect(await inventory.readClosingBalance()).toBe(balanceBefore);
        });
      });

      // ---------- INV-REG-18 – The upload's "available" stock equals the form's stock at the same location ----------
      await run.scenario(scenarioInfo('INV-REG-18', 'Upload available stock matches the form', 'Positive'), async s => {
        // STEP 1: Open Add Activity (Loss, no save) on the same From Location and read the "Available at" hint.
        // Purpose: the upload and the Add Activity form must use the same stock figure for a location (INV-R3).
        // Expected: the hint names the same location as the upload row, and the error file's "available" figure is
        // the hint minus the rows above the invalid row (observed 21 Nov: the upload checks rows top to bottom and
        // deducts the earlier valid rows, e.g. hint 52 − Loss 1 = 51; pending team confirmation, see
        // docs/automation-gap-analysis/PENDING_CONFIRMATIONS.md).
        // Note: until 21 Nov this compared with the ledger Closing Balance, which is the whole site and can never match.
        await s.step(`Ledger › "Add Activity": action "Loss", QTY 1, no save → upload error file "available" = "Available at <upload From Location>: N" minus the valid row above it`, async () => {
          await openLedger();
          await recordActivity({ action: CHANGES.loss.action, quantity: 1, save: false });
          const hint = await inventory.readAvailableStockHint();
          await inventory.closeActivityFormIfOpen();
          const expectedAvailable = hint.quantity - shared.uploadQuantityAheadOfInvalidRow;
          s.observe(`Upload error file: ${shared.uploadAvailable} at ${shared.uploadAvailableLocation} · form: ${hint.text} · expected ${hint.quantity} − ${shared.uploadQuantityAheadOfInvalidRow} = ${expectedAvailable}`);
          expect(hint.text, 'Form hint is for another location than the upload row').toContain(shared.uploadAvailableLocation);
          expect(shared.uploadAvailable, 'Upload "available" figure differs from the form hint minus earlier rows (INV-R3)').toBe(expectedAvailable);
        });
      });
    } else {
      for (const id of ['17', '16', '18']) {
        run.skip(scenarioInfo(`INV-REG-${id}`, 'Needs the upload template and a run schedule', 'Dependent'), 'INV-REG-19 failed');
      }
    }

    // =================================================================================================================
    // Read-only checks: INV-REG-20, 22, 23
    // =================================================================================================================
    // ---------- INV-REG-20 – The ledger's "Submittal" column shows the Submittal No ----------
    await run.scenario(scenarioInfo('INV-REG-20', 'Ledger columns', 'Positive'), async s => {
      // STEP 1: Read the "Submittal" cell of a run row in the ledger.
      // Purpose: users trace each movement to its submittal. Expected: the value contains "-SUB-" (today the
      // Spec Section No is shown instead, OBS-INV-1).
      await s.step(`Ledger → "Submittal" column of a run row (PL…-) → value contains "-SUB-", the Submittal No (OBS-INV-1)`, async () => {
        await openLedger();
        const table = inventory.ledgerTable();
        const headers = (await table.getByRole('columnheader').allInnerTexts()).map(text => text.trim().toLowerCase());
        const submittalColumn = headers.indexOf('submittal');
        const runRow = table.getByRole('row').filter({ hasText: /PL[DTRS]\d+-/ }).first();
        const submittalCell = (await runRow.getByRole('cell').nth(submittalColumn).innerText()).trim();
        s.observe(`Submittal cell: ${submittalCell}`);
        expect(submittalCell, 'Ledger Submittal column shows the Spec Section No (OBS-INV-1)').toMatch(/-SUB-/);
      });
    });

    // ---------- INV-REG-22 – "Export" downloads the stock balance list ----------
    await run.scenario(scenarioInfo('INV-REG-22', 'Export is the balance list (INV-R2)', 'Positive'), async s => {
      // STEP 1: Click "Export" on the list page and open the file.
      // Purpose: the export is the stock report users share (rule INV-R2). Expected: the header contains
      // Material ID, Material Name and Inventory (today it is the activity log, OBS-INV-8).
      await s.step(`Inventory Management › "Export" → xlsx header contains ${testData.exportBalanceListColumns.join(', ')}, the balance list (OBS-INV-8)`, async () => {
        await openInventoryList();
        const exportFile = await inventory.exportListTo(path.join(TEMP_FOLDER, 'export.xlsx'));
        const header = readXlsxRows(exportFile)[0] || [];
        s.observe(header.join(' | '));
        expect(header, 'Export is the activity log, not the balance list (OBS-INV-8)').toEqual(expect.arrayContaining(testData.exportBalanceListColumns));
      });
    });

    // ---------- INV-REG-23 – Each site shows only its own locations, and the chosen site survives a reload ----------
    await run.scenario(scenarioInfo('INV-REG-23', 'Site isolation', 'Positive'), async s => {
      let startingSite;
      let otherSite;
      let startingLocations;
      /** Location filter options after the list has loaded for the current site. */
      const locationsOnCurrentSite = async () => {
        await procurement.settle(2500);
        return inventory.readLocationFilterOptions();
      };

      // STEP 1: Note the header site and the locations offered by the list's location filter.
      await s.step(`Inventory Management → note the header site and the options of the Location dropdown`, async () => {
        await openInventoryList();
        startingSite = await siteSelector.activeSiteName();
        startingLocations = await locationsOnCurrentSite();
      });

      // STEP 2: Switch the header to the second site.
      // Purpose: stock of one site must never be offered on another. Expected: none of the first site's locations.
      await s.step(`Header site selector: switch to the second site (SCP_INV_SITE2 or default) → Location dropdown lists none of the first site's locations`, async () => {
        const warehouse = testData.secondSite.warehouseSiteName;
        otherSite = SECOND_SITE || (startingSite === warehouse ? testData.secondSite.whenStartingOnWarehouse : warehouse);
        await siteSelector.ensureSite(otherSite);
        const otherLocations = await locationsOnCurrentSite();
        s.observe(`${startingSite}: ${startingLocations.join(', ')} · ${otherSite}: ${otherLocations.join(', ')}`);
        expect(otherLocations.filter(location => startingLocations.includes(location))).toEqual([]);
      });

      // STEP 3: Reload the page. Expected: the header still shows the second site (today it reverts, OBS-INV-12).
      await s.step(`Reload the page → header still shows the second site (OBS-INV-12 if it reverts)`, async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await procurement.settle(3000);
        const siteAfterReload = await siteSelector.activeSiteName();
        s.observe(`After reload: ${siteAfterReload}`);
        expect(siteAfterReload, 'Header site reverts after a reload (OBS-INV-12)').toBe(otherSite);
      });

      // STEP 4: Put the starting site back so later suites start where they expect.
      await s.step(`Header site selector: switch back to the starting site if different`, async () => {
        if ((await siteSelector.activeSiteName()) !== startingSite) await siteSelector.ensureSite(startingSite);
      });
    });

    run.skip(scenarioInfo('INV-REG-24', 'History date filter inclusive', 'Positive'),
      'Covered by the 24 Oct Inventory automation; the ledger date pickers are not driven here (SCP-DEF-002 risk)');
    run.skip(scenarioInfo('INV-REG-25', 'Activity date picker', 'Known Defect'),
      'SCP-DEF-002: clicking the input freezes the tab, so it is never clicked');
  } });
});
