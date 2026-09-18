/**
 * tools/sim.ts
 *
 * 헤드리스 밸런스 시뮬레이터 (T-20, NFR-04).
 * 브라우저 없이 봇 2종(신중형/공격형)으로 각 1,000런을 돌려 승률·평균
 * 생존 밤·패배 원인 분포·평균 최대 열기를 콘솔 표로 출력한다.
 *
 * 실행: npm run sim
 */

import { AGGRESSIVE_BOT, CAREFUL_BOT } from './bots';
import type { BotConfig } from './bots';
import { simulateOneRun } from './simulateRun';
import type { RunStats } from './simulateRun';
import type { RunEndReason } from '../src/core/types';

const RUNS_PER_BOT = 1000;

function runBotSimulation(bot: BotConfig, runs: number): RunStats[] {
  const results: RunStats[] = [];
  for (let i = 0; i < runs; i++) {
    results.push(simulateOneRun(`sim-${bot.name}-${i}`, bot));
  }
  return results;
}

interface SummaryRow {
  readonly 봇: string;
  readonly '런 수': number;
  readonly 승률: string;
  readonly '평균 생존 밤': string;
  readonly '평균 최대 열기': string;
}

function summarize(bot: BotConfig, results: RunStats[]): SummaryRow {
  const wins = results.filter((r) => r.isVictory).length;
  const avgNights = results.reduce((sum, r) => sum + r.survivedNights, 0) / results.length;
  const avgPeakHeat = results.reduce((sum, r) => sum + r.peakHeat, 0) / results.length;

  return {
    봇: bot.name,
    '런 수': results.length,
    승률: `${((wins / results.length) * 100).toFixed(1)}%`,
    '평균 생존 밤': avgNights.toFixed(1),
    '평균 최대 열기': avgPeakHeat.toFixed(1),
  };
}

function countEndReasons(results: RunStats[]): Record<RunEndReason, number> {
  const counts = {} as Record<RunEndReason, number>;
  for (const r of results) {
    counts[r.endReason] = (counts[r.endReason] ?? 0) + 1;
  }
  return counts;
}

function toPercentTable(
  countsByBot: Record<string, Record<RunEndReason, number>>,
  totalRuns: number,
): Record<string, Record<string, string>> {
  const table: Record<string, Record<string, string>> = {};
  for (const [botName, counts] of Object.entries(countsByBot)) {
    table[botName] = {};
    for (const [reason, count] of Object.entries(counts)) {
      table[botName][reason] = `${((count / totalRuns) * 100).toFixed(1)}%`;
    }
  }
  return table;
}

function main(): void {
  console.log(`GRAFT 헤드리스 밸런스 시뮬레이터 — 봇당 ${RUNS_PER_BOT}런 (NFR-04)\n`);

  const bots = [CAREFUL_BOT, AGGRESSIVE_BOT];
  const summaryRows: SummaryRow[] = [];
  const endReasonCounts: Record<string, Record<RunEndReason, number>> = {};

  for (const bot of bots) {
    const started = Date.now();
    const results = runBotSimulation(bot, RUNS_PER_BOT);
    const elapsedMs = Date.now() - started;

    summaryRows.push(summarize(bot, results));
    endReasonCounts[bot.name] = countEndReasons(results);

    console.log(`- ${bot.name}: ${RUNS_PER_BOT}런 완료 (${elapsedMs}ms)`);
  }

  console.log('\n=== 요약 ===');
  console.table(summaryRows);

  console.log('\n=== 종료 원인 분포 (승리 포함) ===');
  console.table(toPercentTable(endReasonCounts, RUNS_PER_BOT));
}

main();
