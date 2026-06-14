import { SlashCommandBuilder } from "discord.js"

export const matchCommand = new SlashCommandBuilder()
  .setName("match")
  .setDescription("查看即將到來的世界盃賽程與賠率")
