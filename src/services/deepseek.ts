import OpenAI from "openai"

const deepseek = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
  timeout: 30000,
  maxRetries: 2,
})

interface MatchForAnalysis {
  homeTeam: string
  awayTeam: string
  startTime: Date
  oddsSummary?: string
}

/**
 * 呼叫 DeepSeek API 生成比賽分析與投注建議（繁體中文）
 */
export async function generateMatchAnalysis(
  matches: MatchForAnalysis[],
  historicalContext?: string
): Promise<string> {
  if (matches.length === 0) {
    return "今日沒有安排賽程。"
  }

  const matchList = matches
    .map((m, i) => {
      let line = `${i + 1}. ${m.homeTeam} vs ${m.awayTeam}（${m.startTime.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}）`
      if (m.oddsSummary) {
        line += `\n   賠率參考：${m.oddsSummary}`
      }
      return line
    })
    .join("\n")

  const systemPrompt = `你是一位專業的足球分析師，擅長 2026 世界盃賽事分析與博弈預測。
請根據提供的今日賽程、歷史對戰紀錄與香港賽馬會（HKJC）賠率，生成一份專業、數據導向的分析報告。
報告必須使用**繁體中文**撰寫。

# 輸出格式要求
請對每場比賽提供：
1. **對戰分析**：兩隊近期狀態、歷史對戰、關鍵球員
2. **賠率解讀**：根據提供的 HKJC 賠率，分析莊家盤口走勢與市場信號
3. **投注建議**：推薦下注方向（主勝/客勝/平手/讓球/大細），並簡述理由
4. **信心指數**：以 1-5 星表示對該推薦的信心程度

最後附上今日總體推薦摘要。`

  let userPrompt = `今日賽程如下（所有時間為台灣時間）：\n\n${matchList}`
  if (historicalContext) {
    userPrompt += `\n\n--- 歷史數據參考 ---\n${historicalContext}`
  }
  userPrompt += `\n\n請為以上比賽生成完整分析報告。`

  const response = await (deepseek.chat.completions.create as any)({
    model: "deepseek-v4-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.8,
    reasoning_effort: "high",
    max_tokens: 8192,
    extra_body: {
      thinking: { type: "enabled" },
    },
  })

  return response.choices[0]?.message?.content || "分析生成失敗，請稍後再試。"
}
