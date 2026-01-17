# StarWarsTL: Wookieepedia script

Code used to fetch and transform data from Wookieepedia.

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
