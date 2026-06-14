import { SlashCommandBuilder } from "discord.js"

export const fetchCommand = new SlashCommandBuilder()
  .setName("fetch")
  .setDescription("[管理員] 從 HKJC 同步明日世界盃賽程與賠率")
