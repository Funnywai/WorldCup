# hkjc-api 資料參考 (v1.0.5)

## FootballAPI

### 建構子

```ts
import { FootballAPI } from "hkjc-api"
const api = new FootballAPI()      // 使用預設 endpoint
```

---

### 方法與查詢結構

#### 1. `getAllFootballMatches(options?)` → `Promise<FootballMatch[]>`

批量獲取賽事 + 賠率（支援 filter by date / tournament / matchId）。

```ts
interface FootballMatchesOptions {
  startDate?: string | null       // YYYY-MM-DD
  endDate?: string | null
  tournIds?: string[] | null
  matchIds?: string[] | null
  oddsTypes?: FootballOddsType[]  // 預設 DEFAULT_FOOTBALL_ODDS_TYPES
  featuredMatchesOnly?: boolean
  frontEndIds?: string[] | null
  earlySettlementOnly?: boolean
  showAllMatch?: boolean
  startIndex?: number | null
  endIndex?: number | null
}
```

**GraphQL:** `footballMatchesQuery` — 查詢 `matches()` + `foPools()`。

#### 2. `getFootballMatchDetails(matchId, oddsTypes?)` → `Promise<FootballMatch | null>`

單一 matchId 賽事詳細 + 賠率。同 query 結構。

> **本專案現狀：** ❌ 未使用

#### 3. `getRunningMatch(matchId)` → `Promise<FootballMatch[]>`

即時賽事專用（`inplayOnly: true`）。只用 `DEFAULT_FOOTBALL_ODDS_TYPES`（HAD/HDC/HIL/CRS）。

> **本專案現狀：** ✅ 已使用（`fetchRunningMatches`）

#### 4. `searchHistoricFootballMatches(options?)` → `Promise<HistoricFootballMatchesResult>`

```ts
interface HistoricFootballMatchesOptions {
  startDate?: string | null
  endDate?: string | null
  startIndex?: number | null
  endIndex?: number | null
  teamId?: string | null
}
```

回傳含 `timeOffset`、`matchNumByDate`、`matches[]` 的結果物件。

> **本專案現狀：** ❌ 未使用

#### 5. `getHistoricFootballMatches(options?)` → `Promise<HistoricFootballMatch[]>`

同 `searchHistoricFootballMatches`，但只回傳 `matches[]`（去掉 metadata）。

> **本專案現狀：** ❌ 未使用

#### 6. `getHistoricFootballMatchDetails(matchId, oddsTypes?)` → `Promise<HistoricFootballMatchDetails | null>`

歷史賽事結果賠率（resultOnly 模式）。每個 pool 的 `combinations` 附帶 `winOrd`（派彩順序）。

> **本專案現狀：** ❌ 未使用

---

### FootballMatch 回傳結構說明

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 賽事 ID（如 `"388254517545766912"`） |
| `frontEndId` | string | 前台 ID |
| `matchDate` | string | 賽事日期（YYYY-MM-DD） |
| `kickOffTime` | string | ISO 時間 |
| `status` | string | `Scheduled` / `Live` / `Running` / `Finished` / `Paying`... |
| `homeTeam` | `FootballTeam` | `{ id, name_en, name_ch }` |
| `awayTeam` | `FootballTeam` | `{ id, name_en, name_ch }` |
| `tournament` | `Tournament` | `{ id, code, name_en, name_ch, frontEndId, nameProfileId }` |
| `venue` | `{ code, name_en, name_ch }` | 場地 |
| `tvChannels` | `{ code, name_en, name_ch }[]` | 電視轉播 |
| `liveEvents` | `{ id, code }[]` | 直播事件 |
| `poolInfo` | `PoolInfo` | `{ normalPools[], inplayPools[], sellingPools[], definedPools[], ntsInfo[], entInfo[] }` |
| `runningResult` | `RunningResult \| null` | `{ homeScore, awayScore, corner, homeCorner, awayCorner }` |
| `runningResultExtra` | `RunningResult \| null` | 同上（延時數據） |
| `foPools` | `FootballPool[]` | 賠率資料（依 `fbOddsTypes` 參數決定回傳哪些） |

### FootballPool (foPools) 賠率結構

```ts
interface FootballPool {
  id: string
  status: string
  oddsType: string          // 如 "HAD", "HDC"
  instNo: number
  inplay: boolean
  name_ch: string           // 中文名稱（部分新增玩法回傳空字串）
  name_en: string           // 英文名稱
  updateAt: string
  expectedSuspendDateTime: string
  lines: OddsLine[]         // 盤口行
}

interface OddsLine {
  lineId: string
  status: string            // "AVAILABLE" / "SUSPENDED"
  condition: string         // 讓球值：如 "-0.5", "+1.0", "2.5"（大細界線）
  main: boolean             // 是否為主盤口
  combinations: Combination[]
}

interface Combination {
  combId: string
  str: string               // H=主隊, D=和, A=客隊, L=細
  status: string
  offerEarlySettlement: string
  currentOdds: string       // 賠率字串（如 "3.25"）
  selections: Selection[]
}

interface Selection {
  selId: string
  str: string
  name_ch: string
  name_en: string
}
```

---

## HorseRacingAPI

```ts
class HorseRacingAPI {
  getActiveMeetings(): Promise<RaceMeeting[]>
  getRace(raceNumber?: number): Promise<Race | null>
  getAllRaces(): Promise<RaceMeeting[]>
  getRaceOdds(raceNumber?: number, oddsTypes?: OddsType[]): Promise<any[]>
  getRacePools(raceNumber?: number, oddsTypes?: OddsType[]): Promise<any[]>
}
```

> **本專案現狀：** ❌ 完全未使用（賽馬無關）

---

## 賠率類型 (FootballOddsType) 完整一覽

### TypeScript 定義

```ts
type FootballOddsType = 'HAD' | 'EHA' | 'SGA' | 'CHP' | 'TQL' | 'FHA' | 'HHA'
  | 'HDC' | 'EDC' | 'HIL' | 'EHL' | 'FHL' | 'CHL' | 'ECH' | 'FCH' | 'CRS'
  | 'ECS' | 'FCS' | 'FTS' | 'TTG' | 'ETG' | 'OOE' | 'FGS' | 'HFT' | 'MSP'
  | 'NTS' | 'ENT' | 'FHH' | 'FHC' | 'CHD' | 'ECD' | 'EHH' | 'AGS' | 'LGS'
  | 'NGS' | 'ETS' | 'HLH' | 'HLA' | 'FLH' | 'FLA' | 'ELH' | 'ELA' | 'CHH'
  | 'CHA' | 'CFH' | 'CFA' | 'CEH' | 'CEA'
```

### 已知可用的 25 種（SUPPORTED_FOOTBALL_ODDS_TYPES）

下表列出 hkjc-api 作者測試過可正常回應的種類。**建議每次查詢 ≤ 4-5 種**。

| 代碼 | 中文名稱 | 玩法 | 本專案使用狀態 |
|------|----------|------|-------------|
| `HAD` | 主客和 | 1×2 勝平負 | **✅ 已使用** — fetch / display / bet / analysis / admin |
| `HDC` | 讓球 | 亞洲讓球盤 | **✅ 已使用** — fetch / display / bet / analysis / admin |
| `HIL` | 入球大細 | 總進球數大/小 | **✅ 已使用** — fetch / display / bet / analysis |
| `CRS` | 波膽 | 正確比分 | **⚠️ 有 fetch 但無任何下游邏輯**（不顯示、不下注、不分析） |
| `HHA` | 讓球主客和 | 讓球 + 主客和 | **✅ 已使用** — fetch / display / bet / analysis |
| `CHD` | 角球讓球 | 角球亞洲盤 | **✅ 已使用** — fetch / display / bet / analysis |
| `CHL` | 角球大細 | 總角球數大/小 | **✅ 已使用** — fetch / display / bet / analysis |
| `FHH` | 第一隊入球 | 主隊/客隊/無入球 | ❌ 未使用 |
| `FHC` | 最後入球隊伍 | 主隊/客隊/無入球 | ❌ 未使用 |
| `SGA` | 半場主客和 | 半場 1×2 | ❌ 未使用 |
| `CHP` | 冠軍 | 聯賽/盃賽冠軍 | ❌ 未使用 |
| `TQL` | — | 總入球數 | ❌ 未使用 |
| `FHA` | 首名入球 | 誰先入球 | ❌ 未使用 |
| `FHL` | 半場入球大細 | 半場大/小 | ❌ 未使用 |
| `FCH` | 半場角球大細 | 半場角球大/小 | ❌ 未使用 |
| `FCS` | 半場波膽 | 半場正確比分 | ❌ 未使用 |
| `FTS` | 首名入球時間 | 第幾分鐘首球 | ❌ 未使用 |
| `TTG` | 總入球數 | 0/1/2/3+ | ❌ 未使用 |
| `OOE` | 單雙 | 總入球數單/雙 | ❌ 未使用 |
| `FGS` | 最先入球時段 | 哪個時間段首球 | ❌ 未使用 |
| `HFT` | 半場/全場 | 半場+全場組合 | ❌ 未使用 |
| `MSP` | 最準確射手 | 誰進球最多 | ❌ 未使用 |
| `NTS` | 下一入球隊伍 | 誰進下一球 | ❌ 未使用 |
| `AGS` | 任何入球球員 | 球員進球是否 | ❌ 未使用 |
| `LGS` | 最後入球球員 | 最後進球球員 | ❌ 未使用 |

### 已知會遭 API 拒絕的棄用類型（DEPRECATED_FOOTBALL_ODDS_TYPES）

`EHA`, `EDC`, `EHL`, `ECH`, `ECS`, `ETG`, `ENT`, `ECD`, `EHH`

### 未列入 SUPPORTED 的其他類型

`NGS`, `ETS`, `HLH`, `HLA`, `FLH`, `FLA`, `ELH`, `ELA`, `CHH`, `CHA`, `CFH`, `CFA`, `CEH`, `CEA`

---

## 本專案 API 使用總表

| 方法 | 使用位置 | 用途 |
|------|----------|------|
| `api.getAllFootballMatches` | `hkjc.ts:39-41` | `fetchWorldCupMatches` — 批量抓世界盃賽事賠率 |
| `api.getRunningMatch` | `hkjc.ts:71` | `fetchRunningMatches` — 更新進行中比賽比數 |
| `api.getFootballMatchDetails` | ❌ 未使用 | 可備用於單場補查賠率 |
| `api.searchHistoricFootballMatches` | ❌ 未使用 | — |
| `api.getHistoricFootballMatches` | ❌ 未使用 | — |
| `api.getHistoricFootballMatchDetails` | ❌ 未使用 | — |

### 匯出自訂函式

| 函式 | 使用檔案 | 用途 |
|------|----------|------|
| `fetchWorldCupMatches` | `interactionCreate.ts`, `dailyAnalysis.ts` | 抓世界盃賽事 + 賠率 |
| `fetchRunningMatches` | `interactionCreate.ts` | 更新即時比數 |

### 匯出自訂型別

| 型別 | 用途 |
|------|------|
| `HkjcMatchData` | 封裝後的賽事資料 |
| `HkjcOddsPool` | 單一玩法賠率池 |
| `HkjcOddsCombination` | 單一選項賠率 |

---

## 常見限制

1. **每次查詢 ≤ 4-5 種 oddsTypes**，超過會觸發 `DOWNSTREAM_SERVICE_ERROR`
2. `HHA` / `CHD` / `CHL` / `HIL` 等新增類型的 `name_ch` / `name_en` 可能回傳空字串，需 hardcode 顯示名稱
3. `CHD` / `CHL` / `HIL` 的 `str` 使用 `"L"` 表示「細」（非 `"A"`）
4. `HHA` prediction 格式為 `str|condition`（如 `"H|-1.0"`）
