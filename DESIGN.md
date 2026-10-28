# Design System

<!-- impeccable:design-system 1 -->

## Direction contract

**THESIS:** 將 Telegram 頻道閱讀體驗重塑為具備 `2md.aiurl.tw` 視覺質感的編輯室閱讀工具；拒絕割裂感、漂浮失焦的側欄與平庸的 AI 模版審美。

**OWN-WORLD:** 溫潤金色畫布（`#fff0cc`）、暖白乳霜卡片（`#fff9e8`）、番紅花黃（`#ffb010`）作為品牌強調與頂部標記、深藍（`#17324d`）作為高對比文字與導航焦點、陶土紅（`#a9471d`）作為日期與微標籤輔助，正文採用深墨色（`#2b251a`）確保高對比度。所有文字對比度均嚴格達到 WCAG AA / AAA 標準。

**STORY:** 使用者先在統一全寬 Header 中辨識產品與頻道身份，首頁提供洗鍊的輸入框與明確步驟指示；進入頻道後沿清晰卡片化的時間線閱覽，側邊欄整合搜尋、近 7 天熱門與隨機探索，移除冗餘的 links 路由。

**FIRST VIEWPORT:** 全寬 Header 橫跨頂部，帶有標誌性番紅花黃頂條與 888 TG 品牌勳章，首頁主要視窗以聚焦的輸入卡片為主，頻道頁則直覺展開頻道簡介與日期卡片，不再有視圖割裂與側邊浮動錯位。

**FORM:** 採內容第一的雙欄佈局（桌面 1140px，主欄 + 300px 側欄），行動版平滑折疊為流暢單欄，所有卡片保持一致的 14px 圓角與深邃光影層次。

## Surface rules

- Mode: Operate + Read
- Palette: `#fff0cc` canvas, `#fff9e8` card surface, `#2b251a` text ink (WCAG AAA 13.9:1), `#ffb010` saffron primary, `#17324d` deep blue accent (WCAG AAA 11.9:1), `#a9471d` clay marker (WCAG AA 5.4:1), `#5e523b` muted text (WCAG AA 6.7:1), `#ddc58b` card border, `#6b5b38` input border.
- Typography: Outfit for brand display headings; system-ui / Noto Sans TC for CJK UI and reading body; Fira Code / JetBrains Mono for handles, code, dates and timestamps.
- Type scale: body 16px (1rem) / 1.68; inputs & buttons 15–16px (44–52px min-height); card titles 18–20px (1.15–1.25rem); hero heading 30–40px (1.85–2.5rem).
- Navigation: full-width site header with saffron accent line, breadcrumbs, random exploration, and language pill; footer houses Home, Tags, RSS, and david888.com credit.
- Responsive: desktop uses unified 2-column grid (`1fr` + `300px`); mobile collapses to single column with touch-friendly 44px minimum targets.
- Accessibility: fully verified WCAG AA / AAA contrast across all light surfaces and controls.
