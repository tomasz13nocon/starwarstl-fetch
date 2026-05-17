# StarWarsTL: Wookieepedia script

Code used to fetch and transform data from Wookieepedia.

The fetch module reads Wookieepedia timeline/article data, parses it into typed media, series, image, and appearance drafts, then writes database-ready documents to MongoDB. It can run against live Wookieepedia data or against checked-in local fixtures for offline development and regression testing.

## Running

```bash
npm run fetch -- --help
```

## Other StarWarsTL repositories

- [Client](https://github.com/tomasz13nocon/starwarstl-client)
- [Server](https://github.com/tomasz13nocon/starwarstl-server)

---

## Development

Steps to update wtf_wikipedia:

- make changes
- npm run build
- update version in package.json
- in this repo: npm update (locally _and_ on the server)

After updating native rust code: `npm run build`

For development of rust code: `npm run watch`
