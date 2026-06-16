import { parseArgs } from "@std/cli";
import { type IGitHubContext } from "../../../../../core/github.ts";
import { Issue } from "../../../../../core/issue.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface CliArgs {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
}

interface StdinInput {
  number: number;
  title?: string;
  body?: string;
  addLabels?: string[];
  removeLabels?: string[];
  milestone?: string;
  state?: "open" | "closed";
}

function resolveContext(repo: string | undefined): IGitHubContext {
  const [owner, repository] = (repo ?? "").split("/");
  if (!owner || !repository) {
    throw new Error("--repo owner/repository は必須です");
  }
  return { owner, repository };
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  }) as CliArgs;

  const input: StdinInput = await readStdin();
  const prefix = args["label-prefix"] ?? "";
  const context = resolveContext(args.repo);

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
    const prefixed = applyLabelPrefix(input.addLabels, prefix);
    for (const label of prefixed) {
      issue.addLabel(label);
    }
  }
  if (input.removeLabels) {
    const prefixed = applyLabelPrefix(input.removeLabels, prefix);
    for (const label of prefixed) {
      issue.removeLabel(label);
    }
  }

  await issue.save();

  console.log(JSON.stringify({
    success: true,
    data: { number: issue.number, title: issue.title, state: issue.state, labels: issue.labels },
  }));
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
