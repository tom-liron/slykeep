# Test Action

**On demand, not a stage.** `start` writes tests alongside the implementation and runs `npm test`
before it reports, so a feature that has just been implemented does not need this. Use it for the
other case: code that already shipped without tests, and now wants them. That is a repair after the
fact — `fix/editor-preferences-action-tests` in `context/feature-history.md` is one — and it is what
to run when `/feature review` says coverage is thin, or when tests were skipped to move fast.

1. Read current-feature.md to understand what was implemented
2. Identify server actions and utility functions added/modified for this feature
3. Check if tests already exist for these functions
4. For functions without tests that have testable logic, write unit tests:
   - Create unit tests using Vitest
   - Focus on server actions and utilities (not components)
   - Test happy path and error cases
   - Do not write tests just to write them. Use your best judgement
5. Run `npm test` to verify all tests pass
6. Report test coverage for the new feature code
