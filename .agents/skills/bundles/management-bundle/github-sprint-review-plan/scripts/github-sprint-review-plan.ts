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
  milestone: string;
  labels?: string[];
  state?: "open" | "closed" | "all";
  limit?: number;
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

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
