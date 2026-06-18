# WorldCup 2026 世盃分析與下注 Discord Bot

一個模擬下注環境的 Discord Bot，自動從香港賽馬會 (HKJC) 同步世界盃賽程與賠率，搭配 DeepSeek AI 提供每日賽事分析，由管理員手動結算。

## 功能

- **賽程查詢** — 查看即將到來的世界盃賽程與即時賠率（6 種玩法）
- **模擬下注** — 支援主客和 (HAD)、讓球 (HDC)、讓球主客和 (HHA)、入球大細 (HIL)、角球讓球 (CHD)、角球大細 (CHL) 共 6 種玩法
- **管理員結算** — `/check win/loss` 手動判定 pending bets 輸贏，更新用戶盈虧；`/check stop` 支援部分退款
- **盈虧修正** — `/fix profit` 從所有下注重新計算每位用戶的盈虧統計
- **AI 分析** — DeepSeek 定時自動分析賽事，產出專業投注建議
- **排行榜** — 依累計盈虧排序，顯示所有用戶排名
- **自動同步** — 背景每 5 分鐘從 HKJC API 拉取最新賠率，無需手動操作
- **過期處理** — Cron 自動標記開踢超過 3 小時的比賽為 finished 並嘗試取得最終比數

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
| `/admin bet-place` | 代用戶下注（6 種玩法，可選自訂賠率） |
| `/admin bet-other` | 代用戶手動賠率下注 |
| `/analyst run` | 對明日比賽執行 DeepSeek AI 分析 |
| `/analyst match <match_id>` | 分析指定單場賽事 |
| `/match` | 同步賽程與賠率 |
| `/check list` | 查看所有 pending 下注 |
| `/check win <bet_id>` | 手動標記下注獲勝 |
| `/check loss <bet_id>` | 手動標記下注失敗 |
| `/check stop <bet_id> <refund>` | 標記下注失敗並記錄部分退款金額 |
| `/fix profit` | 從所有下注重新計算每位用戶的盈虧統計 |

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

注意：管理員下注不受比賽狀態限制；一般用戶只能對未開賽比賽下注
```

## 結算機制

| 方式 | 說明 |
|------|------|
| **手動結算** | 管理員透過 `/check win/loss` 逐筆標記 pending bets 為 won/lost，系統自動更新用戶盈虧 |
| **部分退款** | `/check stop <bet_id> <refund>` 將下注標記為 lost，同時記錄退款金額 |
| **盈虧修正** | `/fix profit` 從 Bet 資料表重新計算所有用戶的 totalBets / won / lost / profit |

結算邏輯（`settlement.ts`）：
- HAD → 比對最終比分判定主勝/和/客勝
- HDC/HHA → 套用讓球條件後比對
- HIL/CHL → 總進球/總角球 vs 界線判定大/細
- CHD → 套用角球讓球條件後比對（需角球數據）
- 舊格式下注（不含 condition）自動從 oddsData 反推主力盤口

## 排程

| 任務 | 排程 | 說明 |
|------|------|------|
| 賠率同步 | 每 5 分鐘（`CRON_FETCH`） | 背景自動抓取未來 30 天賽事賠率並更新資料庫 |
| 每日分析 | 每日 18:00（`CRON_TIME`） | DeepSeek AI 分析明日賽事並發送至指定頻道 |
| 過期比賽處理 | 每 5 分鐘 | 自動標記開踢超過 3 小時的比賽為 finished（不自動結算下注） |

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
