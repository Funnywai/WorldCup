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
      let line = `${i + 1}. ${m.homeTeam} vs ${m.awayTeam}（${m.startTime.toLocaleString("zh-TW", { timeZone: "Asia/Hong_Kong" })}）`
      if (m.oddsSummary) {
        line += `\n   賠率參考：${m.oddsSummary}`
      }
      return line
    })
    .join("\n")

  const isSingle = matches.length === 1

  const systemPrompt = isSingle
    ? `你是一位專業的足球分析師，擅長 2026 世界盃賽事分析與博弈預測。
請根據提供的賽程、歷史對戰紀錄與香港賽馬會（HKJC）賠率，生成一份專業分析報告。
報告必須使用**繁體中文**撰寫，嚴格遵循以下格式：

## 比賽分析：[主隊] vs [客隊]

### 1. 對戰分析
- **近期狀態**：兩隊近 5 場表現簡述
- **歷史對戰**：過往交鋒紀錄（若無則寫「兩隊無正式交鋒紀錄」）
- **關鍵球員**：各列出 1-2 名影響戰局的關鍵球員

### 2. 賠率解讀
- **標準盤（HAD）**：列出主勝/和局/客勝賠率，分析市場信號
- **讓球盤（HDC）**：列出主要讓球盤口與賠率，分析莊家意圖
- **盤口訊號**：總結莊家對比賽走向的判斷

### 3. 投注建議
- **穩健推薦**：風險最低的投注方向 + 賠率 + 簡述理由
- **進取推薦**：回報較高的投注方向 + 賠率 + 簡述理由（可選）
- **風險提示**：應避免的投注方向

### 4. 信心指數
使用 ★ 表示（1-5 星），對應上述每項推薦`
    : `你是一位專業的足球分析師，擅長 2026 世界盃賽事分析與博弈預測。
請根據提供的賽程、歷史對戰紀錄與香港賽馬會（HKJC）賠率，生成一份專業分析報告。
報告必須使用**繁體中文**撰寫。
請對每場比賽提供：
1. **對戰分析**：兩隊近期狀態、歷史對戰、關鍵球員
2. **賠率解讀**：分析莊家盤口走勢與市場信號
3. **投注建議**：推薦下注方向並簡述理由
4. **信心指數**：以 1-5 星表示
最後附上總體推薦摘要。`

  const prefix = isSingle ? "請分析以下比賽" : "今日賽程如下"
  let userPrompt = `${prefix}（所有時間為香港時間）：\n\n${matchList}`
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
