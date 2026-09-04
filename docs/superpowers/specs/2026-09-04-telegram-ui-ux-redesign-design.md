# Telegram 頻道閱讀器 UI/UX 改版設計規格

## 目標

在不破壞既有 Telegram 內容抓取、日期導覽、搜尋、標籤、RSS 與狀態判斷的前提下，重做共用模板 UI，讓網站在桌面和手機都能快速完成「輸入 → 辨識 → 閱讀 → 導覽」。

## 已確認的方向

- 保留米白＋深綠品牌感。
- 拉丁字元、數字與介面字體優先使用 JetBrains Mono；中文使用 JustFont 粉圓體，若字型檔未提供則退回現有中文字體與系統 fallback。
- Home、Tags、Links 從右側欄移到 footer；右側不再承擔主要導覽。
- 風格為編輯部／閱讀室：內容優先、低干擾、清楚的操作層級。

## 版型

### 共用外框

- 使用固定最大寬度、寬鬆但一致的間距 token。
- header 保留品牌 avatar、頻道名稱、RSS／社群操作，但縮小視覺重量，避免遮蓋內容。
- main 內容保持可讀行長；desktop 可有 utility rail，mobile 改為單欄。
- footer 收納 Home、Tags、Links 和必要的 RSS／外部連結，使用清楚的分組與 focus 狀態。

### 首頁（ANYCHANNEL）

- 第一屏清楚表達「這是 Telegram 公開頻道瀏覽器」。
- 主要操作只有一個搜尋／頻道輸入表單，支援 `@username`、裸 username 和公開 t.me URL。
- 顯示格式範例與「公開頻道可讀、私有／邀請連結受 Telegram 限制」的短提示。
- 空輸入、非法格式、邀請連結與私人連結在表單附近顯示可理解的錯誤，不使用 alert。
- 提供最近使用或推薦資料前，必須有真實資料來源；本次不捏造推薦頻道。

### 頻道閱讀頁

- 頻道身份區優先於內容：avatar、名稱、handle、描述和安全的 Telegram 外連集中顯示。
- 貼文以日期分組，日期標記是穩定的掃讀錨點；貼文時間、內容、媒體、標籤與留言保持既有功能。
- 更早／更新／依日期瀏覽改為一致的分頁控制，避免 emoji 作為唯一語意。
- 圖片 lightbox、code block、link preview 和 Telegram 內容樣式延續既有行為，但重新對齊色彩、圓角與間距。

### 不支援與錯誤狀態

- `invite`：說明需要先加入或在 Telegram 開啟，提供安全外連。
- `private`：說明私人內容無法由公開網頁預覽讀取。
- `no_public_preview`：說明該 username 沒有可供本網站讀取的公開訊息歷史。
- `fetch_failed` / `empty_response`：說明暫時讀取失敗，提供重新輸入或重試路徑。
- `invalid`：保留輸入欄位上下文，指出接受的格式。

## 視覺與互動

- 背景使用米白，surface 使用偏白，深綠只作主要操作、連結和目前狀態；錯誤色只作語意提示。
- 使用單一柔和圓角尺度和同色系低強度陰影，避免每個元件各自有不同形狀。
- 所有按鈕需有 hover、focus-visible、active；表單需有 invalid 和 disabled／loading 的可見狀態。
- `prefers-reduced-motion: reduce` 時移除非必要位移與淡入。
- 不以 emoji 作為導覽或操作唯一圖示，優先使用既有 SVG 資產或文字標籤。

## 技術範圍

- 主要修改 `src/assets/global.css`、`src/assets/style.css`、`src/assets/item.css`、`src/layouts/base.astro`、`src/components/header.astro`、`src/components/list.astro`、`src/pages/index.astro` 與相關狀態元件。
- 不引入 UI framework 或新的 icon 套件。
- 以現有 Astro 結構與 CSS 為主，避免為視覺改版改動 Telegram 抓取協定。
- 驗證包含單元測試、`pnpm run build`、responsive 瀏覽器檢查與 Impeccable detector。

## 驗收條件

1. 桌面版右側不再顯示 Home、Tags、Links 主導覽，三者可在 footer 找到。
2. 手機版沒有橫向溢出，搜尋表單和主要按鈕可正常觸控與鍵盤操作。
3. 首頁第一屏能看懂用途並完成頻道輸入；不支援輸入會在表單附近給出原因。
4. 頻道頁仍可閱讀文字、圖片、link preview、標籤、日期分組與前後頁。
5. invite、private、no-public-preview、fetch failure 等狀態不會顯示空白頁。
6. JetBrains Mono 或 JustFont 粉圓體載入失敗時，中文與拉丁字元仍有合理 fallback。
7. 現有測試與 production build 通過，且不新增 baseline lint 問題。
