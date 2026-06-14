# WorldCup 2026 世盃分析與下注 Discord Bot

一個模擬下注環境的 Discord Bot，自動從香港賽馬會 (HKJC) 同步世界盃賽程與賠率，搭配 DeepSeek AI 提供每日賽事分析。

## 功能

- **賽程查詢** — 查看即將到來的世界盃賽程與即時賠率（主客和 / 讓球 / 總入球 / 波膽）
- **模擬下注** — 支援主客和 (1X2) 與讓球 (Handicap) 玩法，以虛擬貨幣結算
- **AI 分析** — DeepSeek 定時自動分析賽事，產出專業投注建議
- **排行榜** — 依累計盈虧排序，顯示所有用戶排名
- **自動同步** — 定時從 HKJC API 拉取最新賽程與賠率

## 指令

### 一般用戶

| 指令 | 說明 |
|------|------|
| `/login <username> <password>` | 登入或註冊帳號 |
| `/match` | 查看即將到來的賽程與賠率 |
| `/bet place` | 對比賽進行下注（先選比賽 > 選玩法 > 選預測 > 輸入金額） |
| `/bet history [page]` | 查詢個人下注紀錄 |
| `/stat` | 查詢個人下注統計與累計盈虧 |
| `/rank` | 查看排行榜 Top 10 |
| `/help` | 顯示指令說明 |

### 管理員

| 指令 | 說明 |
|------|------|
| `/fetch` | 從 HKJC 同步賽程與賠率至資料庫 |
| `/analyst` | 對即將到來的比賽執行 DeepSeek AI 分析 |
| `/admin add <username> <password>` | 新增用戶 |
| `/admin list` | 列出所有用戶 |
| `/admin activate <username>` | 啟用用戶 |
| `/admin deactivate <username>` | 停用用戶 |
| `/admin resetpw <username> <new_password>` | 重設密碼 |
| `/admin delete <username>` | 刪除用戶及下注紀錄 |

## 下注流程

```
/bet place match:<選比賽> type:<選玩法> prediction:<選預測> amount:<金額>

玩法類型：
  • 主客和 — 主隊勝 / 平手 / 客隊勝
  • 讓球   — 依 HKJC 讓球盤口顯示主/客隊讓球數與賠率
```

## 技術棧

| 項目 |  |
|------|--|
| Runtime | Node.js (TypeScript) |
| Bot Framework | Discord.js v14 |
| 資料庫 | SQLite (Prisma ORM) |
| 賠率來源 | HKJC API (`hkjc-api`) |
| AI 分析 | DeepSeek API (`deepseek-chat`) |
| 排程 | node-cron |

## 快速開始

```bash
# 安裝相依套件
npm install

# 初始化資料庫
npx prisma generate

# 編譯 TypeScript
npm run build

# 啟動
npm start
```

環境變數請參考 `.env.example`（需自行設定 `DISCORD_TOKEN`、`DEEPSEEK_API_KEY` 等）。
