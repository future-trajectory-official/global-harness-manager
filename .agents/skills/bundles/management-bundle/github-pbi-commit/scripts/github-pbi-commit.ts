import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface StdinInput {
  number: number;
  milestone?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);
  const [ideaLabel, todoLabel] = applyLabelPrefix(
    ["status:idea", "status:todo"],
    args["label-prefix"] ?? "",
  );

  const issue = await Issue.find(context, input.number, { dryRun: args["dry-run"] });
  if (!issue) {
    console.log(JSON.stringify({ success: false, error: `Issue #${input.number} not found` }));
    return;
  }

  issue.removeLabel(ideaLabel);
  issue.addLabel(todoLabel);
  if (input.milestone) issue.milestone = input.milestone;
  issue.state = "open";
  await issue.save();

  console.log(
    JSON.stringify({ success: true, data: { number: input.number, status: "committed" } }),
  );
}

if (import.meta.main) main();
