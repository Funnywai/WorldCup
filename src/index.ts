import { Client, GatewayIntentBits } from "discord.js"
import dotenv from "dotenv"
import { registerCommands } from "./events/ready"
import { onInteractionCreate } from "./events/interactionCreate"
import { startDailyAnalysisCron, startMatchFetchCron } from "./services/dailyAnalysis"

dotenv.config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

client.once("ready", async (readyClient) => {
  console.log(`🤖 已登入為 ${readyClient.user.tag}`)
  await registerCommands(readyClient)
  startDailyAnalysisCron(readyClient)
  startMatchFetchCron()
})

client.on("interactionCreate", onInteractionCreate)

client.login(process.env.DISCORD_TOKEN).catch((error) => {
  console.error("❌ Bot 登入失敗:", error)
  process.exit(1)
})
