import { parseArgs } from "@std/cli";
import { createIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  title?: string;
  "sprint-number"?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "title", "sprint-number"],
    boolean: ["dry-run"],
  }) as Args;

  const title = args.title ?? `Sprint ${args["sprint-number"] ?? "?"} Review`;
  const body = `## Sprint Review\n\n### 完了したPBI\n\n### 未完了のPBI\n\n### 学びと改善点\n`;

  const result = await createIssue({
    title,
    body,
    labels: [`${args["label-prefix"] ?? ""}review`],
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

if (import.meta.main) main();
