import { SlashCommandBuilder } from "discord.js"

export const helpCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("顯示所有可用指令說明")
