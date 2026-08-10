# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Codex feature and fix workflow

- Treat each Codex task as one cohesive, shippable feature or fix and its corresponding Git branch/PR.
- Keep implementation, review follow-ups, and fixes for that branch in the same Codex task.
- If the work grows beyond one reviewable PR, split both the branch and the Codex task.

## Deferred testing workflow

Use a completion gate so implementation can proceed without repeatedly running long checks after individual edits.

### During implementation

- Do not run automated tests, linting, type-checking, Expo exports, native builds, simulators, or device builds after individual changes.
- Do not run validation early unless the user explicitly asks for it.
- If an early validation command is genuinely required to diagnose or unblock the work, explain why and ask the user for permission before running it.
- Read-only inspection and code review are allowed; they are not considered test execution.

### When to run the completion gate

Run the completion gate only when either:

1. The feature or fix is implementation-complete and ready for final handoff, commit, or PR review.
2. The user explicitly says: **"Run the completion gate."**

The exact user command **"Run the completion gate."** authorizes immediate testing even if implementation is still in progress. Do not treat general requests such as "check this" or "does this look right" as permission to run tests.

### Completion gate checks

Run the applicable checks once, in fail-fast order:

1. Perform a read-only QA review by default: compare the implementation with the requested behavior and acceptance criteria, inspect the final diff for regressions and unrelated changes, and consider relevant loading, empty, error, edge-case, and accessibility states.
2. Run targeted static checks and tests for the changed code.
3. Run repository-wide linting and type-checking when configured.
4. Run relevant broader automated test suites when warranted by the change.
5. Run expensive interactive QA, including launching the app, using a simulator or device, or clicking through flows, only when the user explicitly requests it.

A QA review is part of every completion gate by default; expensive interactive QA is only performed when explicitly requested.

Do not run `npx expo export`, an iOS export, an EAS build, or a native production build as part of routine feature/fix validation. Those steps belong to release preparation or production-build troubleshooting and require an explicit user request.

If a completion-gate check fails, fix the issue and rerun the affected check. Then perform one final relevant validation pass before handoff; do not rerun unrelated long suites unnecessarily.

In the final response, report exactly which checks ran, their results, and any applicable checks that were intentionally not run.
