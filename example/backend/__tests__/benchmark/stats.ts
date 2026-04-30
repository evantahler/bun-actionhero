export interface Stats {
  min: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  rps: number;
  count: number;
}

export function computeStats(durations: number[]): Stats {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const count = sorted.length;
  const percentile = (p: number) => sorted[Math.ceil((p / 100) * count) - 1];
  return {
    min: sorted[0],
    avg: Math.round((sum / count) * 100) / 100,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    max: sorted[count - 1],
    rps: Math.round((count / (sum / 1000)) * 100) / 100,
    count,
  };
}

export function printStats(name: string, stats: Stats, thresholdMs?: number) {
  const fmt = (ms: number) => `${ms.toFixed(2)}ms`;
  console.log(`\n  Benchmark: ${name}`);
  console.log(`  Iterations: ${stats.count}`);
  console.log(
    `  Latency:  min=${fmt(stats.min)}  avg=${fmt(stats.avg)}  p50=${fmt(stats.p50)}  p95=${fmt(stats.p95)}  p99=${fmt(stats.p99)}  max=${fmt(stats.max)}`,
  );
  // For single-iteration runs (e.g. end-to-end fan-out drains), throughput
  // is just 1/duration and not meaningful — suppress it.
  if (stats.count > 1) {
    console.log(`  Throughput: ${stats.rps} req/s`);
  }
  if (thresholdMs !== undefined) {
    console.log(
      `  Threshold: p95 < ${thresholdMs}ms — ${stats.p95 <= thresholdMs ? "PASS" : "FAIL"}`,
    );
  }
}
