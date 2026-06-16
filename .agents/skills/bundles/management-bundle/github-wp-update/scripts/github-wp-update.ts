import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface StdinInput {
  number: number;
  title?: string;
  body?: string;
  addLabels?: string[];
  removeLabels?: string[];
  milestone?: string;
  state?: "open" | "closed";
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const prefix = args["label-prefix"] ?? "";
  const context = parseContext(args.repo);

  const issue = await Issue.find(context, input.number, { dryRun: args["dry-run"] });
  if (!issue) {
    console.log(JSON.stringify({ success: false, error: `Issue #${input.number} not found` }));
    return;
  }

  if (input.title !== undefined) issue.title = input.title;
  if (input.body !== undefined) issue.body = input.body;
  if (input.milestone !== undefined) issue.milestone = input.milestone;
  if (input.state !== undefined) issue.state = input.state;

  if (input.addLabels) {
    for (const label of applyLabelPrefix(input.addLabels, prefix)) {
      issue.addLabel(label);
    }
  }
  if (input.removeLabels) {
    for (const label of applyLabelPrefix(input.removeLabels, prefix)) {
      issue.removeLabel(label);
    }
  }

  await issue.save();

  console.log(JSON.stringify({
    success: true,
    data: { number: issue.number, title: issue.title, state: issue.state, labels: issue.labels },
  }));
}

if (import.meta.main) main();
