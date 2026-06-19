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
          .setName("type")
          .setDescription("玩法類型")
          .setRequired(true)
          .addChoices(
            { name: "主客和", value: "HAD" },
            { name: "讓球", value: "HDC" },
            { name: "讓球主客和", value: "HHA" },
            { name: "入球大細", value: "HIL" },
            { name: "角球讓球", value: "CHD" },
            { name: "角球大細", value: "CHL" }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("prediction")
          .setDescription("預測選項")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addNumberOption((opt) =>
        opt
          .setName("amount")
          .setDescription("下注金額（用於計算盈虧）")
          .setRequired(true)
          .setMinValue(1)
      )
      .addNumberOption((opt) =>
        opt
          .setName("odds")
          .setDescription("手動輸入賠率（選填，優先於系統賠率）")
          .setRequired(false)
          .setMinValue(1.01)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("other")
      .setDescription("手動輸入賠率下注")
      .addStringOption((opt) =>
        opt
          .setName("match")
          .setDescription("選擇比賽")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addNumberOption((opt) =>
        opt
          .setName("odds")
          .setDescription("手動輸入賠率（如 2.50）")
          .setRequired(true)
          .setMinValue(0.01)
      )
      .addNumberOption((opt) =>
        opt
          .setName("amount")
          .setDescription("下注金額（用於計算盈虧）")
          .setRequired(true)
          .setMinValue(1)
      )
      .addStringOption((opt) =>
        opt
          .setName("prediction")
          .setDescription("自訂預測文字（選填，如「巴西勝」）")
          .setRequired(false)
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
  .addSubcommand((sub) =>
    sub
      .setName("cancel")
      .setDescription("取消一筆 pending 下注")
      .addStringOption((opt) =>
        opt
          .setName("bet_id")
          .setDescription("選擇要取消的 pending 下注")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
