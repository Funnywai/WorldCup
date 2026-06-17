import {
  Interaction,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonInteraction,
  TextChannel,
} from "discord.js"
import prisma from "../db/prisma"
import { requireAuth, requireAdmin, hashPassword, verifyPassword } from "../services/auth"
import { fetchWorldCupMatches } from "../services/hkjc"
import { upsertMatchesToDb, analyzeAndPost, analyzeSingleMatch, formatDate } from "../services/dailyAnalysis"

function flipPart(part: string): string {
  if (part.startsWith("-")) return "+" + part.slice(1)
  if (part.startsWith("+")) return "-" + part.slice(1)
  if (part === "0" || part === "0.0") return part
  return "-" + part
}

function flipCondition(condition: string): string {
  if (!condition.includes("/")) return flipPart(condition)
  return condition.split("/").map(flipPart).join("/")
}

export async function onInteractionCreate(
  interaction: Interaction
): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction)
    return
  }

  if (interaction.isButton()) {
    if (interaction.customId === "refresh_match") {
      await handleRefreshMatch(interaction)
      return
    }
  }

  if (!interaction.isChatInputCommand()) return

  const { commandName } = interaction

  switch (commandName) {
    case "login":
      await handleLogin(interaction)
      break
    case "admin":
      await handleAdmin(interaction)
      break
    case "stat":
      await handleStat(interaction)
      break
    case "bet":
      await handleBet(interaction)
      break
    case "rank":
      await handleRank(interaction)
      break
    case "help":
      await handleHelp(interaction)
      break
    case "match":
      await handleFetch(interaction)
      break
    case "analyst":
      await handleAnalyst(interaction)
      break
    case "check":
      await handleCheck(interaction)
      break
    case "fix":
      await handleFix(interaction)
      break
  }
}

// ─── Autocomplete ──────────────────────────────────────────────────────────

async function handleAutocomplete(
  interaction: AutocompleteInteraction
): Promise<void> {
  const { commandName } = interaction

  if (commandName === "bet") {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "match") {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)

      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { status: "scheduled" },
            { status: "live", startTime: { gt: threeHoursAgo } },
          ],
        },
        orderBy: { startTime: "asc" },
      })

      const choices = matches.map((m) => ({
        name: `${m.homeTeam} vs ${m.awayTeam}`,
        value: m.id,
      }))

      await interaction.respond(choices)
    }

    if (focusedOption.name === "prediction") {
      const betType = interaction.options.getString("type")

      if (!betType) {
        await interaction.respond([])
        return
      }

      if (betType === "HAD") {
        const matchId = interaction.options.getString("match")
        if (!matchId) {
          await interaction.respond([])
          return
        }

        const match = await prisma.match.findUnique({
          where: { id: matchId },
        })

        let homeOdds: number | undefined
        let drawOdds: number | undefined
        let awayOdds: number | undefined

        if (match) {
          const oddsData = match.oddsData as Record<string, unknown> | null
          const had = oddsData?.["HAD"] as
            | { combinations?: Array<{ str: string; odds: number }> }
            | undefined
          if (had?.combinations) {
            homeOdds = had.combinations.find((c) => c.str === "H")?.odds
            drawOdds = had.combinations.find((c) => c.str === "D")?.odds
            awayOdds = had.combinations.find((c) => c.str === "A")?.odds
          }
        }

        await interaction.respond([
          { name: `主隊勝${homeOdds !== undefined ? ` (${homeOdds.toFixed(2)})` : ""}`, value: "home" },
          { name: `平手${drawOdds !== undefined ? ` (${drawOdds.toFixed(2)})` : ""}`, value: "draw" },
          { name: `客隊勝${awayOdds !== undefined ? ` (${awayOdds.toFixed(2)})` : ""}`, value: "away" },
        ])
        return
      }

      if (betType === "HDC") {
        const matchId = interaction.options.getString("match")
        if (!matchId) {
          await interaction.respond([])
          return
        }

        const match = await prisma.match.findUnique({
          where: { id: matchId },
        })

        if (!match) {
          await interaction.respond([])
          return
        }

        const oddsData = match.oddsData as Record<string, unknown> | null
        const hdc = oddsData?.["HDC"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined

        if (!hdc?.combinations) {
          await interaction.respond([])
          return
        }

        const choices = hdc.combinations
          .filter((c) => c.status === "AVAILABLE")
          .map((c) => {
            const teamName = c.str === "H" ? match.homeTeam : match.awayTeam
            const rawCond = c.condition ?? ""
            const displayCond = c.str === "H" ? c.condition : (c.condition ? flipCondition(c.condition) : undefined)
            const suffix = displayCond ? ` ${displayCond}` : ""
            const value = rawCond ? `${c.str}|${rawCond}` : c.str
            return { name: `${teamName}${suffix} — ${c.odds.toFixed(2)}`, value }
          })

        await interaction.respond(choices)
      }

      if (betType === "HHA") {
        const matchId = interaction.options.getString("match")
        if (!matchId) { await interaction.respond([]); return }
        const match = await prisma.match.findUnique({ where: { id: matchId } })
        if (!match) { await interaction.respond([]); return }
        const oddsData = match.oddsData as Record<string, unknown> | null
        const hha = oddsData?.["HHA"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!hha?.combinations) { await interaction.respond([]); return }
        const haCombos = hha.combinations
        const conds = [...new Set(haCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 3).forEach(cond => {
          const h = haCombos.find(c => c.condition === cond && c.str === "H")
          const d = haCombos.find(c => c.condition === cond && c.str === "D")
          const a = haCombos.find(c => c.condition === cond && c.str === "A")
          if (h) choices.push({ name: `${match.homeTeam} ${cond} (${h.odds})`, value: `H|${cond}` })
          if (d) choices.push({ name: `和局 ${cond} (${d.odds})`, value: `D|${cond}` })
          if (a) choices.push({ name: `${match.awayTeam} ${cond} (${a.odds})`, value: `A|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "HIL") {
        const matchId = interaction.options.getString("match")
        if (!matchId) { await interaction.respond([]); return }
        const match = await prisma.match.findUnique({ where: { id: matchId } })
        if (!match) { await interaction.respond([]); return }
        const oddsData = match.oddsData as Record<string, unknown> | null
        const hil = oddsData?.["HIL"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!hil?.combinations) { await interaction.respond([]); return }
        const hilCombos = hil.combinations
        const conds = [...new Set(hilCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 6).forEach(cond => {
          const h = hilCombos.find(c => c.condition === cond && c.str === "H")
          const l = hilCombos.find(c => c.condition === cond && c.str === "L")
          if (h) choices.push({ name: `大 ${cond} (${h.odds})`, value: `H|${cond}` })
          if (l) choices.push({ name: `細 ${cond} (${l.odds})`, value: `L|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "CHD") {
        const matchId = interaction.options.getString("match")
        if (!matchId) { await interaction.respond([]); return }
        const match = await prisma.match.findUnique({ where: { id: matchId } })
        if (!match) { await interaction.respond([]); return }
        const oddsData = match.oddsData as Record<string, unknown> | null
        const chd = oddsData?.["CHD"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!chd?.combinations) { await interaction.respond([]); return }
        const choices = chd.combinations
          .filter(c => c.status === "AVAILABLE")
          .map(c => {
            const teamName = c.str === "H" ? match.homeTeam : match.awayTeam
            const rawCond = c.condition ?? ""
            const displayCond = c.str === "H" ? c.condition : (c.condition ? flipCondition(c.condition) : undefined)
            const suffix = displayCond ? ` ${displayCond}` : ""
            const value = rawCond ? `${c.str}|${rawCond}` : c.str
            return { name: `${teamName}${suffix} — ${c.odds.toFixed(2)}`, value }
          })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "CHL") {
        const matchId = interaction.options.getString("match")
        if (!matchId) { await interaction.respond([]); return }
        const match = await prisma.match.findUnique({ where: { id: matchId } })
        if (!match) { await interaction.respond([]); return }
        const oddsData = match.oddsData as Record<string, unknown> | null
        const chl = oddsData?.["CHL"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!chl?.combinations) { await interaction.respond([]); return }
        const chlCombos = chl.combinations
        const conds = [...new Set(chlCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 6).forEach(cond => {
          const h = chlCombos.find(c => c.condition === cond && c.str === "H")
          const l = chlCombos.find(c => c.condition === cond && c.str === "L")
          if (h) choices.push({ name: `角球大 ${cond} (${h.odds})`, value: `H|${cond}` })
          if (l) choices.push({ name: `角球細 ${cond} (${l.odds})`, value: `L|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }
    }
  }

  if (commandName === "analyst") {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "match_id") {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000)
      const matches = await prisma.match.findMany({
        where: {
          OR: [
            { status: "scheduled" },
            { status: "live", startTime: { gt: threeHoursAgo } },
          ],
        },
        orderBy: { startTime: "asc" },
      })

      const choices = matches.map((m) => ({
        name: `${m.homeTeam} vs ${m.awayTeam}`,
        value: m.id,
      }))
      await interaction.respond(choices)
    }
  }

  if (commandName === "admin") {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "username") {
      const users = await prisma.user.findMany({
        where: { status: "active" },
        orderBy: { username: "asc" },
      })
      await interaction.respond(
        users.map((u) => ({ name: u.username, value: u.username }))
      )
    }

    if (focusedOption.name === "match") {
      const matches = await prisma.match.findMany({
        orderBy: { startTime: "desc" },
        take: 20,
      })
      const statusLabel = (s: string) =>
        s === "finished" ? "已結束" : s === "live" ? "進行中" : "待開始"
      await interaction.respond(
        matches.map((m) => ({
          name: `${m.homeTeam} vs ${m.awayTeam} [${statusLabel(m.status)}]`,
          value: m.id,
        }))
      )
    }

    if (focusedOption.name === "prediction") {
      const betType = interaction.options.getString("type")
      if (!betType) { await interaction.respond([]); return }

      const matchId = interaction.options.getString("match")
      if (!matchId) { await interaction.respond([]); return }

      const match = await prisma.match.findUnique({ where: { id: matchId } })
      if (!match) { await interaction.respond([]); return }

      const oddsData = match.oddsData as Record<string, unknown> | null

      if (betType === "HAD") {
        let homeOdds: number | undefined
        let drawOdds: number | undefined
        let awayOdds: number | undefined
        const had = oddsData?.["HAD"] as
          | { combinations?: Array<{ str: string; odds: number }> }
          | undefined
        if (had?.combinations) {
          homeOdds = had.combinations.find((c) => c.str === "H")?.odds
          drawOdds = had.combinations.find((c) => c.str === "D")?.odds
          awayOdds = had.combinations.find((c) => c.str === "A")?.odds
        }
        await interaction.respond([
          { name: `主隊勝${homeOdds !== undefined ? ` (${homeOdds.toFixed(2)})` : ""}`, value: "home" },
          { name: `平手${drawOdds !== undefined ? ` (${drawOdds.toFixed(2)})` : ""}`, value: "draw" },
          { name: `客隊勝${awayOdds !== undefined ? ` (${awayOdds.toFixed(2)})` : ""}`, value: "away" },
        ])
        return
      }

      if (betType === "HDC") {
        const hdc = oddsData?.["HDC"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!hdc?.combinations) { await interaction.respond([]); return }

        await interaction.respond(
          hdc.combinations
            .filter((c) => c.status === "AVAILABLE")
            .map((c) => {
              const teamName = c.str === "H" ? match.homeTeam : match.awayTeam
              const rawCond = c.condition ?? ""
              const displayCond = c.str === "H" ? c.condition : (c.condition ? flipCondition(c.condition) : undefined)
              const suffix = displayCond ? ` ${displayCond}` : ""
              const value = rawCond ? `${c.str}|${rawCond}` : c.str
              return { name: `${teamName}${suffix} — ${c.odds.toFixed(2)}`, value }
            })
        )
      }

      if (betType === "HHA") {
        const hha = oddsData?.["HHA"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!hha?.combinations) { await interaction.respond([]); return }
        const haCombos = hha.combinations
        const conds = [...new Set(haCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 3).forEach(cond => {
          const h = haCombos.find(c => c.condition === cond && c.str === "H")
          const d = haCombos.find(c => c.condition === cond && c.str === "D")
          const a = haCombos.find(c => c.condition === cond && c.str === "A")
          if (h) choices.push({ name: `${match.homeTeam} ${cond} (${h.odds})`, value: `H|${cond}` })
          if (d) choices.push({ name: `和局 ${cond} (${d.odds})`, value: `D|${cond}` })
          if (a) choices.push({ name: `${match.awayTeam} ${cond} (${a.odds})`, value: `A|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "HIL") {
        const hil = oddsData?.["HIL"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!hil?.combinations) { await interaction.respond([]); return }
        const hilCombos = hil.combinations
        const conds = [...new Set(hilCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 6).forEach(cond => {
          const h = hilCombos.find(c => c.condition === cond && c.str === "H")
          const l = hilCombos.find(c => c.condition === cond && c.str === "L")
          if (h) choices.push({ name: `大 ${cond} (${h.odds})`, value: `H|${cond}` })
          if (l) choices.push({ name: `細 ${cond} (${l.odds})`, value: `L|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "CHD") {
        const chd = oddsData?.["CHD"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!chd?.combinations) { await interaction.respond([]); return }
        const choices = chd.combinations
          .filter(c => c.status === "AVAILABLE")
          .map(c => {
            const teamName = c.str === "H" ? match.homeTeam : match.awayTeam
            const rawCond = c.condition ?? ""
            const displayCond = c.str === "H" ? c.condition : (c.condition ? flipCondition(c.condition) : undefined)
            const suffix = displayCond ? ` ${displayCond}` : ""
            const value = rawCond ? `${c.str}|${rawCond}` : c.str
            return { name: `${teamName}${suffix} — ${c.odds.toFixed(2)}`, value }
          })
        await interaction.respond(choices.slice(0, 25))
      }

      if (betType === "CHL") {
        const chl = oddsData?.["CHL"] as
          | { combinations?: Array<{ str: string; name: string; odds: number; status: string; condition?: string }> }
          | undefined
        if (!chl?.combinations) { await interaction.respond([]); return }
        const chlCombos = chl.combinations
        const conds = [...new Set(chlCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const choices: { name: string; value: string }[] = []
        conds.slice(0, 6).forEach(cond => {
          const h = chlCombos.find(c => c.condition === cond && c.str === "H")
          const l = chlCombos.find(c => c.condition === cond && c.str === "L")
          if (h) choices.push({ name: `角球大 ${cond} (${h.odds})`, value: `H|${cond}` })
          if (l) choices.push({ name: `角球細 ${cond} (${l.odds})`, value: `L|${cond}` })
        })
        await interaction.respond(choices.slice(0, 25))
      }
    }
  }

  if (commandName === "check") {
    const focusedOption = interaction.options.getFocused(true)

    if (focusedOption.name === "bet_id") {
      const bets = await prisma.bet.findMany({
        where: { status: "pending" },
        include: { match: true, user: { select: { username: true } } },
        orderBy: { createdAt: "asc" },
        take: 25,
      })
      await interaction.respond(
        bets.map((b) => ({
          name: `${b.user.username} | ${b.match.homeTeam} vs ${b.match.awayTeam} | $${b.amount}`,
          value: b.id,
        }))
      )
    }
  }
}

// ─── /login ────────────────────────────────────────────────────────────────

async function handleLogin(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const username = interaction.options.getString("username", true)
    const password = interaction.options.getString("password", true)

    const user = await prisma.user.findUnique({ where: { username } })

    // 首次啟動（User 表為空）：自動建立 Admin
    const userCount = await prisma.user.count()
    if (userCount === 0 && !user) {
      const passwordHash = await hashPassword(password)
      const newUser = await prisma.user.create({
        data: {
          discordId: interaction.user.id,
          username,
          passwordHash,
          role: "ADMIN",
          status: "active",
          lastLoginAt: new Date(),
        },
      })

      await interaction.reply({
        content: `✅ 已建立管理員帳號 **${username}** 並登入成功！\n\n你現在可以使用所有 Bot 指令。請使用 \`/admin add\` 新增其他用戶。`,
        ephemeral: true,
      })
      console.log(`👑 首位 Admin「${username}」已建立 (Discord ID: ${interaction.user.id})`)
      return
    }

    if (!user) {
      await interaction.reply({
        content: "❌ 帳號不存在，請聯絡管理員。",
        ephemeral: true,
      })
      return
    }

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) {
      await interaction.reply({
        content: "❌ 密碼錯誤。",
        ephemeral: true,
      })
      return
    }

    // 綁定 Discord ID + 更新登入時間
    await prisma.user.update({
      where: { id: user.id },
      data: {
        discordId: interaction.user.id,
        lastLoginAt: new Date(),
      },
    })

    if (user.status === "disabled") {
      await interaction.reply({
        content: "❌ 你的帳號已被停用，請聯絡管理員。",
        ephemeral: true,
      })
      return
    }

    await interaction.reply({
      content: `✅ 登入成功！歡迎回來，**${user.username}**。\n\n帳號狀態：${user.status === "active" ? "🟢 正常" : "🔴 已停用"}\n角色：${user.role === "ADMIN" ? "👑 管理員" : "👤 一般用戶"}`,
      ephemeral: true,
    })
  } catch (error) {
    console.error("❌ /login 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 登入時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

// ─── /admin ────────────────────────────────────────────────────────────────

async function handleAdmin(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  const subcommand = interaction.options.getSubcommand()

  try {
    switch (subcommand) {
      case "add":
        await handleAdminAdd(interaction)
        break
      case "activate":
        await handleAdminActivate(interaction)
        break
      case "deactivate":
        await handleAdminDeactivate(interaction)
        break
      case "list":
        await handleAdminList(interaction)
        break
      case "resetpw":
        await handleAdminResetPw(interaction)
        break
      case "delete":
        await handleAdminDelete(interaction)
        break
      case "bet-place":
        await handleAdminBetPlace(interaction)
        break
      case "bet-other":
        await handleAdminBetOther(interaction)
        break
    }
  } catch (error) {
    console.error(`❌ /admin ${subcommand} 執行錯誤:`, error)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ 執行管理操作時發生錯誤。",
        ephemeral: true,
      })
    }
  }
}

async function handleAdminAdd(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options.getString("username", true)
  const password = interaction.options.getString("password", true)

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    await interaction.reply({
      content: `❌ 帳號 **${username}** 已存在。`,
      ephemeral: true,
    })
    return
  }

  const passwordHash = await hashPassword(password)
  await prisma.user.create({
    data: { username, passwordHash, status: "active" },
  })

  await interaction.reply({
    content: `✅ 用戶 **${username}** 已建立（狀態：active）。\n\n請將帳號密碼提供給該用戶，請他使用 \`/login\` 登入。`,
    ephemeral: true,
  })
}

async function handleAdminActivate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options.getString("username", true)
  const user = await prisma.user.findUnique({ where: { username } })

  if (!user) {
    await interaction.reply({
      content: `❌ 找不到用戶 **${username}**。`,
      ephemeral: true,
    })
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "active" },
  })

  await interaction.reply({
    content: `✅ 用戶 **${username}** 已設為 **active**。`,
    ephemeral: true,
  })
}

async function handleAdminDeactivate(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options.getString("username", true)
  const user = await prisma.user.findUnique({ where: { username } })

  if (!user) {
    await interaction.reply({
      content: `❌ 找不到用戶 **${username}**。`,
      ephemeral: true,
    })
    return
  }

  if (user.role === "ADMIN") {
    await interaction.reply({
      content: "❌ 無法停用管理員帳號。",
      ephemeral: true,
    })
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { status: "disabled" },
  })

  await interaction.reply({
    content: `🔒 用戶 **${username}** 已停用。`,
    ephemeral: true,
  })
}

async function handleAdminList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  })

  if (users.length === 0) {
    await interaction.reply({
      content: "沒有任何用戶。",
      ephemeral: true,
    })
    return
  }

  const description = users
    .map((u) => {
      const winRate =
        u.totalBets > 0 ? ((u.totalWon / u.totalBets) * 100).toFixed(1) : "0.0"
      const roleIcon = u.role === "ADMIN" ? "👑" : "👤"
      const statusIcon = u.status === "active" ? "🟢" : "🔴"
      return (
        `${roleIcon} **${u.username}** ${statusIcon}\n` +
        `　┗ 下注：${u.totalBets} | 勝：${u.totalWon} | 敗：${u.totalLost} | 勝率：${winRate}% | 盈虧：$${u.totalProfit.toLocaleString()}\n` +
        `　┗ Discord：${u.discordId ? `<@${u.discordId}>` : "未綁定"} | 最後登入：${u.lastLoginAt ? u.lastLoginAt.toLocaleString("zh-TW") : "—"}`
      )
    })
    .join("\n\n")

  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle("👥 用戶列表")
    .setDescription(description)
    .setFooter({ text: `共 ${users.length} 位用戶` })
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}

async function handleAdminResetPw(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options.getString("username", true)
  const newPassword = interaction.options.getString("new_password", true)

  const user = await prisma.user.findUnique({ where: { username } })

  if (!user) {
    await interaction.reply({
      content: `❌ 找不到用戶 **${username}**。`,
      ephemeral: true,
    })
    return
  }

  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  await interaction.reply({
    content: `🔑 用戶 **${username}** 的密碼已重置。`,
    ephemeral: true,
  })
}

async function handleAdminDelete(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const username = interaction.options.getString("username", true)
  const user = await prisma.user.findUnique({ where: { username } })

  if (!user) {
    await interaction.reply({
      content: `❌ 找不到用戶 **${username}**。`,
      ephemeral: true,
    })
    return
  }

  if (user.role === "ADMIN") {
    await interaction.reply({
      content: "❌ 無法刪除管理員帳號。",
      ephemeral: true,
    })
    return
  }

  // 層級刪除：先刪除下注，再刪除用戶
  await prisma.bet.deleteMany({ where: { userId: user.id } })
  await prisma.user.delete({ where: { id: user.id } })

  await interaction.reply({
    content: `🗑️ 用戶 **${username}** 及其所有下注紀錄已刪除。`,
    ephemeral: true,
  })
}

// ─── /stat ────────────────────────────────────────────────────────────────

async function handleStat(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = await requireAuth(interaction)
  if (!user) return

  try {
    const winRate =
      user.totalBets > 0
        ? ((user.totalWon / user.totalBets) * 100).toFixed(1)
        : "0.0"

    const embed = new EmbedBuilder()
      .setColor(0x00ff88)
      .setTitle("📊 下注統計")
      .setAuthor({
        name: user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .addFields(
        {
          name: "總下注次數",
          value: `${user.totalBets}`,
          inline: true,
        },
        {
          name: "獲勝次數",
          value: `${user.totalWon}`,
          inline: true,
        },
        {
          name: "失敗次數",
          value: `${user.totalLost}`,
          inline: true,
        },
        {
          name: "勝率",
          value: `${winRate}%`,
          inline: true,
        },
        {
          name: "累計盈虧",
          value: `$${user.totalProfit.toLocaleString()}`,
          inline: true,
        }
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /stat 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 查詢統計時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

// ─── /bet ──────────────────────────────────────────────────────────────────

async function handleBet(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = await requireAuth(interaction)
  if (!user) return

  const subcommand = interaction.options.getSubcommand()

  switch (subcommand) {
    case "place":
      await handleBetPlace(interaction, user)
      break
    case "other":
      await handleBetOther(interaction, user)
      break
    case "history":
      await handleBetHistory(interaction, user)
      break
  }
}

async function handleBetPlace(
  interaction: ChatInputCommandInteraction,
  user: Awaited<ReturnType<typeof requireAuth>>
): Promise<void> {
  try {
    await interaction.deferReply()

    const matchId = interaction.options.getString("match", true)
    const betType = interaction.options.getString("type", true)
    const prediction = interaction.options.getString("prediction", true)
    const amount = interaction.options.getNumber("amount", true)

    if (!user) return

    // 檢查比賽是否存在且狀態為 scheduled
    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      await interaction.editReply("❌ 找不到該比賽，請確認比賽 ID 是否正確。")
      return
    }
    if (!["scheduled", "live"].includes(match.status)) {
      await interaction.editReply("❌ 該比賽已結束，無法下注。")
      return
    }

    // 從 oddsData 中取得對應預測的即時賠率
    let betOdds = 2.0
    let predictionText = prediction
    const oddsData = match.oddsData as Record<string, unknown> | null

    if (betType === "HAD" && oddsData) {
      const had = oddsData["HAD"] as
        | { combinations?: Array<{ str: string; odds: number }> }
        | undefined
      if (had?.combinations) {
        const prefix = prediction === "home" ? "H" : prediction === "away" ? "A" : "D"
        const matchComb = had.combinations.find((c) => c.str === prefix)
        if (matchComb) {
          betOdds = matchComb.odds
        }
      }
      predictionText =
        prediction === "home"
          ? match.homeTeam
          : prediction === "away"
            ? match.awayTeam
            : "平手"
    }

    if (betType === "HDC" && oddsData) {
      const hdc = oddsData["HDC"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hdc?.combinations?.find(
        (c) => c.str === parts[0] && (!parts[1] || c.condition === parts[1])
      )
      if (matchComb) {
        betOdds = matchComb.odds
        const teamName = parts[0] === "H" ? match.homeTeam : match.awayTeam
        predictionText = matchComb.condition
          ? `${teamName} ${matchComb.condition}`
          : teamName
      }
    }

    if (betType === "HHA" && oddsData) {
      const hha = oddsData["HHA"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hha?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        const condLabel = matchComb.condition ?? ""
        if (parts[0] === "H") predictionText = `${match.homeTeam} ${condLabel}`
        else if (parts[0] === "D") predictionText = `和局 ${condLabel}`
        else if (parts[0] === "A") predictionText = `${match.awayTeam} ${condLabel}`
      }
    }

    if (betType === "HIL" && oddsData) {
      const hil = oddsData["HIL"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hil?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        if (parts[0] === "H") predictionText = `大 ${parts[1]}`
        else if (parts[0] === "L") predictionText = `細 ${parts[1]}`
      }
    }

    if (betType === "CHD" && oddsData) {
      const chd = oddsData["CHD"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = chd?.combinations?.find(
        (c) => c.str === parts[0] && (!parts[1] || c.condition === parts[1])
      )
      if (matchComb) {
        betOdds = matchComb.odds
        const teamName = parts[0] === "H" ? match.homeTeam : match.awayTeam
        predictionText = matchComb.condition
          ? `${teamName} ${matchComb.condition}`
          : teamName
      }
    }

    if (betType === "CHL" && oddsData) {
      const chl = oddsData["CHL"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = chl?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        if (parts[0] === "H") predictionText = `角球大 ${parts[1]}`
        else if (parts[0] === "L") predictionText = `角球細 ${parts[1]}`
      }
    }

    const typeLabels: Record<string, string> = {
      HAD: "主客和",
      HDC: "讓球",
      HHA: "讓球主客和",
      HIL: "入球大細",
      CHD: "角球讓球",
      CHL: "角球大細",
    }

    // user is guaranteed non-null here
    const u = user as NonNullable<typeof user>

    // 建立下注
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: { totalBets: { increment: 1 } },
      }),
      prisma.bet.create({
        data: {
          userId: u.id,
          matchId: match.id,
          amount,
          odds: betOdds,
          betType,
          prediction,
          status: "pending",
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("✅ 下注成功！")
      .addFields(
        {
          name: "比賽",
          value: `${match.homeTeam} vs ${match.awayTeam}`,
          inline: false,
        },
        { name: "玩法", value: typeLabels[betType] ?? betType, inline: true },
        { name: "預測", value: predictionText, inline: true },
        { name: "金額", value: `$${amount.toLocaleString()}`, inline: true },
        { name: "賠率", value: betOdds.toFixed(2), inline: true }
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /bet place 執行錯誤:", error)
    const content = "❌ 下注時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

async function handleBetOther(
  interaction: ChatInputCommandInteraction,
  user: Awaited<ReturnType<typeof requireAuth>>
): Promise<void> {
  try {
    await interaction.deferReply()

    const matchId = interaction.options.getString("match", true)
    const manualOdds = interaction.options.getNumber("odds", true)
    const amount = interaction.options.getNumber("amount", true)
    const prediction = interaction.options.getString("prediction") ?? ""

    if (!user) return

    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      await interaction.editReply("❌ 找不到該比賽，請確認比賽 ID 是否正確。")
      return
    }
    if (!["scheduled", "live"].includes(match.status)) {
      await interaction.editReply("❌ 該比賽已結束，無法下注。")
      return
    }

    const predictionText = prediction || "手動下注"

    const u = user as NonNullable<typeof user>

    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: { totalBets: { increment: 1 } },
      }),
      prisma.bet.create({
        data: {
          userId: u.id,
          matchId: match.id,
          amount,
          odds: manualOdds,
          betType: "OTHER",
          prediction,
          status: "pending",
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("✅ 下注成功！")
      .addFields(
        {
          name: "比賽",
          value: `${match.homeTeam} vs ${match.awayTeam}`,
          inline: false,
        },
        { name: "玩法", value: "其他（手動賠率）", inline: true },
        { name: "預測", value: predictionText, inline: true },
        { name: "金額", value: `$${amount.toLocaleString()}`, inline: true },
        { name: "賠率", value: manualOdds.toFixed(2), inline: true }
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /bet other 執行錯誤:", error)
    const content = "❌ 下注時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

async function handleBetHistory(
  interaction: ChatInputCommandInteraction,
  user: Awaited<ReturnType<typeof requireAuth>>
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true })

    if (!user) return

    const page = interaction.options.getInteger("page") || 1
    const pageSize = 5
    const skip = (page - 1) * pageSize

    const u = user as NonNullable<typeof user>

    const [bets, totalCount] = await Promise.all([
      prisma.bet.findMany({
        where: { userId: u.id },
        include: { match: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.bet.count({ where: { userId: u.id } }),
    ])

    if (bets.length === 0) {
      await interaction.editReply("❌ 你還沒有任何下注紀錄。")
      return
    }

    const statusText: Record<string, string> = {
      pending: "⏳ 待結算",
      won: "✅ 獲勝",
      lost: "❌ 失敗",
    }

    const typeLabels: Record<string, string> = {
      HAD: "主客和",
      HDC: "讓球",
      HHA: "讓球主客和",
      HIL: "入球大細",
      CHD: "角球讓球",
      CHL: "角球大細",
      OTHER: "其他",
    }

    const description = bets
      .map((bet, i) => {
        const match = bet.match
        let predictionText = bet.prediction
        if (bet.betType === "HAD" || !bet.betType) {
          predictionText =
            bet.prediction === "home"
              ? match.homeTeam
              : bet.prediction === "away"
                ? match.awayTeam
                : "平手"
        } else if (bet.betType === "HDC") {
          const oddsData = match.oddsData as Record<string, unknown> | null
          const hdc = oddsData?.["HDC"] as
            | { combinations?: Array<{ str: string; name: string; condition?: string }> }
            | undefined
          const comb = hdc?.combinations?.find((c) => c.str === bet.prediction)
          if (comb) {
            const teamName = bet.prediction === "H" ? match.homeTeam : match.awayTeam
            predictionText = comb.condition
              ? `${teamName} ${comb.condition}`
              : teamName
          } else {
            predictionText = bet.prediction === "H" ? match.homeTeam : match.awayTeam
          }
        }
        return (
          `**#${skip + i + 1}** ${match.homeTeam} vs ${match.awayTeam}\n` +
          `　┗ 玩法: ${typeLabels[bet.betType] ?? bet.betType} | 預測: ${predictionText} | 金額: $${bet.amount.toLocaleString()} | 賠率: ${bet.odds.toFixed(2)} | 狀態: ${statusText[bet.status]}\n` +
          `　┗ 日期: ${bet.createdAt.toLocaleString("zh-TW")}`
        )
      })
      .join("\n\n")

    const totalPages = Math.ceil(totalCount / pageSize)

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle("📋 下注紀錄")
      .setDescription(description)
      .setFooter({
        text: `第 ${page}/${totalPages} 頁 | 共 ${totalCount} 筆紀錄`,
      })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /bet history 執行錯誤:", error)
    const content = "❌ 查詢下注紀錄時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

// ─── /rank ────────────────────────────────────────────────────────────────

async function handleRank(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      orderBy: { totalProfit: "desc" },
      take: 10,
    })

    if (users.length === 0) {
      await interaction.reply("目前還沒有用戶資料。")
      return
    }

    const medals = ["🥇", "🥈", "🥉"]
    const description = users
      .map((u, i) => {
        const rank = medals[i] || `#${i + 1}`
        const winRate =
          u.totalBets > 0
            ? ((u.totalWon / u.totalBets) * 100).toFixed(1)
            : "0.0"
        const statusIcon = u.status === "active" ? "🟢" : "🔴"
        const profitSign = u.totalProfit >= 0 ? "+" : ""
        return (
          `${rank} ${statusIcon} **${u.username}**\n` +
          `　┗ 下注: ${u.totalBets} | 勝: ${u.totalWon} | 敗: ${u.totalLost} | 勝率: ${winRate}%\n` +
          `　┗ 累計盈虧: **${profitSign}$${u.totalProfit.toLocaleString()}**`
        )
      })
      .join("\n\n")

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle("🏆 下注排行榜 Top 10")
      .setDescription(description)
      .setFooter({ text: "依累計盈虧排序" })
      .setTimestamp()

    await interaction.reply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /rank 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 查詢排行榜時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

// ─── /match ────────────────────────────────────────────────────────────────

async function handleFetch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAuth(interaction))) return

  try {
    await interaction.deferReply()

    const todayStr = formatDate(new Date())
    const tomorrowDate = new Date()
    tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowStr = formatDate(tomorrowDate)

    console.log(`📡 [/match] 正在從 HKJC 抓取今日 (${todayStr}) 世界盃賽事...`)
    let matches = await fetchWorldCupMatches(todayStr, todayStr)

    if (matches.length === 0) {
      console.log(`📡 [/match] 今日無賽事，嘗試撈取明日 (${tomorrowStr})...`)
      matches = await fetchWorldCupMatches(tomorrowStr, tomorrowStr)
    }

    if (matches.length === 0) {
      await interaction.editReply("📭 暫無世界盃賽程資料。")
      return
    }

    const records = await upsertMatchesToDb(matches)

    const matchLines = records.map((m, i) => {
      const oddsData = m.oddsData as Record<string, unknown> | null
      let oddsLines: string[] = []
      if (oddsData) {
        const had = oddsData["HAD"] as
          | { combinations?: Array<{ str: string; odds: number }> }
          | undefined
        if (had?.combinations) {
          const home = had.combinations.find((c) => c.str === "H")
          const draw = had.combinations.find((c) => c.str === "D")
          const away = had.combinations.find((c) => c.str === "A")
          oddsLines.push(
            `主 ${home?.odds.toFixed(2) ?? "—"} | ` +
            `和 ${draw?.odds.toFixed(2) ?? "—"} | ` +
            `客 ${away?.odds.toFixed(2) ?? "—"}`
          )
        }
      }
      const time = m.startTime.toLocaleString("zh-TW", {
        timeZone: "Asia/Hong_Kong",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
      return (
        `**#${i + 1}** ${m.homeTeam} vs ${m.awayTeam}\n` +
        `　🕐 ${time}\n` +
        `　📊 ${oddsLines.join("\n　")}`
      )
    })

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("📡 賽程同步完成")
      .setDescription(`成功同步 ${records.length} 場比賽至資料庫：\n\n${matchLines.join("\n\n")}`)
      .setFooter({ text: `來源：香港賽馬會` })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /match 執行錯誤:", error)
    const content = "❌ 同步賽程時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

async function handleRefreshMatch(
  interaction: ButtonInteraction
): Promise<void> {
  try {
    await interaction.deferUpdate()

    const matches = await queryUpcomingMatches()
    if (matches.length === 0) {
      await interaction.editReply({ content: "📭 目前沒有即將到來的賽程。", embeds: [], components: [] })
      return
    }

    const embed = buildMatchEmbed(matches)
    const row = buildMatchActionRow()
    await interaction.editReply({ embeds: [embed], components: [row] })
  } catch (error) {
    console.error("❌ 重新整理賽程錯誤:", error)
    await interaction.editReply({ content: "❌ 重新整理時發生錯誤。", embeds: [], components: [] })
  }
}

async function queryUpcomingMatches() {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  let matches = await prisma.match.findMany({
    where: {
      status: { in: ["scheduled", "live"] },
      startTime: { gte: startOfToday, lte: endOfToday },
    },
    orderBy: { startTime: "asc" },
  })

  if (matches.length === 0) {
    const startOfTomorrow = new Date()
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1)
    startOfTomorrow.setHours(0, 0, 0, 0)
    const endOfTomorrow = new Date()
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1)
    endOfTomorrow.setHours(23, 59, 59, 999)

    matches = await prisma.match.findMany({
      where: {
        status: { in: ["scheduled", "live"] },
        startTime: { gte: startOfTomorrow, lte: endOfTomorrow },
      },
      orderBy: { startTime: "asc" },
    })
  }

  return matches
}

function buildMatchEmbed(matches: Awaited<ReturnType<typeof queryUpcomingMatches>>): EmbedBuilder {
  const matchLines = matches.map((m, i) => {
    const oddsData = m.oddsData as Record<string, unknown> | null
    const oddsLines: string[] = []
    if (oddsData) {
      const had = oddsData["HAD"] as
        | { combinations?: Array<{ str: string; odds: number }> }
        | undefined
      if (had?.combinations) {
        const home = had.combinations.find((c) => c.str === "H")
        const draw = had.combinations.find((c) => c.str === "D")
        const away = had.combinations.find((c) => c.str === "A")
        oddsLines.push(
          `主 ${home?.odds.toFixed(2) ?? "—"} | ` +
          `和 ${draw?.odds.toFixed(2) ?? "—"} | ` +
          `客 ${away?.odds.toFixed(2) ?? "—"}`
        )
      }

      const hdc = oddsData["HDC"] as
        | { combinations?: Array<{ str: string; odds: number; status: string; condition?: string }> }
        | undefined
      const hdcCombos = hdc?.combinations
      if (hdcCombos) {
        const conds = [...new Set(hdcCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
        const condsShown = conds.slice(0, 2)
        const hdcParts = condsShown.map((cond) => {
          const h = hdcCombos.find((c) => c.condition === cond && c.str === "H")
          const a = hdcCombos.find((c) => c.condition === cond && c.str === "A")
          return `主 ${cond} (${h?.odds.toFixed(2) ?? "—"}) | 客 ${flipCondition(cond)} (${a?.odds.toFixed(2) ?? "—"})`
        })
        const hdcSuffix = conds.length > 2 ? ` ...共 ${conds.length} 個盤口` : ""
        if (hdcParts.length > 0) {
          oddsLines.push(`⚖️ ${hdcParts.join(" | ")}${hdcSuffix}`)
        }
        }

        const hha = oddsData["HHA"] as
          | { combinations?: Array<{ str: string; odds: number; status: string; condition?: string }> }
          | undefined
        const hhaCombos = hha?.combinations
        if (hhaCombos) {
          const conds = [...new Set(hhaCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
          const condsShown = conds.slice(0, 2)
          const hhaParts = condsShown.map((cond) => {
            const h = hhaCombos.find((c) => c.condition === cond && c.str === "H")
            const d = hhaCombos.find((c) => c.condition === cond && c.str === "D")
            const a = hhaCombos.find((c) => c.condition === cond && c.str === "A")
            return `主 ${cond} (${h?.odds.toFixed(2) ?? "—"}) | 和 (${d?.odds.toFixed(2) ?? "—"}) | 客 ${flipCondition(cond)} (${a?.odds.toFixed(2) ?? "—"})`
          })
          if (hhaParts.length > 0) {
            oddsLines.push(`🏟️ ${hhaParts.join(" | ")}`)
          }
        }

        const hil = oddsData["HIL"] as
          | { combinations?: Array<{ str: string; odds: number; status: string; condition?: string }> }
          | undefined
        const hilCombos = hil?.combinations
        if (hilCombos) {
          const conds = [...new Set(hilCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
          const condsShown = conds.slice(0, 2)
          const hilParts = condsShown.map((cond) => {
            const h = hilCombos.find((c) => c.condition === cond && c.str === "H")
            const l = hilCombos.find((c) => c.condition === cond && c.str === "L")
            return `大 ${cond} (${h?.odds.toFixed(2) ?? "—"}) | 細 ${cond} (${l?.odds.toFixed(2) ?? "—"})`
          })
          if (hilParts.length > 0) {
            oddsLines.push(`⚽ ${hilParts.join(" | ")}`)
          }
        }

        const chd = oddsData["CHD"] as
          | { combinations?: Array<{ str: string; odds: number; status: string; condition?: string }> }
          | undefined
        const chdCombos = chd?.combinations
        if (chdCombos) {
          const avail = chdCombos.filter(c => c.status === "AVAILABLE")
          const chdParts = avail.slice(0, 4).map((c) => {
            const teamName = c.str === "H" ? m.homeTeam : m.awayTeam
            const cond = c.str === "H" ? c.condition : (c.condition ? flipCondition(c.condition) : undefined)
            const suffix = cond ? ` ${cond}` : ""
            return `${teamName}${suffix} (${c.odds.toFixed(2)})`
          })
          if (chdParts.length > 0) {
            oddsLines.push(`🏳️ ${chdParts.join(" | ")}`)
          }
        }

        const chl = oddsData["CHL"] as
          | { combinations?: Array<{ str: string; odds: number; status: string; condition?: string }> }
          | undefined
        const chlCombos = chl?.combinations
        if (chlCombos) {
          const conds = [...new Set(chlCombos.filter(c => c.status === "AVAILABLE" && c.condition).map(c => c.condition!))]
          const condsShown = conds.slice(0, 2)
          const chlParts = condsShown.map((cond) => {
            const h = chlCombos.find((c) => c.condition === cond && c.str === "H")
            const l = chlCombos.find((c) => c.condition === cond && c.str === "L")
            return `角大 ${cond} (${h?.odds.toFixed(2) ?? "—"}) | 角細 ${cond} (${l?.odds.toFixed(2) ?? "—"})`
          })
          if (chlParts.length > 0) {
            oddsLines.push(`🪣 ${chlParts.join(" | ")}`)
          }
        }
      }
      const time = m.startTime.toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    return (
      `**#${i + 1}** ${m.homeTeam} vs ${m.awayTeam}\n` +
      `　🕐 ${time}\n` +
      `　📊 ${oddsLines.join("\n　")}`
    )
  })

  return new EmbedBuilder()
    .setColor(0x00aaff)
    .setTitle("📅 即將到來的賽程")
    .setDescription(matchLines.join("\n\n"))
    .setFooter({ text: "可使用 /bet place 或 /bet other 進行下注" })
    .setTimestamp()
}

function buildMatchActionRow(): ActionRowBuilder<ButtonBuilder> {
  const refreshButton = new ButtonBuilder()
    .setCustomId("refresh_match")
    .setLabel("🔄 重新整理")
    .setStyle(ButtonStyle.Primary)

  return new ActionRowBuilder<ButtonBuilder>().addComponents(refreshButton)
}

// ─── /analyst ──────────────────────────────────────────────────────────────

async function handleAnalyst(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  const subcommand = interaction.options.getSubcommand()

  try {
    switch (subcommand) {
      case "run":
        await handleAnalystRun(interaction)
        break
      case "match":
        await handleAnalystMatch(interaction)
        break
    }
  } catch (error) {
    console.error(`❌ /analyst ${subcommand} 執行錯誤:`, error)
    const content = "❌ 執行分析操作時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else if (!interaction.replied) {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

async function handleAnalystRun(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply()

  const matches = await queryUpcomingMatches()

  if (matches.length === 0) {
    await interaction.editReply(
      "❌ 目前沒有待分析的賽程。請先執行 `/match` 拉取賽程。"
    )
    return
  }

  await analyzeAndPost(interaction.client, matches)

  await interaction.editReply(
    `✅ 分析完成！已將 ${matches.length} 場報告送至 <#${process.env.DAILY_PICKS_CHANNEL_ID}>。`
  )
}

async function handleAnalystMatch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  await interaction.deferReply()

  const matchId = interaction.options.getString("match_id", true)
  const match = await prisma.match.findUnique({ where: { id: matchId } })

  if (!match) {
    await interaction.editReply("❌ 找不到該比賽。")
    return
  }

  const channelId = process.env.DAILY_PICKS_CHANNEL_ID
  if (!channelId) {
    await interaction.editReply("❌ 未設定 DAILY_PICKS_CHANNEL_ID。")
    return
  }

  const channel = (await interaction.client.channels.fetch(channelId)) as TextChannel
  if (!channel) {
    await interaction.editReply(`❌ 找不到頻道 ${channelId}。`)
    return
  }

  await analyzeSingleMatch(match, channel)

  await interaction.editReply(
    `✅ 分析完成！已將 **${match.homeTeam} vs ${match.awayTeam}** 的報告送至 <#${channelId}>。`
  )
}

// ─── /help ────────────────────────────────────────────────────────────────

async function handleHelp(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { discordId: interaction.user.id },
  })
  const isAdmin = user?.role === "ADMIN"

  const generalCommands = [
    "**`/login <username> <password>`** — 登入或註冊帳號",
    "**`/stat`** — 查詢個人下注統計與累計盈虧",
    "**`/bet place <prediction> <amount>`** — 對比賽下注（6 種玩法：主客和、讓球、讓球主客和、入球大細、角球讓球、角球大細）",
    "**`/bet other <odds> <amount> [prediction]`** — 手動輸入賠率下注",
    "**`/bet history [page]`** — 查看個人下注紀錄",
    "**`/rank`** — 查看所有用戶排行榜 Top 10",
    "**`/match`** — 從 HKJC 同步世界盃賽程與賠率",
    "**`/help`** — 顯示此說明",
  ]

  const adminCommands = [
    "**`/admin add <username> <password>`** — 新增用戶",
    "**`/admin activate <username>`** — 啟用用戶",
    "**`/admin deactivate <username>`** — 停用用戶",
    "**`/admin list`** — 列出所有用戶",
    "**`/admin resetpw <username> <new_password>`** — 重設密碼",
    "**`/admin delete <username>`** — 刪除用戶及下注紀錄",
    "**`/admin bet-place`** — 代用戶下注（6 種玩法）",
    "**`/admin bet-other`** — 代用戶手動賠率下注",
    "**`/analyst run`** — 對明日比賽執行 DeepSeek AI 分析",
    "**`/analyst match`** — 分析指定單場賽事",
    "**`/match`** — 同步賽程與賠率",
    "**`/check list`** — 查看所有 pending 下注",
    "**`/check win <bet_id>`** — 手動標記下注獲勝",
    "**`/check loss <bet_id>`** — 手動標記下注失敗",
    "**`/check stop <bet_id> <refund>`** — 標記 check stop，退還部分金額",
  ]

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📖 指令說明")
    .addFields(
      {
        name: "👤 一般指令",
        value: generalCommands.join("\n"),
        inline: false,
      },
      ...(isAdmin
        ? [
            {
              name: "👑 管理員指令",
              value: adminCommands.join("\n"),
              inline: false,
            },
          ]
        : [])
    )
    .setTimestamp()

  await interaction.reply({ embeds: [embed], ephemeral: true })
}

// ─── /check ────────────────────────────────────────────────────────────────

async function handleCheck(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  const subcommand = interaction.options.getSubcommand()

  switch (subcommand) {
    case "list":
      await handleCheckList(interaction)
      break
    case "win":
      await handleCheckWin(interaction)
      break
    case "loss":
      await handleCheckLoss(interaction)
      break
    case "stop":
      await handleCheckStop(interaction)
      break
  }
}

async function handleCheckList(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const pendingBets = await prisma.bet.findMany({
      where: { status: "pending" },
      include: {
        match: true,
        user: { select: { username: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    if (pendingBets.length === 0) {
      await interaction.reply({
        content: "✅ 目前沒有 pending 的下注。",
        ephemeral: true,
      })
      return
    }

    const lines = pendingBets.map((b) => {
      const match = b.match
      const scoreText = match.result || "尚無比分"
      const matchStr = `${match.homeTeam} vs ${match.awayTeam} (${scoreText})`
      return (
        `**ID:** \`${b.id}\`\n` +
        `　👤 ${b.user.username} | 🏟 ${matchStr}\n` +
        `　🎯 玩法: ${b.betType} | 預測: ${b.prediction} | 賠率: ${b.odds.toFixed(2)} | 金額: $${b.amount.toLocaleString()}`
      )
    })

    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle(`📋 Pending 下注 (${pendingBets.length} 筆)`)
      .setDescription(lines.join("\n\n"))
      .setFooter({ text: "使用 /check win <id> 或 /check loss <id> 判定輸贏" })
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: true })
  } catch (error) {
    console.error("❌ /check list 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 查詢下注時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

async function handleCheckWin(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const betId = interaction.options.getString("bet_id", true)

    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { match: true, user: true },
    })

    if (!bet) {
      await interaction.reply({
        content: "❌ 找不到該下注，請確認 ID 是否正確。",
        ephemeral: true,
      })
      return
    }

    if (bet.status !== "pending") {
      await interaction.reply({
        content: `❌ 該下注狀態為 \`${bet.status}\`，無法修改。`,
        ephemeral: true,
      })
      return
    }

    const profit = bet.amount * (bet.odds - 1)

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: "won" },
      }),
      prisma.user.update({
        where: { id: bet.userId },
        data: {
          totalWon: { increment: 1 },
          totalProfit: { increment: profit },
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle("✅ 已標記為獲勝")
      .addFields(
        { name: "用戶", value: bet.user.username, inline: true },
        { name: "比賽", value: `${bet.match.homeTeam} vs ${bet.match.awayTeam}`, inline: true },
        { name: "盈虧", value: `+$${profit.toFixed(2)}`, inline: true }
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: true })
  } catch (error) {
    console.error("❌ /check win 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 操作時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

async function handleCheckLoss(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const betId = interaction.options.getString("bet_id", true)

    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { match: true, user: true },
    })

    if (!bet) {
      await interaction.reply({
        content: "❌ 找不到該下注，請確認 ID 是否正確。",
        ephemeral: true,
      })
      return
    }

    if (bet.status !== "pending") {
      await interaction.reply({
        content: `❌ 該下注狀態為 \`${bet.status}\`，無法修改。`,
        ephemeral: true,
      })
      return
    }

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: "lost" },
      }),
      prisma.user.update({
        where: { id: bet.userId },
        data: {
          totalLost: { increment: 1 },
          totalProfit: { decrement: bet.amount },
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("❌ 已標記為失敗")
      .addFields(
        { name: "用戶", value: bet.user.username, inline: true },
        { name: "比賽", value: `${bet.match.homeTeam} vs ${bet.match.awayTeam}`, inline: true },
        { name: "損失", value: `-$${bet.amount.toFixed(2)}`, inline: true }
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: true })
  } catch (error) {
    console.error("❌ /check loss 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 操作時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

// ─── /check stop ────────────────────────────────────────────────────────────

async function handleCheckStop(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    const betId = interaction.options.getString("bet_id", true)
    const refund = interaction.options.getNumber("refund", true)

    const bet = await prisma.bet.findUnique({
      where: { id: betId },
      include: { match: true, user: true },
    })

    if (!bet) {
      await interaction.reply({
        content: "❌ 找不到該下注，請確認 ID 是否正確。",
        ephemeral: true,
      })
      return
    }

    if (bet.status !== "pending") {
      await interaction.reply({
        content: `❌ 該下注狀態為 \`${bet.status}\`，無法修改。`,
        ephemeral: true,
      })
      return
    }

    const netLoss = bet.amount - refund

    await prisma.$transaction([
      prisma.bet.update({
        where: { id: bet.id },
        data: { status: "lost", refund },
      }),
      prisma.user.update({
        where: { id: bet.userId },
        data: {
          totalLost: { increment: 1 },
          totalProfit: { decrement: netLoss },
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0xff8800)
      .setTitle("⚠️ 已標記為 Check Stop")
      .addFields(
        { name: "用戶", value: bet.user.username, inline: true },
        { name: "比賽", value: `${bet.match.homeTeam} vs ${bet.match.awayTeam}`, inline: true },
        { name: "下注額", value: `$${bet.amount.toFixed(2)}`, inline: true },
        { name: "退款", value: `+$${refund.toFixed(2)}`, inline: true },
        { name: "淨虧損", value: `-$${netLoss.toFixed(2)}`, inline: true }
      )
      .setTimestamp()

    await interaction.reply({ embeds: [embed], ephemeral: true })
  } catch (error) {
    console.error("❌ /check stop 執行錯誤:", error)
    await interaction.reply({
      content: "❌ 操作時發生錯誤，請稍後再試。",
      ephemeral: true,
    })
  }
}

// ─── /fix ───────────────────────────────────────────────────────────────────

async function handleFix(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  const subcommand = interaction.options.getSubcommand()

  switch (subcommand) {
    case "profit":
      await handleFixProfit(interaction)
      break
  }
}

async function handleFixProfit(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true })

    const [users, allBets] = await Promise.all([
      prisma.user.findMany({ where: { status: "active" } }),
      prisma.bet.findMany({ include: { user: true } }),
    ])

    const betsByUser = new Map<string, (typeof allBets)[number][]>()
    for (const bet of allBets) {
      const arr = betsByUser.get(bet.userId) || []
      arr.push(bet)
      betsByUser.set(bet.userId, arr)
    }

    const rows: { username: string; oldProfit: number; newProfit: number; bets: number; won: number; lost: number }[] = []

    await prisma.$transaction(
      users.map((user) => {
        const bets = betsByUser.get(user.id) || []
        const totalBets = bets.length
        const totalWon = bets.filter((b) => b.status === "won").length
        const totalLost = bets.filter((b) => b.status === "lost").length
        let totalProfit = 0

        for (const bet of bets) {
          if (bet.status === "won") {
            totalProfit += bet.amount * (bet.odds - 1)
          } else if (bet.status === "lost") {
            const refund = bet.refund ?? 0
            totalProfit -= (bet.amount - refund)
          }
        }

        rows.push({
          username: user.username,
          oldProfit: user.totalProfit,
          newProfit: totalProfit,
          bets: totalBets,
          won: totalWon,
          lost: totalLost,
        })

        return prisma.user.update({
          where: { id: user.id },
          data: { totalBets, totalWon, totalLost, totalProfit },
        })
      })
    )

    const lines = rows.map(
      (r) =>
        `**${r.username}** — 下注 ${r.bets} | 勝 ${r.won} | 負 ${r.lost}\n` +
        `　Profit: ~~$${r.oldProfit.toFixed(2)}~~ → **$${r.newProfit.toFixed(2)}**`
    )

    const embed = new EmbedBuilder()
      .setColor(0x00ccff)
      .setTitle("🔧 /fix profit 完成")
      .setDescription(lines.join("\n"))
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /fix profit 執行錯誤:", error)
    await interaction.editReply({
      content: "❌ 操作時發生錯誤，請稍後再試。",
    })
  }
}

// ─── /admin bet-place ──────────────────────────────────────────────────────

async function handleAdminBetPlace(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    await interaction.deferReply()

    const username = interaction.options.getString("username", true)
    const matchId = interaction.options.getString("match", true)
    const betType = interaction.options.getString("type", true)
    const prediction = interaction.options.getString("prediction", true)
    const amount = interaction.options.getNumber("amount", true)
    const manualOdds = interaction.options.getNumber("odds", false)

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      await interaction.editReply(`❌ 找不到用戶 **${username}**。`)
      return
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      await interaction.editReply("❌ 找不到該比賽。")
      return
    }

    let betOdds = 2.0
    let predictionText = prediction
    const oddsData = match.oddsData as Record<string, unknown> | null

    if (betType === "HAD" && oddsData) {
      const had = oddsData["HAD"] as
        | { combinations?: Array<{ str: string; odds: number }> }
        | undefined
      if (had?.combinations) {
        const prefix = prediction === "home" ? "H" : prediction === "away" ? "A" : "D"
        const matchComb = had.combinations.find((c) => c.str === prefix)
        if (matchComb) {
          betOdds = matchComb.odds
        }
      }
      predictionText =
        prediction === "home"
          ? match.homeTeam
          : prediction === "away"
            ? match.awayTeam
            : "平手"
    }

    if (betType === "HDC" && oddsData) {
      const hdc = oddsData["HDC"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hdc?.combinations?.find(
        (c) => c.str === parts[0] && (!parts[1] || c.condition === parts[1])
      )
      if (matchComb) {
        betOdds = matchComb.odds
        const teamName = parts[0] === "H" ? match.homeTeam : match.awayTeam
        predictionText = matchComb.condition
          ? `${teamName} ${matchComb.condition}`
          : teamName
      }
    }

    if (betType === "HHA" && oddsData) {
      const hha = oddsData["HHA"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hha?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        const condLabel = matchComb.condition ?? ""
        if (parts[0] === "H") predictionText = `${match.homeTeam} ${condLabel}`
        else if (parts[0] === "D") predictionText = `和局 ${condLabel}`
        else if (parts[0] === "A") predictionText = `${match.awayTeam} ${condLabel}`
      }
    }

    if (betType === "HIL" && oddsData) {
      const hil = oddsData["HIL"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = hil?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        if (parts[0] === "H") predictionText = `大 ${parts[1]}`
        else if (parts[0] === "L") predictionText = `細 ${parts[1]}`
      }
    }

    if (betType === "CHD" && oddsData) {
      const chd = oddsData["CHD"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = chd?.combinations?.find(
        (c) => c.str === parts[0] && (!parts[1] || c.condition === parts[1])
      )
      if (matchComb) {
        betOdds = matchComb.odds
        const teamName = parts[0] === "H" ? match.homeTeam : match.awayTeam
        predictionText = matchComb.condition
          ? `${teamName} ${matchComb.condition}`
          : teamName
      }
    }

    if (betType === "CHL" && oddsData) {
      const chl = oddsData["CHL"] as
        | { combinations?: Array<{ str: string; name: string; odds: number; condition?: string }> }
        | undefined
      const parts = prediction.split("|")
      const matchComb = chl?.combinations?.find((c) => c.str === parts[0] && c.condition === parts[1])
      if (matchComb) {
        betOdds = matchComb.odds
        if (parts[0] === "H") predictionText = `角球大 ${parts[1]}`
        else if (parts[0] === "L") predictionText = `角球細 ${parts[1]}`
      }
    }

    if (manualOdds !== null) {
      betOdds = manualOdds
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totalBets: { increment: 1 } },
      }),
      prisma.bet.create({
        data: {
          userId: user.id,
          matchId: match.id,
          amount,
          odds: betOdds,
          betType,
          prediction,
          status: "pending",
        },
      }),
    ])

    const typeLabels: Record<string, string> = {
      HAD: "主客和",
      HDC: "讓球",
      HHA: "讓球主客和",
      HIL: "入球大細",
      CHD: "角球讓球",
      CHL: "角球大細",
    }

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("✅ 代用戶下注成功！")
      .addFields(
        { name: "用戶", value: user.username, inline: false },
        { name: "比賽", value: `${match.homeTeam} vs ${match.awayTeam}`, inline: false },
        { name: "玩法", value: typeLabels[betType] ?? betType, inline: true },
        { name: "預測", value: predictionText, inline: true },
        { name: "金額", value: `$${amount.toLocaleString()}`, inline: true },
        { name: "賠率", value: betOdds.toFixed(2), inline: true }
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /admin bet-place 執行錯誤:", error)
    const content = "❌ 下注時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

// ─── /admin bet-other ──────────────────────────────────────────────────────

async function handleAdminBetOther(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    await interaction.deferReply()

    const username = interaction.options.getString("username", true)
    const matchId = interaction.options.getString("match", true)
    const manualOdds = interaction.options.getNumber("odds", true)
    const amount = interaction.options.getNumber("amount", true)
    const prediction = interaction.options.getString("prediction") ?? ""

    const user = await prisma.user.findUnique({ where: { username } })
    if (!user) {
      await interaction.editReply(`❌ 找不到用戶 **${username}**。`)
      return
    }

    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      await interaction.editReply("❌ 找不到該比賽。")
      return
    }

    const predictionText = prediction || "手動下注"

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { totalBets: { increment: 1 } },
      }),
      prisma.bet.create({
        data: {
          userId: user.id,
          matchId: match.id,
          amount,
          odds: manualOdds,
          betType: "OTHER",
          prediction,
          status: "pending",
        },
      }),
    ])

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("✅ 代用戶下注成功！")
      .addFields(
        { name: "用戶", value: user.username, inline: false },
        { name: "比賽", value: `${match.homeTeam} vs ${match.awayTeam}`, inline: false },
        { name: "玩法", value: "其他（手動賠率）", inline: true },
        { name: "預測", value: predictionText, inline: true },
        { name: "金額", value: `$${amount.toLocaleString()}`, inline: true },
        { name: "賠率", value: manualOdds.toFixed(2), inline: true }
      )
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /admin bet-other 執行錯誤:", error)
    const content = "❌ 下注時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}
