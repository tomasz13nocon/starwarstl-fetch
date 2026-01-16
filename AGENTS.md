# Agent Guidelines for starwarstl/fetch

## Project Overview

This is the "fetch" module of starwarstl - a website showing a complete timeline of canon Star Wars media. This module:

1. Fetches raw data from Wookieepedia (Star Wars wiki on Fandom)
2. Parses, transforms, and structures the data
3. Stores it in MongoDB

Runs daily via cron. Sister modules are `../client` (React SPA) and `../server` (Express REST API).

The module is effectively a pure function mapping wikitext input to database data.

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
- See `REFACTOR.md` for detailed plan
