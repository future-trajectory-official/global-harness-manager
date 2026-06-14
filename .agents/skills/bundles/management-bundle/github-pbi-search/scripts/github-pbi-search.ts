import { parseArgs } from "@std/cli";
import { searchIssues } from "../../../../../core/github.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface CliArgs {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
}

interface StdinInput {
  labels?: string[];
  state?: "open" | "closed" | "all";
  milestone?: string;
  assignee?: string;
  limit?: number;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix"],
    boolean: ["dry-run"],
  }) as CliArgs;

  const input: StdinInput = await readStdin();
  const prefix = args["label-prefix"] ?? "";

  const labels = input.labels ? applyLabelPrefix(input.labels, prefix) : undefined;

  const issues = await searchIssues({
    state: input.state ?? "all",
    labels,
    milestone: input.milestone,
    assignee: input.assignee,
    limit: input.limit,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: true, data: issues }));
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) return {};
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
