# Famidoc 醫師專案嚴格隔離與防錯規則 (Strict Project Isolation Rule)

## 📌 專案對應清單 (Project Mapping)

### 1. 📌 Nexus Mark App (跨平台網址書籤 App)
- **本地專案目錄**：`D:\antigravity\url-bookmark-app`
- **GitHub 遠端儲存庫**：`https://github.com/Famidoc/nexus-mark-app.git`
- **技術架構**：React / Vite / Tailwind CSS / Firebase

### 2. 🪴 Plants App (捻花惹草 - 花草圖鑑與知識測驗 PWA)
- **本地專案目錄**：`D:\antigravity\plants`
- **GitHub 遠端儲存庫**：`https://github.com/Famidoc/plants.git`
- **技術架構**：原生 HTML5 / Vanilla JS / PWA Service Worker

---

## ⛔ 鐵律與強制執行規範 (Mandatory Execution Rules)

1. **嚴禁混淆專案與路徑**：
   - 處理「網址書籤 / Nexus Mark」相關需求時，僅能在 `D:\antigravity\url-bookmark-app` 目錄中進行修改，且僅能推送到 `nexus-mark-app.git`。
   - 處理「捻花惹草 / Plants 圖鑑」相關需求時，僅能在 `D:\antigravity\plants` 目錄中進行修改，且僅能推送到 `plants.git`。

2. **命令列磁碟區切換強制防護**：
   - 在 Windows PowerShell 執行任何 `git` 或 `node` 指令時，必須顯式加上 `Set-Location <對應專案目錄>`，並於 commit/push 前強制執行 `git remote -v` 雙重驗證。

3. **零毀壞承諾 (Zero Destruction Guarantee)**：
   - 絕對禁止使用未經確認的 `git push --force` 覆蓋其他儲存庫的分支。
   - 修改前必須先確認當前專案對象，避免發生「改東掛西」的情況。
