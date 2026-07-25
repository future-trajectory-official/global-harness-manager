import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface StdinInput {
  milestone: string;
  labels?: string[];
  state?: "open" | "closed" | "all";
  limit?: number;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);
  const prefix = args["label-prefix"] ?? "";
  const labels = input.labels ? applyLabelPrefix(input.labels, prefix) : undefined;

  const issues = await Issue.list(context, {
    milestone: input.milestone,
    labels,
    state: input.state ?? "all",
    limit: input.limit,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({
    success: true,
    data: issues.map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels,
    })),
  }));
}

if (import.meta.main) main();
