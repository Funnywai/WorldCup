import { Client, REST, Routes } from "discord.js"
import { statCommand } from "../commands/stat"
import { betCommand } from "../commands/bet"
import { loginCommand } from "../commands/login"
import { adminCommand } from "../commands/admin"
import { rankCommand } from "../commands/rank"
import { helpCommand } from "../commands/help"
import { matchCommand } from "../commands/match"
import { analystCommand } from "../commands/analyst"

const commands = [
  loginCommand,
  statCommand,
  betCommand,
  adminCommand,
  rankCommand,
  helpCommand,
  matchCommand,
  analystCommand,
].map((cmd) => cmd.toJSON())

export async function registerCommands(client: Client): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!)

  try {
    console.log("⏳ 正在註冊 Slash Commands...")

    const guildId = process.env.GUILD_ID
    if (guildId) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID!, guildId),
        { body: commands }
      )
      console.log(`✅ Slash Commands 已註冊至 Guild ${guildId}`)
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), {
        body: commands,
      })
      console.log("✅ Slash Commands 已全域註冊（約 1 小時後生效）")
    }
  } catch (error) {
    console.error("❌ Slash Commands 註冊失敗:", error)
  }
}
