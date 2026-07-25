import { parseArgs } from "@std/cli";
import { getManagementPath } from "../../../../../core/constants.ts";
import { MESSAGES } from "../../../../../core/messages.ts";

export interface SessionMetrics {
  intent: string;
  constraint: string;
  context: string;
  stability: string;
  timestamp?: string;

  // コアメトリクスの採点理由（思考プロセス）
  metrics_reason?: string;

  // IDの独立管理
  epic_id?: string;
  feature_id?: string;
  pbi_id?: string;

  // Effortの3点見積もり（具体的な介入回数）
  initial_estimated_effort?: number;
  planned_estimated_effort?: number;
  actual_effort?: number;

  // 予実の乖離（またはスムーズに進んだ）具体的な要因
  effort_variance_reason?: string;
}

/**
 * メトリクスのバリデーション
 */
export function validateMetrics(data: SessionMetrics): boolean {
  const fields = ["intent", "constraint", "context", "stability"] as const;
  for (const field of fields) {
    if (!data[field]) {
      throw new Error(MESSAGES.METRICS.MISSING_FIELD(field));
    }
    const val = parseInt(data[field]);
    if (isNaN(val) || val < 1 || val > 5) {
      throw new Error(MESSAGES.METRICS.INVALID_RANGE(field, data[field]));
    }
  }

  // 努力値 (Effort) のバリデーション
  const effortFields = [
    "initial_estimated_effort",
    "planned_estimated_effort",
    "actual_effort",
  ] as const;
  for (const field of effortFields) {
    const val = data[field];
    if (val !== undefined) {
      if (typeof val !== "number" || isNaN(val) || val < 0) {
        throw new Error(`Field ${field} must be a non-negative number (received: ${val})`);
      }
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
    timestamp: new Date().toISOString(),
    ...data,
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
    let output =
      "| Date | Intent | Const | Ctxt | Stab | Epic | Feat | PBI | Init | Plan | Act |\n";
    output += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
    const historyLogs: string[] = [];

    for (const line of lines) {
      if (!line) continue;
      const data: SessionMetrics = JSON.parse(line);
      const date = data.timestamp
        ? new Date(data.timestamp).toLocaleDateString("ja-JP")
        : "Unknown";

      const epic = data.epic_id || "-";
      const feat = data.feature_id || "-";
      const pbi = data.pbi_id
        ? (data.pbi_id.length > 20 ? data.pbi_id.substring(0, 17) + "..." : data.pbi_id)
        : "-";
      const init = data.initial_estimated_effort !== undefined
        ? String(data.initial_estimated_effort)
        : "-";
      const plan = data.planned_estimated_effort !== undefined
        ? String(data.planned_estimated_effort)
        : "-";
      const act = data.actual_effort !== undefined ? String(data.actual_effort) : "-";

      output +=
        `| ${date} | ${data.intent} | ${data.constraint} | ${data.context} | ${data.stability} | ${epic} | ${feat} | ${pbi} | ${init} | ${plan} | ${act} |\n`;

      if (data.metrics_reason || data.effort_variance_reason) {
        let log = `- **[${date}]**`;
        if (data.metrics_reason) {
          log += `\n  - **Quality Reason**: ${data.metrics_reason}`;
        }
        if (data.effort_variance_reason) {
          log += `\n  - **Effort Variance/Success Reason**: ${data.effort_variance_reason}`;
        }
        historyLogs.push(log);
      }
    }

    if (historyLogs.length > 0) {
      output += `\n🧠 Collaboration & Effort Reasoning History:\n${historyLogs.join("\n")}\n`;
    }
    return output;
  } catch (_e) {
    return MESSAGES.METRICS.NO_DATA;
  }
}

if (import.meta.main) {
  const args = parseArgs(Deno.args);

  // --reason と --metrics-reason の両方を許容
  const metricsReason = args["metrics-reason"] || args.reason;

  const data: SessionMetrics = {
    intent: String(args.intent || ""),
    constraint: String(args.constraint || ""),
    context: String(args.context || ""),
    stability: String(args.stability || ""),
    metrics_reason: metricsReason ? String(metricsReason) : undefined,
    epic_id: args.epic ? String(args.epic) : undefined,
    feature_id: args.feature ? String(args.feature) : undefined,
    pbi_id: args.pbi ? String(args.pbi) : undefined,
    initial_estimated_effort: args["initial-effort"] !== undefined
      ? Number(args["initial-effort"])
      : undefined,
    planned_estimated_effort: args["planned-effort"] !== undefined
      ? Number(args["planned-effort"])
      : undefined,
    actual_effort: args["actual-effort"] !== undefined ? Number(args["actual-effort"]) : undefined,
    effort_variance_reason: args["effort-variance-reason"]
      ? String(args["effort-variance-reason"])
      : undefined,
  };

  try {
    const metricsPath = getManagementPath("metrics.jsonl");
    if (args.summary) {
      console.log(await showSummary(metricsPath));
    } else {
      await appendMetrics(data, metricsPath);
      console.log(MESSAGES.METRICS.SUCCESS);
      if (data.metrics_reason) {
        console.log(`\n🧠 Thought Process (Reasoning):\n${data.metrics_reason}\n`);
      }
      if (data.effort_variance_reason) {
        console.log(`\n📊 Effort Variance/Success Factor:\n${data.effort_variance_reason}\n`);
      }
    }
  } catch (error) {
    console.error(
      `${MESSAGES.METRICS.ERROR_PREFIX}${error instanceof Error ? error.message : String(error)}`,
    );
    Deno.exit(1);
  }
}
