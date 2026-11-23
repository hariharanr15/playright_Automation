#!/usr/bin/env bash
# Overnight run for the demo of 23 Nov 2026 – runs everything by itself and writes all deliverables.
#   1. Approved decision suites (cfg-live, roles-write, fresh-project, pm-decisions, supplier SSO promotion)
#   2. Full regression + E2E smoke, recorded (MP4) with a screenshot after every step
#   3. Smoke suites, recorded the same way
#   4. Reports (A4 PDFs): Failed/Blocked/Skipped, Known Defects, open Skipped (by group / by module), test case registers
#      (Passed / Known Defect / Skipped, A4 landscape), release notes; videos + screenshots collected in one folder
# Usage (from SCP): bash scripts/overnight-demo.sh   – progress in reports/overnight-<stamp>/overnight.log
set -u
cd "$(dirname "$0")/.."
STAMP=$(date +%Y-%m-%dT%H-%M)
OUT="reports/overnight-$STAMP"
mkdir -p "$OUT"
LOG="$OUT/overnight.log"
log() { echo "[$(date +%H:%M:%S)] $*" | tee -a "$LOG"; }
newest() { ls -td reports/pm-flow/"$1"-20* 2>/dev/null | head -1; }
export PM_FLOW_VIDEO=on PM_FLOW_STEP_SHOTS=on

log "Overnight run started → $OUT"
EXTRA=()
run_suite() { # suite [--only=…]
  log "Suite $* – start"
  node scripts/run-pm-flow.js "$@" --headless >>"$LOG" 2>&1
  local dir; dir=$(newest "$1"); log "Suite $* – done: $dir ($(grep -h '^PM ' "$LOG" | tail -1))"
  [ -n "$dir" ] && EXTRA+=("$dir")
}

# 1. Decision suites (approved 22 Nov 2026)
run_suite cfg-live
run_suite roles-write
run_suite fresh-project
run_suite pm-decisions
# SL-REG-15 runs inside the full regression (Other modules suite).

# 2. Full regression (includes fdi-settings, cfg-live, roles and the E2E smoke)
log "Full regression – start"
node scripts/run-full-regression.js --headless >>"$LOG" 2>&1
FULL=$(ls -td reports/full-regression-20* | head -1)
log "Full regression – done: $FULL"

# 3. Smoke suites
SMOKE=()
for s in smoke pl-smoke app-smoke; do log "Smoke $s – start"; node scripts/run-pm-flow.js "$s" --headless >>"$LOG" 2>&1; d=$(newest "$s"); SMOKE+=("$d"); log "Smoke $s – done: $d"; done

# 4. Reports
log "Reports – start"
# cfg-live runs again inside the full regression (newer): only the full regression's result counts for it.
KEEP=(); for d in "${EXTRA[@]}"; do case "$d" in *cfg-live-*) ;; *) KEEP+=("$d");; esac; done; EXTRA=("${KEEP[@]}")
node scripts/non-pass-report.js "$FULL" "${EXTRA[@]}" --evidence=reports/pm-flow/enterprise-2026-11-22T08-21-36-933Z >>"$LOG" 2>&1
node scripts/skipped-cases-report.js "$FULL" >>"$LOG" 2>&1
node scripts/testcase-register.js "$FULL" >>"$LOG" 2>&1
node scripts/known-defects-report.js >>"$LOG" 2>&1
for d in NON_PASSED_TEST_CASES KNOWN_DEFECT_TEST_CASES OPEN_SKIPPED_TEST_CASES OPEN_SKIPPED_TEST_CASES_BY_MODULE; do node scripts/md-to-pdf.js "$FULL/$d.md" >>"$LOG" 2>&1; done
for d in TEST_CASES_PASSED TEST_CASES_KNOWN_DEFECTS TEST_CASES_SKIPPED; do node scripts/md-to-pdf.js "$FULL/$d.md" --landscape >>"$LOG" 2>&1; done
VIDEOS="reports/demo-videos-$(date +%Y-%m-%d)"
node scripts/collect-videos.js "$VIDEOS" "$FULL" "${EXTRA[@]}" "${SMOKE[@]}" >>"$LOG" 2>&1
node scripts/release-notes.js "$FULL" --version=1.1 --evidence="$VIDEOS" >>"$LOG" 2>&1
node scripts/md-to-pdf.js "$FULL/AUTOMATION_RELEASE_NOTES.md" --title="SCP Test Automation Release Notes" >>"$LOG" 2>&1
log "Reports – done. Folder: $FULL · Videos and screenshots: $VIDEOS"
echo "$FULL|$VIDEOS" > "$OUT/DONE"
log "Overnight run finished"
