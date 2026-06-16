import { SlashCommandBuilder } from "discord.js"

export const adminCommand = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("管理員指令集")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("新增用戶")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("帳號名稱").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("password").setDescription("密碼").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("activate")
      .setDescription("啟用用戶")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("帳號名稱").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("deactivate")
      .setDescription("停用用戶")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("帳號名稱").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("列出所有用戶")
  )
  .addSubcommand((sub) =>
    sub
      .setName("resetpw")
      .setDescription("重置用戶密碼")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("帳號名稱").setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName("new_password").setDescription("新密碼").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("刪除用戶（含其所有下注紀錄）")
      .addStringOption((opt) =>
        opt.setName("username").setDescription("帳號名稱").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("bet-place")
      .setDescription("代用戶下注（主客和 / 讓球）")
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription("選擇用戶")
          .setRequired(true)
          .setAutocomplete(true)
      )
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
  )
  .addSubcommand((sub) =>
    sub
      .setName("bet-other")
      .setDescription("代用戶下注（手動輸入賠率）")
      .addStringOption((opt) =>
        opt
          .setName("username")
          .setDescription("選擇用戶")
          .setRequired(true)
          .setAutocomplete(true)
      )
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
