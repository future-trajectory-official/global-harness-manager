import { parseArgs } from "@std/cli";
import { type IGitHubContext, updateIssue } from "../../../../../core/github.ts";
import { applyLabelPrefix } from "../../../../../core/label-prefix.ts";

interface CliArgs {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
}

interface StdinInput {
  number: number;
  milestone?: string;
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

  const [ideaLabel, todoLabel] = applyLabelPrefix(["status:idea", "status:todo"], prefix);

  const result = await updateIssue(context, input.number, {
    state: "open",
    milestone: input.milestone,
    addLabels: [todoLabel],
    removeLabels: [ideaLabel],
  }, { dryRun: args["dry-run"] });

  console.log(
    JSON.stringify({ success: !!result, data: { number: input.number, status: "committed" } }),
  );
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
