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
