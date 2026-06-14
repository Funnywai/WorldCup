# Role
You are an expert Full-Stack Node.js Developer, Discord.js (v14) Architect, and Database Engineer. We are practicing "vibe coding" — I will give you the high-level vision, and you will proactively implement the architecture, write the code, set up the database, and handle error edge cases. Do not ask for permission for minor details; make reasonable architectural decisions and explain them briefly.

# Project Overview
We are building a **World Cup 2026 Analyst & Betting Discord Bot**. 
The bot provides a simulated betting environment (virtual currency), automated daily match analysis using the **DeepSeek API**, and competitive leaderboards for users. It will be hosted locally on a Linux system for the long term.

# Tech Stack
- Runtime: Node.js (TypeScript preferred)
- Bot Framework: Discord.js (v14)
- Database: PostgreSQL with Prisma ORM
- Scheduling: node-cron (for daily scanning)
- AI Integration: DeepSeek API (using OpenAI Node.js SDK with DeepSeek base URL)
- Process Manager (Linux): PM2

# Core Features
## 1. Betting & Wallet System
- Users start with a default virtual balance (e.g., $10,000).
- Slash commands: 
  - `/wallet` (check balance & stats)
  - `/bet place` (select match, market, stake)
  - `/bet history` (view past bets and outcomes)
- Automatic payout calculation when match results are updated.

## 2. Daily Match Scanner & DeepSeek Analyst
- A cron job runs daily at a specific time (e.g., 08:00 AM).
- It fetches today's fixtures and basic stats (mock this data fetch function for now, or prepare a service file where I can inject a real Football API later).
- **DeepSeek Integration**: The bot formats the raw match data into a prompt and calls the DeepSeek API (`https://api.deepseek.com`) to generate a professional, data-driven football analysis and betting advice (in Traditional Chinese).
- The bot sends this DeepSeek-generated analysis as a nicely formatted Discord Embed to a designated `#daily-picks` channel.

## 3. Leaderboard System
- Slash commands to show top players:
  - `/leaderboard profit` (Total Net Profit)
  - `/leaderboard winrate` (Win Rate %)
- The leaderboard should be visually appealing using Discord Embeds.

# Database Schema Requirements (Prisma)
Please create a Prisma schema with at least these models:
1. `User`: discordId, balance, totalBets, totalWon, totalLost, createdAt
2. `Match`: id, homeTeam, awayTeam, startTime, status (scheduled, live, finished), result
3. `Bet`: id, userId, matchId, amount, odds, prediction, status (pending, won, lost)
4. `AnalysisLog`: matchId, deepseekOutput, createdAt

# Linux Deployment Setup
- Ensure the project has standard npm scripts (`build`, `start`, `dev`).
- Generate an `ecosystem.config.js` file for PM2 so the bot can run persistently in the background on a Linux server. Includes env vars configuration, log paths, and auto-restart rules.

# Execution Steps
Please execute the project in the following phases. Stop and ask for my review after completing each phase.

**Phase 1: Project Setup & Database**
- Initialize npm, TypeScript, and install dependencies (Discord.js, Prisma, pg, dotenv, openai, node-cron).
- Initialize Prisma and create the `schema.prisma`.
- Create a clear folder structure (`src/commands`, `src/events`, `src/services`, `src/db`).

**Phase 2: Core Bot & Betting System**
- Set up the Discord client and command handler.
- Implement `/wallet`, `/bet place`, and `/bet history`.

**Phase 3: DeepSeek Analyst Pipeline**
- Create the DeepSeek API service (using OpenAI SDK configured for DeepSeek).
- Create the cron job that triggers the analysis and formats the output into a Discord Embed.

**Phase 4: Leaderboard & Linux PM2 Setup**
- Implement the `/leaderboard` commands.
- Provide the `ecosystem.config.js` and a brief `DEPLOY.md` with PM2 start commands.

# Code Style & Rules
- Use modern ES6+ / TypeScript syntax.
- Fail loud: Catch errors gracefully but log them clearly in the console.
- Extract strings/configurations into environment variables (`.env`).
- Ensure Discord API limits are respected (use deferReply for API calls like DeepSeek).
- Write comments explaining the "why" behind complex logic, especially the betting math and API integration.