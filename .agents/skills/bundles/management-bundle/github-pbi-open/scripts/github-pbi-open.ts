import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface StdinInput {
  title: string;
  body?: string;
  milestone?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);
  const labels = applyLabelPrefix(["type:PBI"], args["label-prefix"] ?? "");

  const issue = await Issue.create(context, {
    title: input.title,
    body: input.body,
    labels,
    milestone: input.milestone,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({
    success: true,
    data: { number: issue.number, title: issue.title, labels: issue.labels, state: issue.state },
  }));
}

if (import.meta.main) main();
