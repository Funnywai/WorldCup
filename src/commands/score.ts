import { SlashCommandBuilder } from "discord.js"

export const scoreCommand = new SlashCommandBuilder()
  .setName("score")
  .setDescription("[管理員] 更新過期比賽為 finished 並補上最終比分")
