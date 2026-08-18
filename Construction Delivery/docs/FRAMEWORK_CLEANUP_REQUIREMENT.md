# Framework Cleanup Requirement

The automation framework must stay clean, scalable, and maintainable without breaking any existing working flow.

## Cleanup Scope

Review the existing automation framework and identify:

- Unused files and folders
- Duplicate reports
- Obsolete utilities
- Redundant test data
- Duplicate implementations
- Unnecessary lines of code
- Old generated artifacts that are not required for current execution

## Preservation Rules

Do not remove anything unless it is confirmed to be unused by:

- Smoke execution
- Regression execution
- Module-wise execution
- Cucumber documentation
- Environment configuration
- HTML reporting
- Existing Page Object Model classes
- Reusable components
- Fixtures, helpers, utilities, and test data still referenced by tests or scripts

The existing POM structure must be preserved.

## Safe Cleanup Process

1. List all candidate files and folders for cleanup.
2. Check references using source search before deleting anything.
3. Confirm whether each item is generated output, obsolete code, duplicate implementation, or required framework code.
4. Keep required Smoke, Regression, module-wise, Cucumber, environment, reporting, page object, component, fixture, helper, and test-data files.
5. Remove only confirmed unused files.
6. Run syntax checks and dry-run execution checks after cleanup.
7. Run at least one module-wise Smoke dry validation where possible.
8. Document what was removed and why.

## Cleanup Must Not Affect

- Existing working automation flows
- Existing page objects
- Existing reusable utilities
- Existing fixtures and test data used by active tests
- Existing HTML report generation
- Environment selection for Staging and UAT
- Cucumber feature and coverage documentation
- Module-wise Smoke and Regression execution
- Complete Smoke and Regression execution order

## Generated Artifacts Policy

Generated reports, screenshots, traces, videos, and test results may be cleaned only when they are not required as current evidence.

Keep the latest report outputs required by the reporting workflow unless the user explicitly approves deleting historical artifacts.

## Duplicate Implementation Policy

When duplicate code is found:

1. Prefer the existing reusable page object, component, utility, or helper.
2. Move common logic into the smallest appropriate reusable component only when needed.
3. Update callers to reuse the shared implementation.
4. Avoid changing business behavior.
5. Verify that affected Smoke and Regression flows still execute.

## Cleanup Deliverable

Every cleanup pass should produce a short cleanup summary containing:

- Removed files/folders
- Removed duplicate code
- Retained files that looked unused but are required
- Validation commands run
- Remaining cleanup risks or manual review items
