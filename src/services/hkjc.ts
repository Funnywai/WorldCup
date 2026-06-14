import { FootballAPI, FootballMatch, FootballPool } from "hkjc-api"

const api = new FootballAPI()

export interface HkjcMatchData {
  hkjcMatchId: string
  homeTeam: string
  awayTeam: string
  tournamentName: string
  startTime: Date
  status: "scheduled" | "live" | "finished"
  result?: string
  odds: Record<string, HkjcOddsPool>
}

export interface HkjcOddsPool {
  oddsType: string
  name: string
  inplay: boolean
  combinations: HkjcOddsCombination[]
}

export interface HkjcOddsCombination {
  str: string
  name: string
  odds: number
  status: string
  condition?: string
}

/**
 * 從 HKJC API 獲取世界盃賽事
 * 支援篩選日期範圍（用於 Cron 抓取明日賽事）
 */
export async function fetchWorldCupMatches(
  startDate?: string,
  endDate?: string
): Promise<HkjcMatchData[]> {
  const matches = await api.getAllFootballMatches({
    oddsTypes: ["HAD", "HDC", "HIL", "CRS"],
  })

  let worldCupMatches = matches.filter((m) => {
    const tNameCn = m.tournament?.name_ch?.toLowerCase() || ""
    const tNameEn = m.tournament?.name_en?.toLowerCase() || ""
    const tName = tNameCn + " " + tNameEn
    return tName.includes("世盃") || tName.includes("wc finals") || tName.includes("world cup")
  })

  if (startDate) {
    worldCupMatches = worldCupMatches.filter((m) => {
      const datePart = (m.matchDate || "").split("+")[0]
      if (!datePart) return false
      if (datePart < startDate) return false
      if (endDate && datePart > endDate) return false
      return true
    })
  }

  return worldCupMatches.map(transformMatch)
}

/**
 * 獲取即時賽事比分（用於更新進行中的比賽）
 */
export async function fetchRunningMatches(
  matchIds: string[]
): Promise<HkjcMatchData[]> {
  const results: HkjcMatchData[] = []
  for (const id of matchIds) {
    const data = await api.getRunningMatch(id)
    if (data.length > 0) {
      results.push(transformMatch(data[0]))
    }
  }
  return results
}

function transformMatch(match: FootballMatch): HkjcMatchData {
  const odds: Record<string, HkjcOddsPool> = {}

  for (const pool of match.foPools) {
    odds[pool.oddsType] = {
      oddsType: pool.oddsType,
      name: pool.name_ch,
      inplay: pool.inplay,
      combinations: pool.lines.flatMap((line) =>
        line.combinations.map((comb) => ({
          str: comb.str,
          name: comb.selections.map((s) => s.name_ch).join(" / "),
          odds: parseFloat(comb.currentOdds),
          status: comb.status,
          condition: line.condition || undefined,
        }))
      ),
    }
  }

  const score = match.runningResult
    ? `${match.runningResult.homeScore}:${match.runningResult.awayScore}`
    : undefined

  const statusMap: Record<string, HkjcMatchData["status"]> = {
    Scheduled: "scheduled",
    Live: "live",
    Running: "live",
    FIRSTHALF: "live",
    SECONDHALF: "live",
    HALFTIME: "live",
    ETFIRSTHALF: "live",
    ETSECONDHALF: "live",
    BREAK: "live",
    INTBREAK: "live",
    INTFIRSTHALF: "live",
    INTSECONDHALF: "live",
    Finished: "finished",
    Fulltime: "finished",
    Closed: "finished",
    Paying: "finished",
  }

  return {
    hkjcMatchId: match.id,
    homeTeam: `${match.homeTeam.name_ch} ${match.homeTeam.name_en}`.trim(),
    awayTeam: `${match.awayTeam.name_ch} ${match.awayTeam.name_en}`.trim(),
    tournamentName: match.tournament?.name_ch || match.tournament?.name_en || "",
    startTime: new Date(match.kickOffTime),
    status: statusMap[match.status] || "live",
    result: score,
    odds,
  }
}
