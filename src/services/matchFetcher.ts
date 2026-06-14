export interface MatchFixture {
  homeTeam: string
  awayTeam: string
  tournamentName: string
  startTime: Date
  status: "scheduled" | "live" | "finished"
  result?: string
}

import { HkjcOddsPool } from "./hkjc"

export type { HkjcOddsPool, HkjcOddsCombination } from "./hkjc"
