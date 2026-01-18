# Refactoring Plan: starwarstl/fetch

## Overview

Port the fetch module from JavaScript to TypeScript while improving code quality, maintainability, and structure. **No functional regressions allowed.**

## Constraints

- **Keep:** TypeScript, custom wtf_wikipedia fork, Rust native module for appearances
- **Ignore:** `rust-rewrite/` directory (incomplete, not part of this refactor)

## Documenting progress

After each step, besides marking steps as complete write a VERY BRIEF description of changes made, that might be useful to other agents continuing the refactor. This should be brief to limit context usage, and precisely selectively chosen - only things that future agents will absolutely need to know. So some steps might not even include anything like that, which is fine. Not all steps will need this!
This is an addition - not a replacement - to documenting code you write, and writing any other .md files as needed.

## Current State Analysis

### File Structure

```
src/
├── index.js              # Entry point, orchestrates pipeline
├── config.js             # CLI args + env vars config
├── const.js              # Constants, enums, suppression lists
├── db.js                 # MongoDB connection
├── env.js                # dotenv init
├── fetchWookiee.js       # Wookieepedia API client (async generator)
├── initWtf.js            # Custom wtf_wikipedia template handlers
├── netLog.js             # Network statistics tracking
├── parseWookieepediaDate.js  # BBY/ABY date parsing
├── parsing.js            # Wikitext parsing, infobox extraction (482 lines)
├── regex.js              # Type detection regexes
├── util.js               # Utility functions + logging setup
├── image/
│   ├── fsImage.js        # Filesystem image storage
│   └── s3Image.js        # S3 image storage
└── pipeline/
    ├── timeline.js       # Parse timeline table → drafts
    ├── media.js          # Fetch individual media articles
    ├── series.js         # Fetch series articles
    ├── mediaTypes.js     # Determine fullType (book-a, tv-animated, etc.)
    ├── adjustBookTypes.js# Adjust book series to yr type
    ├── images.js         # Fetch/process cover images
    ├── validateFullTypes.js  # Validate required fullTypes
    ├── cleanupDrafts.js  # Remove empty/null values
    └── validatePageIds.js    # Verify page ID consistency
```

### Identified Technical Debt

1. **Mutable draft objects** passed through pipeline stages
2. **`parsing.js` is 482 lines** mixing AST processing, API calls, type detection
3. **Hardcoded suppression lists** in `const.js` (could be config files)
4. **Magic strings** for types scattered throughout ("book-a", "tv-animated")
5. **Blocking top-level await** in `db.js`
6. **No automated tests**
7. **Inconsistent error handling** (throw + silent catches)
8. **Duplicate code** (test.js duplicates initWtf.js templates)

---

## Phase 0: Test Infrastructure (CRITICAL - DO FIRST)

**Goal:** Enable offline development and create comprehensive regression tests.

### 0.1 Local Data Capture

- [x] Create `scripts/capture-api-data.js` to fetch and save all API responses to filesystem
- [x] Save to `fixtures/` directory:
  - Timeline page wikitext
  - All media article wikitexts
  - All series article wikitexts
  - All image info responses

### 0.2 Local Data Source

- [x] Add `--local` / `--offline` flag to config
- [x] Create `src/fetchLocal.js` - reads from `fixtures/` instead of API
- [x] Modify `fetchWookiee.js` to delegate to local or remote based on config
- [x] Same interface as current async generators

### 0.3 Comprehensive Test Suite

- [x] Set up Vitest with TypeScript support
- [x] Create snapshot tests for pipeline output:
  - Timeline parsing → draft objects
  - Full pipeline → final DB-ready objects (drafts, seriesDrafts, appearancesDrafts)
- [x] Test individual pure functions:
  - Date parsing (BBY/ABY) - `parseWookieepediaDate`
  - Type detection regexes - `reg`, `seasonReg`, `seriesRegexes`
  - Utility functions - `toCamelCase`, `toHumanReadable`, `unscuffDate`
  - AST processing - `reduceAstToText`
- [x] Create test runner that compares full pipeline output against baseline
  - `npm run baseline` - generates baseline from fixtures
  - `tests/integration/pipeline-regression.test.js` - re-runs pipeline and compares
- [x] **Run tests after every file conversion to catch regressions**

#### Test Infrastructure Summary

```
tests/
├── unit/                           # Pure function tests (fast)
│   ├── parseWookieepediaDate.test.js
│   ├── util.test.js
│   ├── regex.test.js
│   └── parsing.test.js
├── integration/                    # Pipeline tests
│   ├── timeline.test.js            # Timeline stage only
│   ├── pipeline.test.js            # Baseline structure validation
│   └── pipeline-regression.test.js # Full regression (slow, ~10 min)
└── snapshots/                      # Frozen baseline data
    ├── fixtures/                   # Input: copy of fixtures at baseline time
    │   └── canon/
    ├── pipeline-baseline.json      # Output: expected pipeline results
    └── baseline-stats.json         # Summary stats

scripts/
├── capture-api-data.js             # Fetch live data → fixtures/
└── generate-baseline.js            # Run pipeline → tests/snapshots/
```

**Commands:**

- `npm test` - Run all tests except slow regression
- `npm test -- tests/unit/` - Run unit tests only
- `npm test -- tests/integration/pipeline-regression.test.js` - Run full regression
- `npm run baseline` - Regenerate baseline (run after intentional changes)

---

## Phase 1: TypeScript Foundation

**Goal:** Set up TypeScript infrastructure without changing logic.

### 1.1 TypeScript Configuration

- [ ] Add `tsconfig.json` with strict settings
- [ ] Configure ES modules output (preserve current module system)
- [ ] Set up path aliases for cleaner imports
- [ ] Add build scripts to `package.json`. Use modern tooling

### 1.2 Type Definitions

- [ ] Create `src/types/` directory
- [ ] Define core domain types:
  - `MediaDraft` - draft objects flowing through pipeline
  - `SeriesDraft` - series draft objects
  - `MediaType`, `FullType` - union types for media classification
  - `WookieepediaPage` - API response shape
  - `Infobox` - parsed infobox structure
  - `Appearance` - character/location appearances
  - `Config` - configuration object shape

### 1.3 wtf_wikipedia Types

- [ ] Create minimal `src/types/wtf_wikipedia.d.ts`
- [ ] Only type the functions/methods we actually use
- [ ] Use type assertions where needed rather than fully typing the library
- [ ] Document which wtf_wikipedia APIs we depend on

### 1.4 Initial Conversion (Low-Risk Files)

- [ ] `src/env.ts` - trivial, just dotenv
- [ ] `src/const.ts` - constants and enums
- [ ] `src/regex.ts` - regex patterns
- [ ] `src/netLog.ts` - network stats

---

## Phase 2: Core Module Conversion

**Goal:** Convert core modules with proper typing.

### 2.1 Utilities

- [ ] `src/util.ts` - utility functions and logging setup

### 2.2 Configuration

- [ ] `src/config.ts` - type the config object and CLI args
- [ ] Add `--local` flag for offline mode

### 2.3 Database Layer

- [ ] `src/db.ts` - type MongoDB collections
- [ ] Fix blocking top-level await (use lazy connection)
- [ ] Define collection schemas/types

### 2.4 API Client

- [ ] `src/fetchWookiee.ts` - type async generator yields
- [ ] `src/fetchLocal.ts` - local filesystem data source
- [ ] Type API response shapes
- [ ] Add proper error types

### 2.5 Date Parsing

- [ ] `src/parseWookieepediaDate.ts` - already pure, easy to type

---

## Phase 3: Parsing Module Refactor

**Goal:** Break down the monolithic `parsing.js` into focused modules.

### 3.1 Split `parsing.js` (482 lines) into:

- [ ] `src/parsing/infobox.ts` - infobox extraction and field mapping
- [ ] `src/parsing/categories.ts` - category parsing
- [ ] `src/parsing/firstSentence.ts` - first sentence type detection
- [ ] `src/parsing/appearances.ts` - wrapper around Rust native module
- [ ] `src/parsing/index.ts` - re-exports

### 3.2 Type the Parsing Layer

- [ ] Define `ParsedArticle` type
- [ ] Type infobox field mappings
- [ ] Type appearance structures (from Rust module)

---

## Phase 4: Pipeline Conversion

**Goal:** Convert pipeline stages with clear input/output types.

### 4.1 Define Pipeline Types

- [ ] `PipelineContext` - shared state across stages
- [ ] Stage input/output contracts

### 4.2 Convert Pipeline Stages

- [ ] `pipeline/timeline.ts`
- [ ] `pipeline/media.ts`
- [ ] `pipeline/series.ts`
- [ ] `pipeline/mediaTypes.ts`
- [ ] `pipeline/adjustBookTypes.ts`
- [ ] `pipeline/images.ts`
- [ ] `pipeline/validateFullTypes.ts`
- [ ] `pipeline/cleanupDrafts.ts`
- [ ] `pipeline/validatePageIds.ts`

### 4.3 Image Handling

- [ ] `image/fsImage.ts`
- [ ] `image/s3Image.ts`
- [ ] Define common `ImageStorage` interface

---

## Phase 5: wtf_wikipedia Integration

**Goal:** Properly integrate the custom wtf_wikipedia fork.

### 5.1 Template Handlers

- [ ] `src/initWtf.ts` - type custom template registration
- [ ] Consider extracting template definitions to config

---

## Phase 6: Entry Point & Integration

**Goal:** Convert main entry point and ensure everything works together.

### 6.1 Main Entry Point

- [ ] `src/index.ts` - orchestration logic
- [ ] Type the full pipeline flow
- [ ] Improve error handling

### 6.2 Scripts

- [ ] Update `scripts/run.sh` for TypeScript build
- [ ] Convert `scripts/resizeTvImages.js` to TypeScript

---

## Phase 7: Quality Improvements

**Goal:** Improve code quality beyond just adding types.

### 7.1 Configuration Externalization

- [ ] Move suppression lists from `const.ts` to JSON/YAML config files
- [ ] Add `.env.example` with placeholder values for documentation

### 7.2 Error Handling

- [ ] Define custom error classes
- [ ] Consistent error handling strategy

### 7.3 CLI Improvements

- [ ] Add proper CLI framework (commander/yargs)
- [ ] Better help text and argument validation

### 7.4 Documentation

- [ ] JSDoc comments on public APIs
- [ ] Update README.md with build/run instructions

---

## Migration Strategy

### Approach: Incremental Conversion

1. **Phase 0 first** - tests are critical for safe refactoring
2. **Don't convert everything at once** - convert file by file
3. **Keep JS and TS coexisting** during transition
4. **Run tests after each file conversion**
5. **Commit frequently** - one file or related group per commit

### File Conversion Order

1. **Phase 0:** Test infrastructure (before any conversion!)
2. Leaf modules first (no dependencies): `env`, `const`, `regex`
3. Core utilities: `netLog`, `util`, `parseWookieepediaDate`
4. Infrastructure: `config`, `db`
5. API layer: `fetchWookiee`, `fetchLocal`
6. Parsing layer: split and convert `parsing.js`
7. Pipeline stages: in dependency order
8. Entry point: `index.js` last

### Validation Checklist (After Each Conversion)

- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Pipeline runs successfully with local data
- [ ] Output matches baseline snapshots

---

## Success Criteria

1. **All `.js` files converted to `.ts`**
2. **Strict TypeScript** - no `any` types except where unavoidable
3. **Comprehensive test suite** with snapshot tests
4. **All tests pass**
5. **Pipeline output identical** to pre-refactor baseline
6. **Offline mode** works for development
7. **Improved code organization** - especially `parsing.js` split

---

## Open Questions

1. Should pipeline stages return new objects instead of mutating? (use best judgment)
2. Consider adding a proper CLI framework (commander, yargs)? (yes, do it)

---

## Timeline Estimate

| Phase                        | Estimated Effort |
| ---------------------------- | ---------------- |
| Phase 0: Test Infrastructure | 2-3 days         |
| Phase 1: Foundation          | 1-2 days         |
| Phase 2: Core Modules        | 2-3 days         |
| Phase 3: Parsing Refactor    | 2-3 days         |
| Phase 4: Pipeline            | 3-4 days         |
| Phase 5: wtf_wikipedia       | 1 day            |
| Phase 6: Integration         | 1-2 days         |
| Phase 7: Quality             | 2-3 days         |
| **Total**                    | **14-21 days**   |

_Estimates assume focused work; actual time may vary based on discovered complexity._
