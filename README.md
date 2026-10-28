# Front-end Glossary

牧村摺紙（[origami.abstreamace.com](https://origami.abstreamace.com/)）的摺紙詞彙表 WordPress 外掛。詞彙在前端比對與標記，以盡量避免和其它外掛（例如 TranslatePress）衝突。

- 文章中每個詞彙第一次出現的地方，滑鼠移上去（或點擊）會浮出說明，說明框以 [Popper](https://popper.js.org/) 定位
- `[feglossary]` 短代碼輸出完整的詞彙表
- 後台「Glossary」頁面管理詞彙
- 透過 GitHub Releases 自動更新

浮動說明的 class 為 `.feg-popover`（內含 `__title`、`__body`、`__more`），外掛只附上最基本的樣式，外觀由佈景主題決定。

## 開發

外掛本體就是 `src/`，不需要建置。

```sh
pnpm install
pnpm package    # 打包為 dist/front-end-glossary.zip
```

## 發佈

```sh
pnpm release            # patch，例如 1.0.0 → 1.0.1
pnpm release minor      # 或 major，或直接指定版本號
pnpm release 1.0.0      # 首次發佈：版本號與目前相同時只建立 tag
```

會更新 `package.json` 與外掛標頭的版本號、commit、建立 tag 並推送。GitHub Actions（`.github/workflows/release.yml`）接著會打包並把 `front-end-glossary.zip` 發佈為 Release；網站後台的「更新」頁面就會出現新版本。

更新機制見 [src/inc/class-feg-updater.php](src/inc/class-feg-updater.php)：外掛標頭的 `Update URI` 指向本 repo，WordPress 便會向 GitHub Releases 查詢新版本。
