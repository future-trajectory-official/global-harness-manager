import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface StdinInput {
  title: string;
  body?: string;
  parentNumber: number;
  labels?: string[];
  milestone?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);
  const prefix = args["label-prefix"] ?? "";

  const labels = input.labels
    ? applyLabelPrefix(input.labels, prefix)
    : applyLabelPrefix(["type:WP"], prefix);

  const child = await Issue.create(context, {
    title: input.title,
    body: input.body,
    labels,
    milestone: input.milestone,
  }, { dryRun: args["dry-run"] });

  if (!args["dry-run"]) {
    const parent = await Issue.find(context, input.parentNumber);
    if (parent) {
      await parent.attach(child);
    }
  }

  console.log(JSON.stringify({
    success: true,
    data: { number: child.number, title: child.title, parentNumber: input.parentNumber },
  }));
}

if (import.meta.main) main();
