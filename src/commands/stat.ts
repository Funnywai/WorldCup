import { SlashCommandBuilder } from "discord.js"

export const statCommand = new SlashCommandBuilder()
  .setName("stat")
  .setDescription("查詢你的下注統計與累計盈虧")
