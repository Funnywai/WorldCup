import prisma from "../db/prisma"

/**
 * 賽事比數（用於結算）
 */
export interface MatchScore {
  homeScore: number
  awayScore: number
  homeCorner: number | undefined
  awayCorner: number | undefined
}

/**
 * 單一 Bet 的評估結果
 */
export interface BetEvaluation {
  won: boolean
  outcome: string
  reason: string
}

/**
 * 從 oddsData 反推「主力讓球條件」（最接近 0 的那個）
 * 用於舊格式（不含 condition 的 HDC / CHD prediction）的結算。
 */
function inferMainCondition(
  oddsPool: { combinations?: Array<{ condition?: string; status: string }> } | undefined
): number | undefined {
  const combos = oddsPool?.combinations
  if (!combos || combos.length === 0) return undefined
  const available = combos.filter((c) => c.status === "AVAILABLE" && c.condition)
  const conds = [...new Set(available.map((c) => c.condition!))]
  const numeric = conds.map((c) => parseFloat(c)).filter((c) => !isNaN(c))
  if (numeric.length === 0) return undefined
  return numeric.reduce((best, c) => (Math.abs(c) < Math.abs(best) ? c : best))
}

/**
 * 根據賽事結果判斷某一筆下注是否贏。
 */
export function evaluateBet(
  betType: string,
  prediction: string,
  score: MatchScore,
  oddsData: Record<string, unknown> | null
): BetEvaluation {
  switch (betType) {
    case "HAD": {
      const actual = score.homeScore > score.awayScore ? "home"
        : score.homeScore < score.awayScore ? "away"
        : "draw"
      return {
        won: prediction === actual,
        outcome: actual,
        reason: `比分 ${score.homeScore}:${score.awayScore} → ${actual === "home" ? "主勝" : actual === "away" ? "客勝" : "和局"}`,
      }
    }

    case "HDC": {
      const parts = prediction.split("|")
      const pick = parts[0] // "H" / "A" / "D"
      let condition = parts[1] ? parseFloat(parts[1]) : undefined

      if (condition === undefined || isNaN(condition)) {
        condition = inferMainCondition(oddsData?.["HDC"] as Record<string, unknown> | undefined)
      }
      if (condition === undefined || isNaN(condition)) {
        return { won: false, outcome: "unknown", reason: "無法確定讓球條件（舊格式下注且無 oddsData）" }
      }

      const adjusted = score.homeScore + condition
      const actual = adjusted > score.awayScore ? "H"
        : adjusted < score.awayScore ? "A" : "D"
      const condStr = condition > 0 ? `+${condition}` : `${condition}`
      return {
        won: pick === actual,
        outcome: actual,
        reason: `比分 ${score.homeScore}:${score.awayScore} + 讓球 ${condStr} → ${actual === "H" ? "主勝" : actual === "A" ? "客勝" : "和局"}`,
      }
    }

    case "HHA": {
      const parts = prediction.split("|")
      const pick = parts[0] // "H" / "D" / "A"
      const condition = parseFloat(parts[1] || "0")
      const adjusted = score.homeScore + condition
      const actual = adjusted > score.awayScore ? "H"
        : adjusted < score.awayScore ? "A" : "D"
      const condStr = condition > 0 ? `+${condition}` : `${condition}`
      return {
        won: pick === actual,
        outcome: actual,
        reason: `比分 ${score.homeScore}:${score.awayScore} + 讓球 ${condStr} → ${actual === "H" ? "主勝" : actual === "A" ? "客勝" : "和局"}`,
      }
    }

    case "HIL": {
      const parts = prediction.split("|")
      const pick = parts[0] // "H"=大 / "L"=細
      const condition = parseFloat(parts[1] || "0")
      const total = score.homeScore + score.awayScore
      const actual = total > condition ? "H" : total < condition ? "L" : null
      if (actual === null) {
        return { won: false, outcome: "?", reason: `總進球 ${total} = 界線 ${condition}（走水）` }
      }
      return {
        won: pick === actual,
        outcome: actual,
        reason: `總進球 ${total} vs 界線 ${condition} → ${actual === "H" ? "大" : "細"}`,
      }
    }

    case "CHD": {
      if (score.homeCorner === undefined || score.awayCorner === undefined) {
        return { won: false, outcome: "unknown", reason: "無角球數據，無法結算 CHD" }
      }

      const parts = prediction.split("|")
      const pick = parts[0]
      let condition = parts[1] ? parseFloat(parts[1]) : undefined

      if (condition === undefined || isNaN(condition)) {
        condition = inferMainCondition(oddsData?.["CHD"] as Record<string, unknown> | undefined)
      }
      if (condition === undefined || isNaN(condition)) {
        return { won: false, outcome: "unknown", reason: "無法確定角球讓球條件（舊格式下注且無 oddsData）" }
      }

      const adjusted = (score.homeCorner ?? 0) + condition
      const actual = adjusted > (score.awayCorner ?? 0) ? "H"
        : adjusted < (score.awayCorner ?? 0) ? "A" : "D"
      const condStr = condition > 0 ? `+${condition}` : `${condition}`
      return {
        won: pick === actual,
        outcome: actual,
        reason: `角球 ${score.homeCorner}:${score.awayCorner} + 讓球 ${condStr} → ${actual === "H" ? "主勝" : actual === "A" ? "客勝" : "和局"}`,
      }
    }

    case "CHL": {
      if (score.homeCorner === undefined || score.awayCorner === undefined) {
        return { won: false, outcome: "unknown", reason: "無角球數據，無法結算 CHL" }
      }

      const parts = prediction.split("|")
      const pick = parts[0]
      const condition = parseFloat(parts[1] || "0")
      const total = (score.homeCorner ?? 0) + (score.awayCorner ?? 0)
      const actual = total > condition ? "H" : total < condition ? "L" : null
      if (actual === null) {
        return { won: false, outcome: "?", reason: `總角球 ${total} = 界線 ${condition}（走水）` }
      }
      return {
        won: pick === actual,
        outcome: actual,
        reason: `總角球 ${total} vs 界線 ${condition} → ${actual === "H" ? "大" : "細"}`,
      }
    }

    default:
      return { won: false, outcome: "unknown", reason: `不支援的玩法類型: ${betType}` }
  }
}

/**
 * 結算某一場賽事的所有 pending bets。
 * 回傳結算摘要供顯示。
 */
export async function settleMatchBets(
  matchDbId: string,
  score: MatchScore
): Promise<{
  settled: number
  won: number
  lost: number
  skipped: number
  details: string[]
}> {
  const pendingBets = await prisma.bet.findMany({
    where: { matchId: matchDbId, status: "pending" },
    include: { user: { select: { id: true, username: true } } },
  })

  const match = await prisma.match.findUnique({ where: { id: matchDbId } })
  const oddsData = (match?.oddsData ?? null) as Record<string, unknown> | null

  let won = 0
  let lost = 0
  let skipped = 0
  const details: string[] = []

  for (const bet of pendingBets) {
    const result = evaluateBet(bet.betType, bet.prediction, score, oddsData)

    if (result.outcome === "unknown") {
      skipped++
      details.push(`⚠️ **${bet.user.username}** [${bet.betType}] ${result.reason}`)
      continue
    }

    if (result.won) {
      const profit = bet.amount * (bet.odds - 1)
      await prisma.$transaction([
        prisma.bet.update({ where: { id: bet.id }, data: { status: "won" } }),
        prisma.user.update({
          where: { id: bet.userId },
          data: {
            totalWon: { increment: 1 },
            totalProfit: { increment: profit },
          },
        }),
      ])
      won++
      details.push(`✅ **${bet.user.username}** [${bet.betType}] 贏 — ${result.reason}`)
    } else {
      await prisma.$transaction([
        prisma.bet.update({ where: { id: bet.id }, data: { status: "lost" } }),
        prisma.user.update({
          where: { id: bet.userId },
          data: {
            totalLost: { increment: 1 },
            totalProfit: { decrement: bet.amount },
          },
        }),
      ])
      lost++
      details.push(`❌ **${bet.user.username}** [${bet.betType}] 輸 — ${result.reason}`)
    }
  }

  return { settled: won + lost, won, lost, skipped, details }
}

/**
 * 根據賽事比數自動結算該場 pending bets，
 * 並一併更新 Match 的 result 欄位（若尚未有）。
 */
export async function updateMatchResultAndSettle(
  matchDbId: string,
  score: MatchScore
): Promise<{
  settled: number
  won: number
  lost: number
  skipped: number
  details: string[]
}> {
  await prisma.match.update({
    where: { id: matchDbId },
    data: {
      status: "finished",
      result: `${score.homeScore}:${score.awayScore}`,
    },
  })

  return settleMatchBets(matchDbId, score)
}
