# 風格代號對照(往後想換風格,只要說代號)

| 代號 | 名稱 | 外觀 | 檔案位置 | 現況 |
|---|---|---|---|---|
| **Fluent 2** | Fluent 2 風格 | 淺灰底、白卡、4px 小圓角、Fluent 藍、細邊框淡陰影 | `css/main.css`、`css/components.css`、`css/features.css`(同 `css/themes/fluent/`) | **目前使用中**(合併後生效) |
| **學院風** | Academia 學院風 | 羊皮紙底、桃花心木深棕、黃銅雙線框、襯線字、小圓角 | `css/themes/academia/`(App 圖示目前仍是學院風版) | 留存 |
| **U2便當盒** | Bento Box Grid | 淺灰底、Apple 藍、大圓角方塊、無邊框柔影 | `css/themes/u2/`(App 圖示見 Git commit 81c8e16 的 `icons/`) | 留存 |
| **C** | Calm Paper 紙本淨色 | 暖米色底、深青綠品牌色、平面白卡 | `css/themes/c/` | 留存 |
| **G** | Amber Luxe 琥珀金 | 深海藍黑底、琥珀金、玻璃擬物 | `css/themes/g/` | 留存 |
| **R** | Pastel Ledger 粉彩帳本 | 冷灰底、鈷藍、淡色標籤 | 只留在 Git 分支 `style/r-pastel`(已試用,不採用) | 已退役 |

## 還原成其他風格
把該風格資料夾裡的 `main.css`、`components.css`、`features.css`(G 沒有 features.css,保留現有的即可)複製覆蓋到 `css/` 同名檔案,
再把 `index.html` 內 CSS 連結後的 `?v=` 改成新值(避免手機快取),
並依該風格把 `<meta name="theme-color">` 與 `manifest.json` 的 `theme_color`、`background_color` 改為:

- Fluent 2:`#F5F5F5`
- 學院風:`#EFE4CB`
- U2便當盒:`#F5F5F7`
- C:`#F4F1EA`
- G:`#0B0F17`(另將 `apple-mobile-web-app-status-bar-style` 改為 `black-translucent`)

G 風格的完整還原說明見 `css/themes/g/README.md`。財務邏輯與資料(localStorage)完全不受外觀影響。

往後風格直接用中文名稱稱呼(例如「學院風風格」「U2便當盒風格」)。

注意:App 圖示(`icons/`)也跟著風格走;換回舊風格時,圖示可從 Git 歷史取回(U2:commit 81c8e16)。
