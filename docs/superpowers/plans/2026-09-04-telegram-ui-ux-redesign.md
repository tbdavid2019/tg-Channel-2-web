# Telegram Reader UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重做 Telegram 頻道閱讀器的共用模板，保留米白＋深綠品牌感，讓中文優先的大字閱讀、清楚的文章分隔、首頁輸入與不支援狀態在桌面和手機都一致可用。

**Architecture:** 延續 Astro 元件與既有 CSS，不引入 UI framework。共用外框在 `base.astro` 管 footer 與頁面骨架；`style.css` 管 tokens、版型、導覽與日期分組；`item.css` 管 Telegram 文章內容與媒體；首頁、header、狀態元件只保留語意 markup 與局部互動。

**Tech Stack:** Astro 5, native CSS, existing WOFF2 assets, Node test runner, pnpm build.

---

## Task 1: Lock typography and global layout tokens

**Files:**
- Modify: `src/assets/style.css:1-220`
- Modify: `src/assets/global.css:1-140`
- Modify: `src/layouts/base.astro:55-150`
- Modify: `README.md:10-20, 88-96`

- [ ] **Step 1: Define the CJK-first typography contract before editing selectors**

Use these roles in `src/assets/style.css`:

```css
:root {
  --font-cjk: 'JustFont 粉圓', 'jf open 粉圓', 'GenJyuu Gothic',
    'PingFang TC', 'Noto Sans CJK TC', sans-serif;
  --font-mono: 'JetBrains Mono', 'JetBrainsMono', ui-monospace, monospace;
  --font-ui: var(--font-cjk);
  --text-body: 1.125rem;
  --text-meta: 0.9375rem;
  --text-control: 1.0625rem;
  --leading-body: 1.8;
}
```

Keep the existing local `GenJyuuGothic-Medium.woff2` as the CJK fallback and local JetBrains asset for Latin/code. Do not add an unlicensed JustFont binary; the browser will use an installed or externally authorized JustFont webfont when available.

- [ ] **Step 2: Replace compact Latin-sized defaults with explicit CJK-safe sizes**

Set `body` to `font-family: var(--font-ui)`, `font-size: var(--text-body)`, and `line-height: var(--leading-body)`. Use `font-family: var(--font-mono)` on `.handle`, `code`, `pre`, URL/username spans, and other technical strings. Make metadata at least `var(--text-meta)` and controls at least `var(--text-control)`; remove user-facing `0.75em`, `0.78rem`, `0.8em`, and `12px` styles where they shrink Chinese copy.

- [ ] **Step 3: Rebuild the outer container and header sizing**

Use a centered max-width layout with a readable main measure:

```css
#container {
  max-width: 1380px;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: clamp(24px, 4vw, 64px);
}

#main-container {
  max-width: 900px;
}

#header {
  min-height: 72px;
  padding: 14px clamp(16px, 3vw, 32px);
}
```

Keep focus-visible outlines, safe-area padding, and existing color tokens. Add `viewport-fit=cover` to the base viewport meta tag.

- [ ] **Step 4: Run the existing tests and build after token-only changes**

Run: `node --test test/*.test.js && pnpm run build`

Expected: all existing tests pass and Astro exits with code 0. Any existing browser mapping warning is recorded but is not treated as a UI failure.

## Task 2: Move navigation into a real footer

**Files:**
- Modify: `src/layouts/base.astro:92-145`
- Modify: `src/assets/global.css:1-140`
- Modify: `src/assets/style.css:250-345`

- [ ] **Step 1: Add a semantic footer slot to the layout**

Render one footer after `#container`, with three groups: `nav` links for Home, Tags, Links; optional social/RSS links; and a small site identity line. Keep all hrefs generated from the existing `SITE_URL`, `tags`, and `links` values so no route behavior changes.

- [ ] **Step 2: Remove Home, Tags, and Links from the aside navigation**

The aside keeps only the site search and an optional utility block for channel context. Delete the existing `.nav-sidebar` rendering for Home, Tags, Links and the emoji-based “Switch Channel” link. Add a text button/link near the search form for `ANYCHANNEL` channel switching when applicable.

- [ ] **Step 3: Style footer and mobile order**

Use a top border, three-column desktop grid, and one-column mobile stack. Footer links must have 44px minimum line box on coarse pointers, visible focus, and `padding-bottom: max(24px, env(safe-area-inset-bottom))`.

- [ ] **Step 4: Verify the navigation source shape**

Run: `rg -n "Home|Tags|Links|site-footer|nav-sidebar" src/layouts/base.astro src/assets/*.css`

Expected: Home/Tags/Links are rendered by the footer, not by the desktop aside; no old selector hides the footer on mobile.

## Task 3: Redesign homepage input and status presentation

**Files:**
- Modify: `src/pages/index.astro:1-130`
- Modify: `src/components/channel-state.astro:1-120`
- Modify: `src/assets/style.css:345-470`

- [ ] **Step 1: Preserve the existing normalization behavior**

Keep `normalizeTelegramTarget` and the existing client-side submit flow unchanged in meaning. The form must still accept `@username`, bare usernames, and supported public Telegram URLs; invite/private/invalid messages remain inline.

- [ ] **Step 2: Replace the small card with a clear first-viewport task block**

Use semantic structure:

```astro
<section class="reader-hero" aria-labelledby="reader-title">
  <p class="eyebrow">公開 Telegram 閱讀器</p>
  <h1 id="reader-title">把頻道內容，讀成清楚的時間線</h1>
  <p class="reader-lede">輸入公開頻道的 username 或連結，直接查看貼文、圖片與日期分組。</p>
  <form class="channel-form">...</form>
  <p class="reader-note">公開頻道可顯示；私人、邀請連結與沒有公開預覽的群組會顯示支援狀態。</p>
</section>
```

Keep the existing factual capability wording and do not add fabricated recommendations or metrics.

- [ ] **Step 3: Make status pages feel intentional and actionable**

Give `channel-state` a clear status eyebrow, large CJK heading, body copy at 18px/1.8, and two 44px actions: safe Telegram external link where available and “重新輸入”. Keep the per-error copy and `aria-live` behavior.

- [ ] **Step 4: Verify the homepage and state routes compile**

Run: `pnpm run build`

Expected: the build includes `/` and `[channel]` output with no Astro errors.

## Task 4: Make channel identity and article boundaries obvious

**Files:**
- Modify: `src/components/header.astro:1-180`
- Modify: `src/components/list.astro:1-180`
- Modify: `src/components/item.astro:1-100`
- Modify: `src/assets/style.css:345-610`
- Modify: `src/assets/item.css:1-340`

- [ ] **Step 1: Add channel identity hierarchy without changing data**

Keep avatar/title/description/social links from the existing props, but render the channel header as a contained identity band with title, optional description, and a visible Telegram handle/external action when the handle exists. Preserve the existing `staticProxy` and sanitized description paths.

- [ ] **Step 2: Give every article a distinct readable surface**

Wrap each `Item` in the existing `.item` boundary and style it with:

```css
.item {
  position: relative;
  padding: 28px clamp(18px, 3vw, 32px) 32px;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: var(--box-border-radius);
  box-shadow: 0 1px 2px rgba(24, 35, 30, 0.04);
}

.item + .item {
  margin-top: 20px;
}

.day-group-items {
  display: grid;
  gap: 20px;
}
```

Use a stronger border and generous vertical gap between articles so adjacent text/media cannot visually merge. Retain the date group border and make its marker a separate heading above the article stack.

- [ ] **Step 3: Increase article content typography**

Set `.text-box` to 18px/1.8, `.title-box` to `clamp(1.5rem, 3vw, 2rem)` with line-height 1.35, `.time-box` and `.tag-box` to 15–16px, and remove the old left-border-only layout as the sole article separator. Media keeps responsive max-width, rounded corners, and lightbox behavior.

- [ ] **Step 4: Replace emoji-only pagination labels**

Keep the same URLs but use text labels `更早的文章`, `依日期瀏覽`, and `更新文章`; use CSS pseudo-elements or existing asset icons only as decoration. Ensure each link has at least 44px height.

- [ ] **Step 5: Run content regression tests and build**

Run: `node --test test/*.test.js && pnpm run build`

Expected: sanitizer/normalizer tests pass and the production build exits 0.

## Task 5: Tune calendar, archive/tag pages, and responsive behavior

**Files:**
- Modify: `src/components/calendar.astro:110-220`
- Modify: `src/assets/style.css:630-1085`
- Modify: `src/assets/global.css:80-140`

- [ ] **Step 1: Bring calendar and archive text to the CJK scale**

Use 16px minimum weekday/day text, 18px calendar title, 15–16px archive/tag metadata, and 44px minimum calendar tap areas. Keep current date links and database-driven post indicators.

- [ ] **Step 2: Make breakpoints structural, not merely smaller**

At widths below 1024px, collapse the utility rail below the main content; below 640px, use one-column header, full-width form controls, no fixed margins, and footer navigation in reading order. Keep `overflow-x: clip` only on the page shell if it does not hide focus rings; fix overflow at the content source first.

- [ ] **Step 3: Add reduced-motion and coarse-pointer rules**

Use `@media (prefers-reduced-motion: reduce)` to disable transforms/transitions that are not needed for comprehension. Use `@media (pointer: coarse)` to increase controls and link hit areas without changing content order.

- [ ] **Step 4: Check representative viewport source constraints**

Run: `rg -n "font-size: (10|12|14)px|font-size: 0\.[0-9]+em|height: 100vh|width: [0-9]+px" src/assets src/components src/pages`

Expected: any remaining small value is limited to icon/technical decoration and not Chinese body, metadata, form labels, or actions.

## Task 6: Documentation, detector, visual verification, and release

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `DESIGN.md` if settled tokens differ from the recorded direction

- [ ] **Step 1: Add the user-visible change to the changelog**

Under the current date, document the CJK-first JustFont/JetBrains roles, larger reading scale, clear article separation, footer navigation, responsive layout, and improved unsupported states. State that JustFont is used only when an authorized webfont is available and local fallback remains.

- [ ] **Step 2: Run all mechanical verification**

Run:

```bash
git diff --check
node --test test/*.test.js
pnpm run build
node /Users/david/.agents/skills/impeccable/scripts/detect.mjs --json src/assets/global.css src/assets/style.css src/assets/item.css src/layouts/base.astro src/components/header.astro src/components/list.astro src/components/item.astro src/components/channel-state.astro src/pages/index.astro
```

Expected: no whitespace errors, all tests pass, build exits 0, and detector findings are either fixed or documented as intentional baseline exceptions.

- [ ] **Step 3: Run live local smoke checks at desktop and mobile widths**

Start: `pnpm run dev -- --host 127.0.0.1`

Check `/`, `/daybuy/`, `/pythonzh/`, and one image-heavy channel at 1440px, 900px, 768px, 390px, and 320px. Confirm no horizontal overflow, the footer is reachable, article boundaries are obvious, Chinese copy is not compact, and the image lightbox still opens.

- [ ] **Step 4: Review git diff and commit the implementation**

Run: `git status --short && git diff --stat`

Then commit with: `git commit -am "feat: redesign Telegram reader UI"` after confirming only the planned UI, docs, and changelog files are included.

- [ ] **Step 5: Push and verify CI/CD**

Run: `git push origin master`

Confirm the GitHub Actions build succeeds, then verify the 10.9.0.9 Watchtower deployment updates the container and live routes return the new footer, typography, and article separation.
