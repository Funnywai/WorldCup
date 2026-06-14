import { SlashCommandBuilder } from "discord.js"

export const rankCommand = new SlashCommandBuilder()
  .setName("rank")
  .setDescription("顯示所有用戶的下注排行榜（Top 10）")
