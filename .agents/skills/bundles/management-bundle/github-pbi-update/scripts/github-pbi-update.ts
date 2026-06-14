import { parseArgs } from "@std/cli";
import { updateIssue } from "../../../../../core/github.ts";
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

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  }) as CliArgs;

  const input: StdinInput = await readStdin();
  const prefix = args["label-prefix"] ?? "";

  const result = await updateIssue(input.number, {
    title: input.title,
    body: input.body,
    addLabels: input.addLabels ? applyLabelPrefix(input.addLabels, prefix) : undefined,
    removeLabels: input.removeLabels ? applyLabelPrefix(input.removeLabels, prefix) : undefined,
    milestone: input.milestone,
    state: input.state,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
