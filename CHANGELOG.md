# Changelog

## 2026-07-29

### Added

- Added GenJyuu Gothic as the default Chinese font.
- Added JetBrains Mono as the default English and numeric font.
- Added the bundled font assets under `public/fonts/`.

## 2026-07-07

### Added

- Added `GA_MEASUREMENT_ID` environment variable support to inject Google Analytics 4 `gtag.js`

### Changed

- Configured `stock.david888.com` to use GA4 measurement ID `G-81JETJSWLW`
- Configured `cost.david888.com` to use GA4 measurement ID `G-ZPBDGWPCRS`
- Configured `telegram.david888.com` to use GA4 measurement ID `G-PHXY1REP68`

- Updated the deployment repository remote on `webglsoft.com` from the old `BroadcastChannel.git` location to `https://github.com/tbdavid2019/tg-Channel-2-web`
- Rebuilt and restarted the public deployments:
  - `stock.david888.com` on `broadcastchannel1`
  - `cost.david888.com` on `broadcastchannel2`
  - `telegram.david888.com` on `broadcastchannel3`

### Added

- Added homepage `Link` response headers for agent discovery in [src/middleware.js](/Users/david/Documents/git/tbdavid2019/tg-Channel-2-web/src/middleware.js)
- Added AI crawler rules and `Content-Signal` declarations in [public/robots.txt](/Users/david/Documents/git/tbdavid2019/tg-Channel-2-web/public/robots.txt)
- Added agent documentation at [public/docs/agent-guide.md](/Users/david/Documents/git/tbdavid2019/tg-Channel-2-web/public/docs/agent-guide.md)
- Added Agent Skills discovery index at [public/.well-known/agent-skills/index.json](/Users/david/Documents/git/tbdavid2019/tg-Channel-2-web/public/.well-known/agent-skills/index.json)
- Added skill document at [public/.well-known/agent-skills/broadcastchannel-site/SKILL.md](/Users/david/Documents/git/tbdavid2019/tg-Channel-2-web/public/.well-known/agent-skills/broadcastchannel-site/SKILL.md)

### Not Added

- MCP Server Card was intentionally not published because the site does not currently expose a real MCP transport endpoint
