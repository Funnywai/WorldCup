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
  .addSubcommand((sub) =>
    sub
      .setName("bet-cancel")
      .setDescription("取消任一用戶的 pending 下注")
      .addStringOption((opt) =>
        opt
          .setName("bet_id")
          .setDescription("選擇要取消的 pending 下注")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("check-list").setDescription("列出所有 pending 的下注")
  )
  .addSubcommand((sub) =>
    sub
      .setName("check-win")
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
      .setName("check-loss")
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
      .setName("check-stop")
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
