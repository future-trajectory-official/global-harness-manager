const DEFAULT_METRICS_FILE = ".agents/management/metrics.jsonl";

interface Metrics {
  intent: string;
  constraint: string;
  context: string;
  stability: string;
}

export async function appendMetrics(data: Metrics, filePath: string = DEFAULT_METRICS_FILE) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data,
  }) + "\n";
  await Deno.writeTextFile(filePath, line, { append: true });
}

export async function showSummary(filePath: string = DEFAULT_METRICS_FILE): Promise<string> {
  let content = "";
  try {
    content = await Deno.readTextFile(filePath);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return "\n### [Session Metrics History]\nNo metrics recorded yet.\n";
    }
    throw e;
  }

  const lines = content.trim().split("\n").slice(-5);
  let summary = "\n### [Session Metrics History (Last 5)]\n";
  summary += "| Date | Intent | Constraint | Context | Stability |\n";
  summary += "| --- | --- | --- | --- | --- |\n";

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      const d = new Date(entry.timestamp);
      const date = `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${
        d.getDate().toString().padStart(2, "0")
      }`;
      summary += `| ${date} | ${entry.intent} | ${entry.constraint} | ${entry.context} | ${entry.stability} |\n`;
    } catch (_e) {
      // skip invalid lines
    }
  }
  return summary;
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length < 4) {
    console.error("Usage: deno run -A record.ts <intent> <constraint> <context> <stability>");
    Deno.exit(1);
  }

  const data = {
    intent: args[0],
    constraint: args[1],
    context: args[2],
    stability: args[3],
  };

  await appendMetrics(data);
  const summary = await showSummary();
  console.log(summary);
}
