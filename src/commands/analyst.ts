import { SlashCommandBuilder } from "discord.js"

export const analystCommand = new SlashCommandBuilder()
  .setName("analyst")
  .setDescription("[管理員] 對明日比賽執行 AI 分析並發送至頻道")
