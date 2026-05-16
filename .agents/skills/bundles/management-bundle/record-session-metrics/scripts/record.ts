import { join } from "@std/path";
import { parseArgs } from "@std/cli";

export interface SessionMetrics {
  intent: string;
  constraint: string;
  context: string;
  stability: string;
  timestamp?: string;
}

/**
 * メトリクスのバリデーション
 */
export function validateMetrics(data: SessionMetrics): boolean {
  const fields = ["intent", "constraint", "context", "stability"] as const;
  for (const field of fields) {
    if (!data[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
    const val = parseInt(data[field]);
    if (isNaN(val) || val < 1 || val > 5) {
      throw new Error(`Field ${field} must be a number between 1 and 5 (received: ${data[field]})`);
    }
  }
  return true;
}

/**
 * メトリクスを JSONL ファイルに追記
 */
export async function appendMetrics(data: SessionMetrics, filePath: string) {
  validateMetrics(data);
  const entry = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  const line = JSON.stringify(entry) + "\n";
  await Deno.writeTextFile(filePath, line, { append: true });
}

/**
 * 統計のサマリーをテーブル形式で取得
 */
export async function showSummary(filePath: string): Promise<string> {
  try {
    const content = await Deno.readTextFile(filePath);
    const lines = content.trim().split("\n");
    let output = "| Date | Intent | Constraint | Context | Stability |\n";
    output += "| :--- | :--- | :--- | :--- | :--- |\n";

    for (const line of lines) {
      if (!line) continue;
      const data: SessionMetrics = JSON.parse(line);
      const date = data.timestamp
        ? new Date(data.timestamp).toLocaleDateString("ja-JP")
        : "Unknown";
      output +=
        `| ${date} | ${data.intent} | ${data.constraint} | ${data.context} | ${data.stability} |\n`;
    }
    return output;
  } catch (_e) {
    return "No metrics recorded yet.";
  }
}

if (import.meta.main) {
  const args = parseArgs(Deno.args);
  const data: SessionMetrics = {
    intent: String(args.intent || ""),
    constraint: String(args.constraint || ""),
    context: String(args.context || ""),
    stability: String(args.stability || ""),
  };

  try {
    const metricsPath = join(Deno.cwd(), "metrics.jsonl");
    if (args.summary) {
      console.log(await showSummary(metricsPath));
    } else {
      await appendMetrics(data, metricsPath);
      console.log("✅ Metrics recorded successfully.");
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    Deno.exit(1);
  }
}
