# Changelog

## 2026-09-04

### Changed

- 重做共用閱讀模板：中文使用較大的 `jf open 粉圓` 字級與行高，英文／數字／username／URL／程式碼使用 JetBrains Mono。
- 文章改為獨立 surface，增加文章間距、邊框、日期區段與閱讀層級，避免相鄰文章黏在一起。
- 將 Home、Tags、Links 從右側欄移到 footer，並改善桌面、平板與手機版的導覽與觸控尺寸。

### Fixed

- Preserved the `popover` attribute on sanitized image lightboxes so full-size images stay hidden until opened instead of rendering as a full-page overlay.
- Added a regression test covering the lightbox markup sanitization.
- Added Telegram target normalization for `@username`, bare usernames, and `t.me`/`telegram.me`/`telegram.dog` links.
- Added explicit status pages for private links, invite links, unavailable public previews, and Telegram fetch failures instead of redirecting to a blank homepage.
- Added a visible homepage identity and clearer input guidance for ANYCHANNEL deployments.

## 2026-09-03

### Security

- **Remediated Server-Side Open Redirect & SSRF/Open Proxy (`src/pages/static/[...url].js`)**:
  - Enforced strict hostname matching (`hostname === domain || hostname.endsWith('.' + domain)`) against `targetWhitelist`.
  - Blocked loopback and private IP ranges (`127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `169.254.*`, `::1`, `localhost`).
  - Enforced `http:`/`https:` protocols and replaced 302 redirects on non-whitelisted domains with HTTP 403 Forbidden responses.
  - Restricted upstream proxying to safe GET requests with standardized headers.
- **Remediated Stored & DOM Cross-Site Scripting (XSS)**:
  - Created centralized HTML sanitization module in `src/lib/telegram/sanitize.js` using `sanitize-html`.
  - Sanitized `post.content` in `getPost()` and `src/components/item.astro`.
  - Sanitized `channel.descriptionHTML` in `getChannelInfo()` and `src/components/header.astro`.
  - Escaped raw string attributes (`alt`, `title`) in `getImages` and `getLinkPreview` to prevent template string injection breakouts.
- **Fixed Client-Side DOM-Based Open Redirect (`src/pages/index.astro`)**:
  - Sanitized channel search input in `onsubmit` handler to strictly allow alphanumeric identifiers (`/^[a-zA-Z0-9_]+$/`) and stripped leading slashes/backslashes to prevent protocol-relative redirects (`//evil.com`).
- **Fixed Server-Side Open Redirect in Post Fallback (`src/pages/[channel]/posts/[id].astro`)**:
  - Validated `channelName` before calling `Astro.redirect` to prevent backslash path normalization attacks (`/\evil.com/`).
- **Enforced Access Control Policy for `ANYCHANNEL="false"` (`src/middleware.js`)**:
  - Added centralized middleware route guard blocking unauthorized dynamic `[channel]` access when `ANYCHANNEL` is set to `false`.
  - Added security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`).
- **Partitioned Flat-File Database by Channel (`src/lib/db/index.js`)**:
  - Added channel namespacing across `savePost`, `savePosts`, `getDatesWithPosts`, `getDatesByMonth`, `getPostIdsByDate`, and `getAdjacentDates` to prevent cross-channel post record collisions and calendar corruption.
- **Hardened Secrets & Container Privileges**:
  - Untracked `.env3` from git and updated `.gitignore` with wildcard `.env*` coverage while preserving `.env.example`.
  - Configured `Dockerfile` to create and own `/app/data` under unprivileged user `node` (`USER node`).

### Added

- Added GitHub Actions workflow (`.github/workflows/docker.yml`) to automatically build and push multi-architecture Docker images (`linux/amd64`, `linux/arm64`) to Docker Hub and GitHub Packages (GHCR) with Buildx cache and metadata tagging.

## 2026-07-29

### Added

- Added GenJyuu Gothic as the default Chinese font.
- Added JetBrains Mono as the default English and numeric font.
- Added the bundled font assets under `public/fonts/`.

### Changed

- Expanded data and code blocks to use the available content width; horizontal scrolling now appears only when a viewport is genuinely too narrow.
- Grouped timeline entries by day with distinct opening and closing boundaries.
- Refined the reading layout and color system with a wider content column, warm surfaces, and forest-green navigation accents.

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
