// Skipped cases whose check is executed by another case of the same full regression (22 Nov 2026).
// scripts/non-pass-report.js counts such a case as Passed ("covered") only when every covering case, or the named step of
// it, passed in the consolidated results; otherwise the case stays Skipped and the report says which covering result
// prevented it. Keys are the runner's suite keys (app-regression, regression, regression2, pl-regression, pl-regression3, …).
// Only cases whose covering check was verified step by step on the 21/22 Nov runs are listed.
const COVERED_BY = [
  { suite: 'app-regression', id: 'UM-REG-04', by: [{ suite: 'app-regression', id: 'UM-REG-01', step: /leave organization empty/ }] },
  { suite: 'app-regression', id: 'UM-REG-05', by: [{ suite: 'app-regression', id: 'UM-REG-01', step: /"Add Another User"/ }] },
  { suite: 'app-regression', id: 'FDI-REG-01', by: [{ suite: 'pl-regression3', id: 'PL-REG-INT-01' }] },
  { suite: 'app-regression', id: 'FDI-REG-01a', by: [{ suite: 'app-regression', id: 'FDI-REG-01b' }] },
  { suite: 'app-regression', id: 'FDI-REG-02', by: [{ suite: 'app-regression', id: 'FDI-REG-06' }] },
  { suite: 'app-regression', id: 'FDI-REG-03', by: ['FDI-REG-08', 'FDI-REG-09', 'FDI-REG-10'].map(id => ({ suite: 'app-regression', id })) },
  { suite: 'app-regression', id: 'FDI-REG-11', by: [{ suite: 'app-regression', id: 'FDI-REG-10' }] },
  { suite: 'app-regression', id: 'SHP-REG-07', by: [{ suite: 'pl-regression3', id: 'PL-REG-EDT-07', step: /\(PL-REG-INT-02\)/ }] },
  // The Loss activity is executed in INV-REG-15; that step is a Known Defect (grid not refreshed), so INV-REG-03 stays Skipped.
  { suite: 'inv-regression', id: 'INV-REG-03', by: [{ suite: 'inv-regression', id: 'INV-REG-15', step: /action "Loss"/ }] },
  // Same case executed in PM regression part 2 with the data that part creates.
  ...['PM-REG-FDI-25a', 'PM-REG-FDI-42c', 'UPL-MM-15', 'UPL-SITE-13'].map(id => ({ suite: 'regression', id, by: [{ suite: 'regression2', id }] }))
];

module.exports = { COVERED_BY };
