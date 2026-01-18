# Test Infrastructure

## Quick Reference

```bash
npm test                              # Run all tests
npm test -- --project unit            # Unit tests only (~0.1s)
npm test -- --project integration     # Integration tests, excludes regression (~1s)
npm test -- --project regression      # Full regression test (~40s)
```

## Test Structure

### Unit Tests (`tests/unit/`)

Fast tests for pure functions: date parsing, string utilities, regex patterns.

### Integration Tests (`tests/integration/`)

**`timeline.test.js`** - Tests the timeline parsing stage against live fixtures. Catches parsing issues when Wookieepedia data changes.

**`pipeline-regression.test.js`** - The core refactor test. Re-runs the full pipeline against frozen fixtures and compares output to a baseline captured from the original JS implementation. This ensures the TypeScript refactor produces identical output.

## Baseline System

The `tests/snapshots/` directory contains:

- `fixtures/` - Frozen input data (copy of `fixtures/canon/` when baseline was captured)
- `pipeline-baseline.json` - Expected output from the JS implementation (~56MB)

**Important**: The baseline was captured once from the working JS implementation. Do NOT regenerate it during the refactor - the whole point is to compare against the original output.

## After the Refactor

Once the TypeScript refactor is complete:

- The regression test and baseline can be removed (no longer needed)
- Keep `timeline.test.js` and unit tests for ongoing development
- Potentially reuse the baseline approach for future rewrites (e.g., Rust)
