import { SlashCommandBuilder } from "discord.js"

export const analystCommand = new SlashCommandBuilder()
  .setName("analyst")
  .setDescription("[管理員] AI 分析與歷史查詢")
  .addSubcommand((sub) =>
    sub.setName("run").setDescription("分析所有待分析比賽並發送至頻道")
  )
  .addSubcommand((sub) =>
    sub
      .setName("match")
      .setDescription("分析指定比賽")
      .addStringOption((opt) =>
        opt
          .setName("match_id")
          .setDescription("選擇比賽")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
