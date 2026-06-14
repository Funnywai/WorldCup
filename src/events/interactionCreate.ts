import {
  Interaction,
  EmbedBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js"
import prisma from "../db/prisma"
import { requireAuth, requireAdmin, hashPassword, verifyPassword } from "../services/auth"
import { fetchWorldCupMatches } from "../services/hkjc"
import { upsertMatchesToDb, analyzeAndPost, formatDate } from "../services/dailyAnalysis"

export async function onInteractionCreate(
  interaction: Interaction
): Promise<void> {
  if (interaction.isAutocomplete()) {
    await handleAutocomplete(interaction)
    return
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
    case "fetch":
      await handleFetch(interaction)
      break
    case "match":
      await handleMatch(interaction)
      break
    case "analyst":
      await handleAnalyst(interaction)
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
      const today = new Date()
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      const startOfDay = new Date(tomorrow)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(tomorrow)
      endOfDay.setHours(23, 59, 59, 999)

    const matches = await prisma.match.findMany({
      where: {
        startTime: { gte: startOfDay, lte: endOfDay },
        status: "scheduled",
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
    const prediction = interaction.options.getString("prediction", true)
    const amount = interaction.options.getNumber("amount", true)

    if (!user) return

    // 檢查比賽是否存在且狀態為 scheduled
    const match = await prisma.match.findUnique({ where: { id: matchId } })
    if (!match) {
      await interaction.editReply("❌ 找不到該比賽，請確認比賽 ID 是否正確。")
      return
    }
    if (match.status !== "scheduled") {
      await interaction.editReply("❌ 該比賽已開始或已結束，無法下注。")
      return
    }

    // 從 oddsData 中取得對應預測的即時賠率
    let betOdds = 2.0
    const oddsData = match.oddsData as Record<string, unknown> | null
    if (oddsData) {
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
    }

    const predictionText =
      prediction === "home"
        ? match.homeTeam
        : prediction === "away"
          ? match.awayTeam
          : "平手"

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

    const description = bets
      .map((bet, i) => {
        const match = bet.match
        const predictionText =
          bet.prediction === "home"
            ? match.homeTeam
            : bet.prediction === "away"
              ? match.awayTeam
              : "平手"
        return (
          `**#${skip + i + 1}** ${match.homeTeam} vs ${match.awayTeam}\n` +
          `　┗ 預測: ${predictionText} | 金額: $${bet.amount.toLocaleString()} | 賠率: ${bet.odds.toFixed(2)} | 狀態: ${statusText[bet.status]}\n` +
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

// ─── /fetch ────────────────────────────────────────────────────────────────

async function handleFetch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  try {
    await interaction.deferReply()

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = formatDate(tomorrow)

    console.log(`📡 [/fetch] 正在從 HKJC 抓取明日 (${dateStr}) 世界盃賽事...`)
    let matches = await fetchWorldCupMatches(dateStr, dateStr)

    if (matches.length === 0) {
      const futureDate = new Date(tomorrow)
      futureDate.setDate(futureDate.getDate() + 30)
      console.log(`📡 [/fetch] 明日無賽事，嘗試撈取未來 30 天 (${dateStr} ~ ${formatDate(futureDate)}) 世界盃賽事...`)
      matches = await fetchWorldCupMatches(dateStr, formatDate(futureDate))
    }

    if (matches.length === 0) {
      await interaction.editReply("📭 暫無世界盃賽程資料。")
      return
    }

    const records = await upsertMatchesToDb(matches)

    const matchLines = records.map((m, i) => {
      const oddsData = m.oddsData as Record<string, unknown> | null
      let oddsLine = "—"
      if (oddsData) {
        const had = oddsData["HAD"] as
          | { combinations?: Array<{ str: string; odds: number }> }
          | undefined
        if (had?.combinations) {
          const home = had.combinations.find((c) => c.str === "H")
          const draw = had.combinations.find((c) => c.str === "D")
          const away = had.combinations.find((c) => c.str === "A")
          oddsLine = `主 ${home?.odds.toFixed(2) ?? "—"} | ` +
            `和 ${draw?.odds.toFixed(2) ?? "—"} | ` +
            `客 ${away?.odds.toFixed(2) ?? "—"}`
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
        `　📊 ${oddsLine}`
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
    console.error("❌ /fetch 執行錯誤:", error)
    const content = "❌ 同步賽程時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

// ─── /match ────────────────────────────────────────────────────────────────

async function handleMatch(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  try {
    await interaction.deferReply()

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfDay = new Date(tomorrow)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(tomorrow)
    endOfDay.setHours(23, 59, 59, 999)

    const matches = await prisma.match.findMany({
      where: {
        startTime: { gte: startOfDay, lte: endOfDay },
        status: "scheduled",
      },
    })

    if (matches.length === 0) {
      await interaction.editReply("📭 明日沒有賽程。")
      return
    }

    const matchLines = matches.map((m, i) => {
      const oddsData = m.oddsData as Record<string, unknown> | null
      let oddsLine = "—"
      if (oddsData) {
        const had = oddsData["HAD"] as
          | { combinations?: Array<{ str: string; odds: number }> }
          | undefined
        if (had?.combinations) {
          const home = had.combinations.find((c) => c.str === "H")
          const draw = had.combinations.find((c) => c.str === "D")
          const away = had.combinations.find((c) => c.str === "A")
          oddsLine = `主 ${home?.odds.toFixed(2) ?? "—"} | ` +
            `和 ${draw?.odds.toFixed(2) ?? "—"} | ` +
            `客 ${away?.odds.toFixed(2) ?? "—"}`
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
        `　📊 ${oddsLine}`
      )
    })

    const embed = new EmbedBuilder()
      .setColor(0x00aaff)
      .setTitle("📅 明日世界盃賽程")
      .setDescription(matchLines.join("\n\n"))
      .setFooter({ text: "可使用 /bet place 進行下注" })
      .setTimestamp()

    await interaction.editReply({ embeds: [embed] })
  } catch (error) {
    console.error("❌ /match 執行錯誤:", error)
    const content = "❌ 查詢賽程時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
}

// ─── /analyst ──────────────────────────────────────────────────────────────

async function handleAnalyst(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!(await requireAdmin(interaction))) return

  try {
    await interaction.deferReply()

    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const startOfDay = new Date(tomorrow)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(tomorrow)
    endOfDay.setHours(23, 59, 59, 999)

    const matches = await prisma.match.findMany({
      where: {
        startTime: { gte: startOfDay, lte: endOfDay },
        status: "scheduled",
      },
    })

    if (matches.length === 0) {
      await interaction.editReply(
        "❌ 明日沒有待分析的世界盃賽程。請先執行 `/fetch` 拉取賽程。"
      )
      return
    }

    await analyzeAndPost(interaction.client, matches)

    await interaction.editReply(
      `✅ 分析完成！已將報告送至 <#${process.env.DAILY_PICKS_CHANNEL_ID}>。`
    )
  } catch (error) {
    console.error("❌ /analyst 執行錯誤:", error)
    const content = "❌ 執行分析時發生錯誤，請稍後再試。"
    if (interaction.deferred) {
      await interaction.editReply(content)
    } else {
      await interaction.reply({ content, ephemeral: true })
    }
  }
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
    "**`/match`** — 查看明日世界盃賽程與賠率",
    "**`/bet place <prediction> <amount>`** — 對比賽下注（從選單選擇比賽）",
    "**`/bet history [page]`** — 查看個人下注紀錄",
    "**`/rank`** — 查看所有用戶排行榜 Top 10",
    "**`/help`** — 顯示此說明",
  ]

  const adminCommands = [
    "**`/admin add <username> <password>`** — 新增用戶",
    "**`/admin activate <username>`** — 啟用用戶",
    "**`/admin deactivate <username>`** — 停用用戶",
    "**`/admin list`** — 列出所有用戶",
    "**`/admin resetpw <username> <new_password>`** — 重設密碼",
    "**`/admin delete <username>`** — 刪除用戶及下注紀錄",
    "**`/fetch`** — 從 HKJC 同步明日世界盃賽程與賠率",
    "**`/analyst`** — 對明日比賽執行 DeepSeek AI 分析",
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
