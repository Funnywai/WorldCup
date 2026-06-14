import bcrypt from "bcrypt"
import { ChatInputCommandInteraction } from "discord.js"
import prisma from "../db/prisma"

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * 指令守衛：檢查用戶是否已登入且狀態為 active
 * 回傳 user 記錄，或發送錯誤訊息後回傳 null
 */
export async function requireAuth(
  interaction: ChatInputCommandInteraction
): Promise<{
  id: string
  discordId: string | null
  username: string
  role: string
  status: string
  totalBets: number
  totalWon: number
  totalLost: number
  totalProfit: number
} | null> {
  const discordId = interaction.user.id

  const user = await prisma.user.findUnique({ where: { discordId } })

  if (!user) {
    await interaction.reply({
      content: "❌ 你尚未登入，請先使用 `/login` 登入。",
      ephemeral: true,
    })
    return null
  }

  if (user.status !== "active") {
    await interaction.reply({
      content: "❌ 你的帳號已被停用，請聯絡管理員。",
      ephemeral: true,
    })
    return null
  }

  return user
}

/**
 * 指令守衛：檢查用戶是否為 ADMIN
 */
export async function requireAdmin(
  interaction: ChatInputCommandInteraction
): Promise<boolean> {
  const user = await requireAuth(interaction)
  if (!user) return false

  if (user.role !== "ADMIN") {
    await interaction.reply({
      content: "❌ 此指令僅限管理員使用。",
      ephemeral: true,
    })
    return false
  }

  return true
}
