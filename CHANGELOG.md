# Changelog

## 2026-09-11

### Security

- **Cloudflare Turnstile 人機驗證與防爬蟲閘門 (`src/middleware.js`, `src/lib/turnstile.js`, `src/pages/api/turnstile-verify.js`)**：
  - 整合 Cloudflare Turnstile Interstitial Challenge 轉場閘門，保護網站免受惡意爬蟲與自動化程式濫用。
  - 實作後端專屬驗證端點 `/api/turnstile-verify`，強制將 token 送往 Cloudflare 官方 `siteverify` 伺服器驗證，嚴格拒絕前端傳入之任何繞過旗標（Fail-Closed 原則）。
  - 驗證成功後透過 Web Crypto API 採用伺服器密鑰進行 `HMAC-SHA256` 簽章，發放綁定 User-Agent 與時間戳記的 `tg_turnstile_pass` HttpOnly Cookie（有效期 24 小時）。
  - 自動白名單放行 `robots.txt`、`sitemap.xml`、`rss.xml`、`llms.txt`、`/mcp` 及靜態資源。

### Added

- **標準 MCP 伺服器端點 (`src/pages/mcp.js`)**：
  - 新增標準 `/mcp` (JSON-RPC 2.0) HTTP 端點，支援 `tools/list`、`initialize`、`ping` 等協定呼叫。
  - 解決瀏覽器 MCP 擴充套件（如 `[webmcp-interceptor]`）探測 `/mcp` 收到 404 HTML 時解析報錯的問題，讓 AI Client 與擴充套件能透過 HTTP 探索並呼叫網站工具。

### Fixed

- **WebMCP 重複註冊問題修復 (`src/scripts/webmcp.js`)**：
  - 修復在宣告式表單（`toolname="search-articles"`）已於 DOM 註冊後，`initWebMcp()` 再次呼叫 `context.registerTool()` 拋出 `InvalidStateError: Duplicate tool name` 的問題。
  - 增加 `window.__webmcp_initialized` 冪等鎖防止 SPA 轉場重複執行，並針對已註冊工具進行靜默略過處理。

## 2026-09-10

### Changed

- **推薦池與黃金席位規則 (`src/lib/recommendations/index.js`, `src/pages/index.astro`)**：
  - 將核心頻道 `oliservice` 永久鎖定於熱門頻道推薦榜首第 1 名黃金席位。
  - 首頁頻道搜尋框若為空送出，預設自動導向至 `oliservice`。
  - 修復每日午夜跨日統計邊界，採用半開區間（Half-Open Intervals）計算時段，確保計數精準無間斷。
  - 動態擴充隨機頻道推薦池，提升冷門與精選內容曝光率。

## 2026-09-08

### Added

- **WebMCP 瀏覽器 AI Agent 工具支援 (`src/scripts/webmcp.js`, `public/llms.txt`, `public/docs/agent-guide.md`)**：
  - 依據 Chrome / W3C WebMCP 規範實作瀏覽器端結構化工具集：`navigate-channel`、`search-articles`、`get-random-channel`、`navigate-random-channel`、`switch-language`、`get-current-channel-info`、`filter-by-date`、`add-channel-recommendation`。
  - 向 `document.modelContext` / `navigator.modelContext` 註冊工具，並掛載全域 `window.__webmcp` 提供偵錯與檢索。
  - 聲明技術提供者為 `david888.com`，更新 `llms.txt` 與相關 Agent 引導文件。
- **隨機頻道探索與即時推薦池 (`src/lib/recommendations/index.js`, `src/pages/random.js`)**：
  - 整合 `tgnav` 推薦來源與離線持久化快取，增加即時隨機探索 Shuffle 小工具。
  - 狀態頁與錯誤頁面直接嵌入頻道輸入框，簡化重新輸入流程。

### Fixed

- 移除瀏覽計數 1000 上限限制，恢復累加遞增計數邏輯，並統一 Docker Volume 掛載路徑。
- 修正 Favicon 版本號，補上 shortcut icon 標籤與 `must-revalidate` 標頭以避免快取問題。

## 2026-09-07

### Added

- **介面多國語言切換（繁體中文 / EN）**：
  - 頂部 Header 加入語言切換膠囊按鈕（`zh-Hant` / `en`）。
  - 自動偵測瀏覽器語系偏好，並透過 LocalStorage 記憶使用者設定。
  - 切換語系時即時動態更新 Header 品牌標題、麵包屑與 Document Title。
- **階層式麵包屑導航與側邊欄改版**：
  - 於指定頻道站點加入清晰的麵包屑層級導航。
  - 將熱門頻道排行榜移至側邊欄，依照瀏覽量由高至低嚴格排序。

## 2026-09-04

### Changed

- 重做共用閱讀模板：中文使用較大的 `jf open 粉圓` 字級與行高，英文／數字／username／URL／程式碼使用 JetBrains Mono。
- 文章改為獨立 surface，增加文章間距、邊框、日期區段與閱讀層級，避免相鄰文章黏在一起。
- 將 Home、Tags、Links 從右側欄移到 footer，並改善桌面、平板與手機版的導覽與觸控尺寸。
- 品牌統一為「888 Telegram 頻道瀏覽器」，footer 加入「技術提供 david888.com」與繁體中文／English 介面切換。
- 首頁新增近七天公開頻道使用紀錄 Top 10；只儲存頻道識別資料與匿名使用次數，逾七天自動清除。
- 新增根目錄 `/llms.txt` 與 HTTP discovery Link，提供 AI agent 了解網站入口與公開內容限制。

### Fixed

- 修正共用 SEO metadata：所有 canonical／OG／Twitter URL 改用 HTTPS，OG 圖改為 1200×630 並補齊尺寸、alt、site name、JSON-LD、favicon、Apple touch icon 與 Web App Manifest。
- 頻道列表補上唯一 H1，並以固定品牌 OG 圖避免 Telegram 160×160 avatar 造成社群分享預覽失敗。
- 為新品牌圖示與 OG 資產加入版本化 URL，避免 CDN 將部署前的 fallback HTML 快取誤套用到新檔案。
- 修正 Docker volume 由 root 建立後造成的快取寫入權限；entrypoint 會先將 `/app/data` 交給 `node`，再以非 root 身分啟動服務。
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
