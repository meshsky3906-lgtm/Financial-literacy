# G 風格(Amber Luxe 琥珀金科技奢華)

這是 FinFlow 智富記帳改版為 C 風格之前的**原始外觀**,原樣留存,不做介面切換。

## 風格特徵
- 深海藍黑底色 + 琥珀金強調色
- 玻璃擬物面板(半透明 + 模糊)、微粒紋理
- 字體:Outfit + Noto Sans TC

## 內容
- `main.css`:G 風格的設計變數與基礎樣式
- `components.css`:G 風格的元件樣式

## 如何還原成 G 風格

方法一(最簡單):在專案根目錄還原到標記點

    git checkout style-g -- css/main.css css/components.css index.html manifest.json

方法二:手動複製

1. 將 `css/themes/g/main.css`、`css/themes/g/components.css` 複製覆蓋到 `css/` 底下同名檔案。
2. 將 `index.html` 內 `<meta name="theme-color">` 改回 `#0B0F17`,
   `apple-mobile-web-app-status-bar-style` 改回 `black-translucent`,
   並把兩個 CSS 連結後面的 `?v=...` 改一個新值,避免手機快取舊檔。
3. 將 `manifest.json` 的 `background_color`、`theme_color` 改回 `#0B0F17`。

財務邏輯與資料(localStorage)完全不受外觀影響。
