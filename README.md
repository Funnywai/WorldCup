# WorldCup 2026 世盃分析與下注 Discord Bot

一個模擬下注環境的 Discord Bot，自動從香港賽馬會 (HKJC) 同步世界盃賽程與賠率，搭配 DeepSeek AI 提供每日賽事分析，支援自動結算。

## 功能

- **賽程查詢** — 查看即將到來的世界盃賽程與即時賠率（7 種玩法），支援 🔄 一鍵重新整理
- **模擬下注** — 支援主客和 (HAD)、讓球 (HDC)、讓球主客和 (HHA)、入球大細 (HIL)、角球讓球 (CHD)、角球大細 (CHL) 共 6 種玩法
- **自動結算** — `/score` 標記過期比賽為 finished 後自動判定 pending bets 輸贏，更新用戶盈虧
- **AI 分析** — DeepSeek 定時自動分析賽事，產出專業投注建議
- **排行榜** — 依累計盈虧排序，顯示所有用戶排名
- **自動同步** — 背景每 15 分鐘從 HKJC API 拉取最新賠率，無需手動操作
- **即時賽事** — 已開踢的比賽持續顯示於賽程與下注清單，賠率隨比賽進程更新

## 指令

### 一般用戶

| 指令 | 說明 |
|------|------|
| `/login <username> <password>` | 登入或註冊帳號 |
| `/match` | 從 HKJC 同步賽程與賠率（含 🔄 重新整理按鈕） |
| `/bet place` | 對比賽下注（先選比賽 → 選玩法 → 選預測 → 輸金額） |
| `/bet other` | 手動輸入賠率下注 |
| `/bet history [page]` | 查詢個人下注紀錄 |
| `/stat` | 查詢個人下注統計與累計盈虧 |
| `/rank` | 查看排行榜 Top 10 |
| `/help` | 顯示指令說明 |

### 管理員

| 指令 | 說明 |
|------|------|
| `/admin add <username> <password>` | 新增用戶 |
| `/admin activate <username>` | 啟用用戶 |
| `/admin deactivate <username>` | 停用用戶 |
| `/admin list` | 列出所有用戶 |
| `/admin resetpw <username> <new_password>` | 重設密碼 |
| `/admin delete <username>` | 刪除用戶及下注紀錄 |
| `/admin bet-place` | 代用戶下注（6 種玩法） |
| `/admin bet-other` | 代用戶手動賠率下注 |
| `/analyst run` | 對明日比賽執行 DeepSeek AI 分析 |
| `/analyst match <match_id>` | 分析指定單場賽事 |
| `/analyst history` | 查詢分析紀錄 |
| `/analyst result <analysis_id> <status>` | 標記分析結果為 won/lost |
| `/match` | 同步賽程與賠率 |
| `/score` | 標記過期比賽為 finished，自動結算 pending bets |
| `/check list` | 查看所有 pending 下注 |
| `/check win <bet_id>` | 手動標記下注獲勝 |
| `/check loss <bet_id>` | 手動標記下注失敗 |

## 下注流程

```
/bet place match:<選比賽> type:<選玩法> prediction:<選預測> amount:<金額>

玩法類型：

  代碼     中文名稱         獲勝判定                           prediction 格式
  ────    ──────────       ────────────                     ──────────────
  HAD     主客和           主隊得分 vs 客隊得分                "home" / "draw" / "away"
  HDC     讓球             主隊得分+讓球 vs 客隊得分            "H|-0.5" / "A|-0.5"
  HHA     讓球主客和        主隊得分+讓球 vs 客隊得分（含和局）    "H|-1.0" / "D|-1.0" / "A|-1.0"
  HIL     入球大細          總進球數 vs 界線                   "H|2.5" (大) / "L|2.5" (細)
  CHD     角球讓球          主隊角球+讓球 vs 客隊角球            "H|-1.5" / "A|-1.5"
  CHL     角球大細          總角球數 vs 界線                   "H|9.5" (大) / "L|9.5" (細)

注意：比賽進行中（live）也可下注
```

## 結算機制

| 方式 | 觸發 | 說明 |
|------|------|------|
| **自動結算** | `/score` | 比賽 > 3 小時仍未 finished → 從 HKJC 取得比數 → 自動比對所有 pending bets → 更新 won/lost + 用戶盈虧 |
| **手動結算** | `/check win/loss` | 管理員逐筆手動標記（備用） |

結算邏輯（`settlement.ts`）：
- HAD → 比對最終比分判定主勝/和/客勝
- HDC/HHA → 套用讓球條件後比對
- HIL/CHL → 總進球/總角球 vs 界線判定大/細
- CHD → 套用角球讓球條件後比對（需角球數據）
- 舊格式下注（不含 condition）自動從 oddsData 反推主力盤口

## 排程

| 任務 | 排程 | 說明 |
|------|------|------|
| 賠率同步 | 每 15 分鐘（`CRON_FETCH`） | 背景自動抓取未來 30 天賽事賠率並更新資料庫 |
| 每日分析 | 每日 18:00（`CRON_TIME`） | DeepSeek AI 分析明日賽事並發送至指定頻道 |

排程時間可透過 `.env` 中的 `CRON_FETCH` 與 `CRON_TIME` 環境變數自訂。

## 技術棧

| 項目 |  |
|------|--|
| Runtime | Node.js (TypeScript) |
| Bot Framework | Discord.js v14 |
| 資料庫 | SQLite (Prisma ORM) |
| 賠率來源 | HKJC API (`hkjc-api`) |
| AI 分析 | DeepSeek API (`deepseek-chat`) |
| 排程 | node-cron |

## HKJC API 參考

詳細 API 資料請見 [`API.md`](API.md)。

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

環境變數請參考 `.env`（需自行設定 `DISCORD_TOKEN`、`DEEPSEEK_API_KEY` 等）。
