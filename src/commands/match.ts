import { SlashCommandBuilder } from "discord.js"

export const matchCommand = new SlashCommandBuilder()
  .setName("match")
  .setDescription("從 HKJC 同步世界盃賽程與賠率")
