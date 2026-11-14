# Project Rules & Customization (run-tracker)

- **自動 Git Push 與 GitHub Pages 發布規則**：除非使用者有特別交代，每次修改完程式碼並通過驗證後，請**一律自動執行以下兩步驟**：
  1. `git add -A && git commit && git push origin main`（推送原始碼至 `main` 分支）
  2. `npm run deploy`（透過 `npx -y gh-pages -d dist` 將打包後的 `dist` 發布至 `gh-pages` 分支，觸發 GitHub Pages 自動部署更新）。
