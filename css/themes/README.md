# 風格代號對照(往後想換風格,只要說代號)

| 代號 | 名稱 | 外觀 | 檔案位置 | 現況 |
|---|---|---|---|---|
| **C** | Calm Paper 紙本淨色 | 暖米色底、深青綠品牌色、平面白卡 | `css/main.css`、`css/components.css`(同 `css/themes/c/`) | **目前使用中** |
| **G** | Amber Luxe 琥珀金 | 深海藍黑底、琥珀金、玻璃擬物 | `css/themes/g/` | 留存 |
| **R** | Pastel Ledger 粉彩帳本 | 冷灰底、鈷藍、淡色標籤 | 只留在 Git 分支 `style/r-pastel`(已試用,不採用) | 已退役 |

## 還原成 C 或 G
把該風格資料夾裡的 `main.css`、`components.css`、`features.css`(G 沒有 features.css,保留現有的即可)複製覆蓋到 `css/` 同名檔案,
再把 `index.html` 內 CSS 連結後的 `?v=` 改成新值(避免手機快取),
並依該風格把 `<meta name="theme-color">` 與 `manifest.json` 的 `theme_color`、`background_color` 改為:

- C:`#F4F1EA`
- G:`#0B0F17`(另將 `apple-mobile-web-app-status-bar-style` 改為 `black-translucent`)

G 風格的完整還原說明見 `css/themes/g/README.md`。財務邏輯與資料(localStorage)完全不受外觀影響。
