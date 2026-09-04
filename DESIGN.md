# Design System

<!-- impeccable:design-system 1 -->

## Direction contract

**THESIS:** 把 Telegram 頻道瀏覽做成一個安靜、可掃讀的編輯部工具；拒絕漂浮的側欄、空白的錯誤頁和沒有優先級的模板裝飾。

**OWN-WORLD:** 米白紙張底、深綠導覽與動作、低對比綠灰分隔，搭配 JetBrains Mono 的資料感字形與 JustFont 粉圓體中文。元件採單一柔和圓角尺度，陰影只用來表示真正的層級。

**STORY:** 使用者先輸入頻道，再辨識頻道身份，接著沿日期分組時間線閱讀；若 Telegram 不提供公開預覽，頁面要直接解釋限制並提供回到輸入或在 Telegram 開啟的行動。

**FIRST VIEWPORT:** 首頁第一屏以左對齊的品牌說明和大尺寸搜尋表單為主，旁邊只保留簡短支援提示；頻道頁第一屏先顯示頻道身份，再進入日期分組內容。Home、Tags、Links 從側欄移至 footer，讓主要欄位保持完整寬度。

**FORM:** 編輯部／閱讀室方向，採用內容優先的雙欄桌面佈局與單欄手機佈局；主要輸入框和公開頻道內容是視覺焦點，互動狀態採低干擾、可辨識的轉場。

## Surface rules

- Mode: Operate + Read
- Palette: `#f3f0e7` background, `#fffdf8` surface, `#18231e` foreground, `#176754` accent, `#e9eee7` muted surface.
- Typography: JetBrains Mono for Latin, numbers, labels and interface chrome; JustFont 粉圓體 for CJK glyphs, with GenJyuu Gothic and system fallbacks when the font asset is unavailable.
- Navigation: search and current-channel context stay near the task; Home, Tags and Links live in the footer.
- Responsive: desktop uses a readable main column and a compact utility rail; mobile collapses to one column with no horizontal overflow.
- States: loading, empty, unsupported, invalid and fetch failure each have a visible label, explanation and safe next action.
- Motion: short opacity/translate transitions only; respect `prefers-reduced-motion`.
