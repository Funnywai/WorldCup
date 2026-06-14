import { SlashCommandBuilder } from "discord.js"

export const loginCommand = new SlashCommandBuilder()
  .setName("login")
  .setDescription("登入你的帳號以使用 Bot 功能（僅限 DM）")
  .addStringOption((opt) =>
    opt.setName("username").setDescription("你的帳號名稱").setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName("password").setDescription("你的密碼").setRequired(true)
  )
