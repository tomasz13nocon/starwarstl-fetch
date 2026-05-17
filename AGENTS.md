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

```bash
npm run check                      # Type-check TypeScript
npm run format                     # Format src/ with Prettier
npx eslint src                     # Lint source files
npm run capture                    # Capture live Wookieepedia/API data into fixtures
npm run baseline                   # Regenerate regression baseline snapshots
```

## Testing

Vitest version 4

See `tests/README.md` for full details.

```bash
npm test                         # Run all tests
npm test -- --project unit       # Run unit tests only
npm test -- --project integration # Run integration tests (excludes regression)
npm test -- --project regression # Run regression test only
```

**Regression tests are mandatory after changes that can affect parser or pipeline output.** The regression suite is the primary guard against behavior changes; do not consider a behavioral pipeline change complete until `npm test -- --project regression` has passed unless the user explicitly says otherwise.

### wtf_wikipedia Structure

The `wtf_wikipedia/` directory contains a custom fork of the wikitext parser. Key locations:

- **Recognized infobox templates**: `wtf_wikipedia/src/infobox/_infoboxes.js` - Templates listed here are treated as infoboxes (e.g., `movie`, `book`, `televisionepisode`). If a new infobox template is added to Wookieepedia, it must be added here and wtf_wikipedia must be rebuilt with `npm run build` in the `wtf_wikipedia/` directory.
- **Template parsing**: `wtf_wikipedia/src/template/` - How templates are parsed
- **Infobox detection**: `wtf_wikipedia/src/template/parse/_infobox.js` - Logic for identifying infoboxes
- **Built output**: `wtf_wikipedia/builds/` - The compiled library (must rebuild after source changes)


### Key Architecture

- Entry point: `src/index.ts`
- Pipeline stages in `src/pipeline/`
- Pipeline orchestrator: `src/runPipeline.ts`
- Wookieepedia API client: `src/fetchWookiee.ts`; local fixture source: `src/fetchLocal.ts`
- Custom wtf_wikipedia templates: `src/initWtf.ts`
- Native Rust module for appearances parsing: `native/`
- Image handling: `src/image/` (S3 or filesystem)

## Handling Broken Wikitext

Sometimes the script will fail due to broken/malformed wikitext on Wookieepedia (e.g., unclosed templates, missing infoboxes). When this happens:

1. **Identify if it's broken wikitext** - Check if the issue is malformed markup on the wiki rather than a bug in our code
2. **Report to user** - The user can manually edit the Wookieepedia article to fix the issue
3. **Temporary workarounds are OK** - If needed, add preprocessing to handle the broken wikitext temporarily, but mark it with a TODO comment indicating it should be removed once the wiki is fixed
4. **Re-capture fixtures** - After the wiki is fixed, re-run the capture script to update local fixtures

