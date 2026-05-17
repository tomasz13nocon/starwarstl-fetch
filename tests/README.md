# Test Infrastructure

## Quick Reference

```bash
npm test                              # Run all tests
npm test -- --project unit            # Unit tests only
npm test -- --project integration     # Integration tests, excludes regression
npm test -- --project regression      # Full regression test
```

## Test Structure

### Unit Tests (`tests/unit/`)

Fast tests for pure functions: date parsing, string utilities, regex patterns.

### Integration Tests (`tests/integration/`)

**`timeline.test.js`** - Tests the timeline parsing stage against live fixtures. Catches parsing issues when Wookieepedia data changes.

**`pipeline-regression.test.js`** - Re-runs the full pipeline against frozen fixtures and compares output to the checked-in baseline. Use this before committing parser or pipeline behavior changes.

## Baseline System

The `tests/snapshots/` directory contains:

- `fixtures/` - Frozen input data (copy of `fixtures/canon/` when baseline was captured)
- `pipeline-baseline.json` - Expected pipeline output (~56MB)

Regenerate the baseline only for intentional behavior changes, and review the diff carefully before committing it.
