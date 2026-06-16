import cron from "node-cron"
import { Client, EmbedBuilder, TextChannel } from "discord.js"
import prisma from "../db/prisma"
import { fetchWorldCupMatches, type HkjcMatchData } from "./hkjc"
import { generateMatchAnalysis } from "./deepseek"
import { Match } from "@prisma/client"

export function startDailyAnalysisCron(client: Client): void {
  const cronTime = process.env.CRON_TIME || "0 8 * * *"
  cron.schedule(cronTime, async () => {
    console.log(`🔍 [Cron] 開始執行每日比賽分析 (${cronTime})...`)
    await runDailyAnalysis(client)
  }, { timezone: "Asia/Hong_Kong" })

  console.log(`⏰ 每日分析排程已設定：${cronTime}`)
}

async function runDailyAnalysis(client: Client): Promise<void> {
  try {
    const channelId = process.env.DAILY_PICKS_CHANNEL_ID
    if (!channelId) {
      console.error("❌ 未設定 DAILY_PICKS_CHANNEL_ID，跳過每日分析")
      return
    }

    const channel = (await client.channels.fetch(channelId)) as TextChannel
    if (!channel) {
      console.error(`❌ 找不到頻道 ${channelId}`)
      return
    }

    const today = new Date()
    const dateStr = formatDate(today)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatDate(tomorrow)

    console.log(`📡 正在從 HKJC 抓取今日 (${dateStr}) 世界盃賽事...`)
    let hkjcMatches = await fetchWorldCupMatches(dateStr, dateStr)

    if (hkjcMatches.length === 0) {
      console.log(`📡 今日無賽事，嘗試撈取明日 (${tomorrowStr})...`)
      hkjcMatches = await fetchWorldCupMatches(tomorrowStr, tomorrowStr)
      if (hkjcMatches.length === 0) {
        await channel.send("📭 暫無世界盃賽程資料。")
        return
      }
    }

    const matchRecords = await upsertMatchesToDb(hkjcMatches)
    await analyzeAndPost(client, matchRecords)
  } catch (error) {
    console.error("❌ 每日分析執行失敗:", error)
  }
}

export async function upsertMatchesToDb(
  hkjcMatches: HkjcMatchData[]
): Promise<Match[]> {
  return Promise.all(
    hkjcMatches.map(async (m) => {
      const existing = await prisma.match.findUnique({
        where: { hkjcMatchId: m.hkjcMatchId },
      })
      if (existing) {
        return prisma.match.update({
          where: { id: existing.id },
          data: {
            status: m.status,
            result: m.result || existing.result,
            oddsData: m.odds as unknown as object,
            oddsUpdatedAt: new Date(),
          },
        })
      }
      return prisma.match.create({
        data: {
          hkjcMatchId: m.hkjcMatchId,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          tournamentName: m.tournamentName,
          startTime: m.startTime,
          status: m.status,
          result: m.result,
          oddsData: m.odds as unknown as object,
          oddsUpdatedAt: new Date(),
        },
      })
    })
  )
}

export async function analyzeAndPost(
  client: Client,
  matchRecords: Match[]
): Promise<void> {
  const channelId = process.env.DAILY_PICKS_CHANNEL_ID
  if (!channelId) {
    console.error("❌ 未設定 DAILY_PICKS_CHANNEL_ID，跳過分析發送")
    return
  }

  const channel = (await client.channels.fetch(channelId)) as TextChannel
  if (!channel) {
    console.error(`❌ 找不到頻道 ${channelId}`)
    return
  }

  const sorted = [...matchRecords].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  )

  const matchesForAnalysis = sorted.map((match) => {
    const oddsData = match.oddsData as Record<string, unknown> | null
    let oddsSummary = ""
    if (oddsData) {
      const had = oddsData["HAD"] as
        | { combinations?: Array<{ str: string; name: string; odds: number }> }
        | undefined
      if (had?.combinations) {
        oddsSummary = had.combinations
          .map((c) => `${c.name}: ${c.odds}`)
          .join(", ")
      }

      const hdc = oddsData["HDC"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; status?: string; condition?: string }> }
        | undefined
      const hdcCombos = hdc?.combinations
      if (hdcCombos) {
        const hdcSummary = hdcCombos
          .filter((c) => !c.status || c.status === "AVAILABLE")
          .map((c) => `${c.name}${c.condition ? `(${c.condition})` : ""}: ${c.odds}`)
          .join(", ")
        if (hdcSummary) {
          oddsSummary += (oddsSummary ? " | " : "") + "讓球: " + hdcSummary
        }
      }
    }
    return {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      startTime: match.startTime,
      oddsSummary,
    }
  })

  console.log(`🤖 正在呼叫 DeepSeek API 分析 ${matchRecords.length} 場比賽...`)
  const analysis = await generateMatchAnalysis(matchesForAnalysis)

  await prisma.analysisLog.create({
    data: {
      matchId: matchRecords[0].id,
      deepseekOutput: analysis,
    },
  })

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const embed = new EmbedBuilder()
    .setColor(0x1e90ff)
    .setTitle("🏆 世界盃 2026 每日賽事分析")
    .setDescription(
      `📅 賽事日期：${tomorrow.toLocaleDateString("zh-TW", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      })}\n\n${analysis.length > 4000 ? analysis.slice(0, 4000) + "\n\n⚠️ 分析內容過長，已截斷。完整內容請查詢資料庫。" : analysis}`
    )
    .setFooter({
      text: "分析由 DeepSeek AI 生成 | 賠率來源：香港賽馬會 | 僅供參考，請理性投注",
    })
    .setTimestamp()

  await channel.send({ embeds: [embed] })
  console.log(`✅ 每日分析已發送至頻道 ${channel.id}`)
}

export function formatDate(date: Date): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function startMatchFetchCron(): void {
  const CRON_FETCH = process.env.CRON_FETCH || "*/15 * * * *"
  cron.schedule(CRON_FETCH, async () => {
    try {
      const todayStr = formatDate(new Date())
      const tomorrowDate = new Date()
      tomorrowDate.setDate(tomorrowDate.getDate() + 1)
      const tomorrowStr = formatDate(tomorrowDate)

      console.log(`📡 [Cron Fetch] 正在背景同步賽程 (${todayStr})...`)
      let matches = await fetchWorldCupMatches(todayStr, todayStr)
      if (matches.length === 0) {
        console.log(`📡 [Cron Fetch] 今日無賽事，嘗試撈取明日 (${tomorrowStr})...`)
        matches = await fetchWorldCupMatches(tomorrowStr, tomorrowStr)
      }
      if (matches.length > 0) {
        await upsertMatchesToDb(matches)
        console.log(`✅ [Cron Fetch] 已更新 ${matches.length} 場比賽賠率`)
      } else {
        console.log(`📭 [Cron Fetch] 暫無世界盃賽事`)
      }
    } catch (error) {
      console.error("❌ [Cron Fetch] 背景同步失敗:", error)
    }
  }, { timezone: "Asia/Hong_Kong" })

  console.log(`⏰ 背景賠率同步排程已設定：${CRON_FETCH}`)
}
