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
  .addSubcommand((sub) =>
    sub
      .setName("history")
      .setDescription("查詢分析歷史紀錄")
      .addIntegerOption((opt) =>
        opt.setName("page").setDescription("頁碼（預設第 1 頁）").setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("result")
      .setDescription("標記 AI 分析預測結果")
      .addStringOption((opt) =>
        opt
          .setName("analysis_id")
          .setDescription("選擇分析紀錄")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("outcome")
          .setDescription("預測結果")
          .setRequired(true)
          .addChoices(
            { name: "✅ 正確 (Won)", value: "won" },
            { name: "❌ 錯誤 (Lost)", value: "lost" }
          )
      )
  )
