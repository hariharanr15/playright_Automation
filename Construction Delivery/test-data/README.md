# Test Data

This folder separates data by execution purpose so Cucumber and Playwright tests do not share unsafe records accidentally.

- `smoke/` - minimal data for critical path checks.
- `regression/` - reusable data for positive regression flows.
- `negative/` - invalid inputs and validation datasets.
- `roles/` - role and permission combinations.
- `configuration/` - switch and setting baselines that must be restored after execution.

Use generated names, timestamps, or sequence files for records created during automation.
