# 待重新套用的修改（revert 至 a3519815 後）

## 1. 修正時區設定（原 commit `a6188bd`）

**檔案：** `src/services/dailyAnalysis.ts`

兩處 `cron.schedule()` 加上 `{ timezone: "Asia/Hong_Kong" }`：

```diff
-  cron.schedule(cronTime, async () => {
+  cron.schedule(cronTime, async () => {
     ...
-  })
+  }, { timezone: "Asia/Hong_Kong" })
```

- `startDailyAnalysisCron` 內的 `cron.schedule`（約第 10 行）
- `startMatchFetchCron` 內的 `cron.schedule`（約第 190 行）

---

## 2. User.totalBets 改為即時從 Bet 表統計（原 commit `5c6cae5`）

### 2a. `src/services/auth.ts`

移除 `requireAuth()` 回傳型別的 `totalBets`：

```diff
-  totalBets: number
   totalWon: number
```

### 2b. `src/events/interactionCreate.ts`

**`/admin list` (`handleAdminList`)** — 在原本的 `.map()` 前插入即時統計查詢：

```typescript
const userIds = users.map((u) => u.id)
const betGroup = await prisma.bet.groupBy({
  by: ["userId", "status"],
  where: { userId: { in: userIds } },
  _count: { id: true },
})

const statsMap = new Map<string, { total: number; won: number; lost: number }>()
for (const uid of userIds) {
  statsMap.set(uid, { total: 0, won: 0, lost: 0 })
}
for (const row of betGroup) {
  const s = statsMap.get(row.userId)
  if (!s) continue
  s.total += row._count.id
  if (row.status === "won") s.won += row._count.id
  if (row.status === "lost") s.lost += row._count.id
}
```

然後將 `.map()` 內的 `u.totalBets` → `stats.total`、`u.totalWon` → `stats.won`、`u.totalLost` → `stats.lost`。

**`/stat` (`handleStat`)** — 將原本的 `user.totalBets` / `user.totalWon` / `user.totalLost` 改為即時查詢：

```typescript
const [totalBets, wonBets, lostBets] = await Promise.all([
  prisma.bet.count({ where: { userId: user.id } }),
  prisma.bet.count({ where: { userId: user.id, status: "won" } }),
  prisma.bet.count({ where: { userId: user.id, status: "lost" } }),
])
```

**4 處下注 handler** — 移除 `prisma.$transaction` 中的 `prisma.user.update({ data: { totalBets: { increment: 1 } } })`，只保留 `prisma.bet.create`：
- `handleBetPlace`
- `handleBetOther`
- `handleAdminBetPlace`
- `handleAdminBetOther`

---

## 3. 新增 /score 指令自動結算過期比賽

**新增檔案：** `src/commands/score.ts`

新增 `/score` 指令，管理員可手動清理超過 3 小時的比賽，補上最終比分。

## 4. 新增 /check 指令手動結算待處理下注

**新增檔案：** `src/commands/check.ts`

指令組：
- `/check list` — 列出所有 pending 下注
- `/check win <bet_id>` — 標記獲勝，計算盈虧
- `/check loss <bet_id>` — 標記失敗，扣除本金

## 5. 新增管理員代下注功能 (bet-place/bet-other)

**修改檔案：** `src/commands/admin.ts`、`src/events/interactionCreate.ts`

在 `/admin` 指令組新增兩個子指令：
- `/admin bet-place <username> <match> <type> <prediction> <amount>`
- `/admin bet-other <username> <match> <odds> <amount> [prediction]`

## 6. 改善 /rank 排行榜使用資料庫聚合提升效能

**修改檔案：** `src/events/interactionCreate.ts`

將 `/rank` 的統計方式從迴圈讀取改為 `prisma.bet.groupBy()` 一次聚合。

## 7. 註冊新斜線指令

**修改檔案：** `src/events/ready.ts`

在 `ready.ts` 註冊所有新指令：`checkCommand`、`scoreCommand`、`adminCommand` 更新。

---
