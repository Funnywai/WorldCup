import { SlashCommandBuilder } from "discord.js"

export const checkCommand = new SlashCommandBuilder()
  .setName("check")
  .setDescription("[管理員] 查看所有 pending 下注並手動判定輸贏")
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("列出所有 pending 的下注")
  )
  .addSubcommand((sub) =>
    sub
      .setName("win")
      .setDescription("將下注標記為獲勝")
      .addStringOption((opt) =>
        opt
          .setName("bet_id")
          .setDescription("選擇 pending 下注")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("loss")
      .setDescription("將下注標記為失敗")
      .addStringOption((opt) =>
        opt
          .setName("bet_id")
          .setDescription("選擇 pending 下注")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("stop")
      .setDescription("將下注標記為 check stop，退還部分金額")
      .addStringOption((opt) =>
        opt
          .setName("bet_id")
          .setDescription("選擇 pending 下注")
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addNumberOption((opt) =>
        opt
          .setName("refund")
          .setDescription("退還金額")
          .setRequired(true)
          .setMinValue(0)
      )
  )
