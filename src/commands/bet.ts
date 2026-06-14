import { SlashCommandBuilder } from "discord.js"

export const betCommand = new SlashCommandBuilder()
  .setName("bet")
  .setDescription("下注系統")
  .addSubcommand((sub) =>
    sub
      .setName("place")
      .setDescription("對一場比賽進行下注")
      .addStringOption((opt) =>
        opt
          .setName("match")
          .setDescription("選擇比賽")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("prediction")
          .setDescription("預測結果")
          .setRequired(true)
          .addChoices(
            { name: "主隊勝", value: "home" },
            { name: "客隊勝", value: "away" },
            { name: "平手", value: "draw" }
          )
      )
      .addNumberOption((opt) =>
        opt
          .setName("amount")
          .setDescription("下注金額（用於計算盈虧）")
          .setRequired(true)
          .setMinValue(1)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("history")
      .setDescription("查詢你的過往下注紀錄")
      .addIntegerOption((opt) =>
        opt
          .setName("page")
          .setDescription("頁碼 (每頁 5 筆)")
          .setMinValue(1)
      )
  )
