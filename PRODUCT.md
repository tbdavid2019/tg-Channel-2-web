# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

主要使用者是閱讀中文 Telegram 頻道內容的人，會在桌面或手機瀏覽器輸入公開頻道 username 或 t.me 連結，快速查看貼文與依日期瀏覽。此描述依現有頁面文案、路由與資料來源推定。

## Product Purpose

把 Telegram 公開頻道的網頁預覽整理成較容易閱讀、搜尋和依日期回看的時間線。成功條件是使用者能快速輸入目標、辨識目前頻道，並在支援限制時得到清楚的下一步。

## Positioning

產品的核心機制是讀取 Telegram 公開網頁預覽並轉成可導覽的頻道閱讀頁；它不取代 Telegram 登入，也不承諾讀取需要加入群組或授權的內容。

## Operating Context

使用者可能從 GitHub 清單、搜尋結果或直接分享的 t.me 連結進入。網站需要支援常見的 `@username`、裸 username 與公開 t.me URL，並在桌面與行動版保持可用。

## Capabilities and Constraints

- Astro 靜態／伺服器渲染頁面，內容由 Telegram 公開網頁資料整理而來。
- 公開頻道通常可顯示；私有連結、邀請連結、沒有公開訊息預覽的群組，以及機器人不是本閱讀器的訊息流，必須明確呈現限制。
- 目前已有頻道、日期、前後頁、搜尋、標籤、RSS 與社群連結等功能；此次改版不得破壞這些路由與內容功能。
- 站點由 Docker 與 CI/CD 部署，UI 改動需通過測試與 production build。

## Brand Commitments

- 既有米白＋深綠品牌感予以保留。
- 中文閱讀是主要情境，正文與所有中文介面文字優先使用 JustFont 粉圓體；JetBrains Mono 只用於英文、數字、username、URL、程式碼與技術資訊。若 JustFont 字型檔未提供則退回現有中文字體與系統 fallback。
- 介面語言以繁體中文為主，Telegram username、URL、程式碼等維持原文。

## Evidence on Hand

- 現有 Astro 版型、Telegram 頻道頁、列表、日期導覽、搜尋與狀態頁。
- `https://github.com/EdmenGU/telegram-groups` 提供可用來驗證公開頻道、群組與邀請連結狀態的真實清單。
- 現有 `public/fonts/jf-openhuninn-2.1.ttf`、`public/fonts/JetBrainsMono-Medium.woff2` 與 `public/fonts/GenJyuuGothic-Medium.woff2`；`public/fonts/OFL-1.1.txt` 記錄 `jf open 粉圓` 的開源授權。

## Product Principles

- 先讓使用者知道目前在哪個頻道，再讓內容展開。
- 輸入、閱讀、導覽三個任務都要有清楚的下一步。
- 不能顯示的內容要說明原因，不用空白頁或模糊錯誤掩蓋限制。
- 保留 Telegram 原始內容的連結與語意，不捏造資料。

## Accessibility & Inclusion

所有主要操作需支援鍵盤 focus、可讀的表單 label、足夠的色彩對比與行動版觸控尺寸；載入、空白、錯誤與不支援狀態都要有文字說明。
