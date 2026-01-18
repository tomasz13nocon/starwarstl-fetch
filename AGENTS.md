# Agent Guidelines for starwarstl/fetch

## Project Overview

This is the "fetch" module of starwarstl - a website showing a complete timeline of canon Star Wars media. This module:

1. Fetches raw data from Wookieepedia (Star Wars wiki on Fandom)
2. Parses, transforms, and structures the data
3. Stores it in MongoDB

Runs daily via cron. Sister modules are `../client` (React SPA) and `../server` (Express REST API).

The module is effectively a pure function mapping wikitext input to database data.

To run the main script run `npm run fetch -- --local`

If you need to see what the actual input data we're dealing with looks like, poke around the files in `fixtures`.

## Testing

Vitest version 4

See `tests/README.md` for full details.

```bash
npm test                         # Run all tests
npm test -- --project unit       # Run unit tests only
npm test -- --project integration # Run integration tests (excludes regression)
npm test -- --project regression # Run regression test only
```

### wtf_wikipedia Structure

The `wtf_wikipedia/` directory contains a custom fork of the wikitext parser. Key locations:

- **Recognized infobox templates**: `wtf_wikipedia/src/infobox/_infoboxes.js` - Templates listed here are treated as infoboxes (e.g., `movie`, `book`, `televisionepisode`). If a new infobox template is added to Wookieepedia, it must be added here and wtf_wikipedia must be rebuilt with `npm run build` in the `wtf_wikipedia/` directory.
- **Template parsing**: `wtf_wikipedia/src/template/` - How templates are parsed
- **Infobox detection**: `wtf_wikipedia/src/template/parse/_infobox.js` - Logic for identifying infoboxes
- **Built output**: `wtf_wikipedia/builds/` - The compiled library (must rebuild after source changes)

## Current State

The module is being refactored from JavaScript to TypeScript. The codebase has significant technical debt and ad-hoc logic. The refactor must not introduce any regressions to the actual core logic. The output (db) must be the same after the refactor as before it, given the same data.

### Critical Constraints

**DO NOT CHANGE:**

- TypeScript as the target language
- The custom fork of `wtf_wikipedia` as the wikitext parser (located in `./wtf_wikipedia/` submodule)
- The Rust native module for parsing appearances (`native/`) - it must remain as the appearances parser

**IGNORE:**

- `rust-rewrite/` - incomplete experimental rewrite, not part of this refactor

**Everything else** can be revised to improve code quality.

### Key Architecture

- Entry point: `src/index.js`
- Pipeline stages in `src/pipeline/`
- Wookieepedia API client: `src/fetchWookiee.js`
- Custom wtf_wikipedia templates: `src/initWtf.js`
- Native Rust module for appearances parsing: `native/`
- Image handling: `src/image/` (S3 or filesystem)

### Refactoring Goals

- Port all JS to TypeScript with proper types
- No functional regressions
- Improve code quality, structure, and maintainability
- Perform one refactoring step at a time after one user prompt (e.g 1.2, then finish and wait for prompt, then start 1.3 etc.)
- See `REFACTOR.md` for detailed plan

### Learning about the codebase

If during the refactor process you learn something about the this codebase (the part that we WILL NOT be changing in this refactor, like wtf_wikipedia's structure), specifically something that will be valuable to other agents working on the refactor, add a brief mention of it to AGENTS.md outside the refactor section (which will be removed later)

## Handling Broken Wikitext

Sometimes the script will fail due to broken/malformed wikitext on Wookieepedia (e.g., unclosed templates, missing infoboxes). When this happens:

1. **Identify if it's broken wikitext** - Check if the issue is malformed markup on the wiki rather than a bug in our code
2. **Report to user** - The user can manually edit the Wookieepedia article to fix the issue
3. **Temporary workarounds are OK** - If needed, add preprocessing to handle the broken wikitext temporarily, but mark it with a TODO comment indicating it should be removed once the wiki is fixed
4. **Re-capture fixtures** - After the wiki is fixed, re-run the capture script to update local fixtures

Also currently errors parsing appearances of "A New Dawn" and "'Star Wars'' 4" are to be expected. Ignore them, they don't break the script.
