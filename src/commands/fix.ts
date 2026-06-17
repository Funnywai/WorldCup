import { SlashCommandBuilder } from "discord.js"

export const fixCommand = new SlashCommandBuilder()
  .setName("fix")
  .setDescription("[管理員] 修復工具")
  .addSubcommand((sub) =>
    sub.setName("profit").setDescription("從所有下注重新計算每位用戶的 totalProfit")
  )
