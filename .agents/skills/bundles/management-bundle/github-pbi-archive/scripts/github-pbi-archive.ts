import { parseArgs } from "@std/cli";
import { type IGitHubContext } from "../../../../../core/github.ts";
import { Issue } from "../../../../../core/issue.ts";

interface CliArgs {
  repo?: string;
  "dry-run"?: boolean;
}

interface StdinInput {
  number: number;
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
    string: ["repo"],
    boolean: ["dry-run"],
  }) as CliArgs;

  const input: StdinInput = await readStdin();
  const context = resolveContext(args.repo);

  const issue = await Issue.find(context, input.number, { dryRun: args["dry-run"] });
  if (!issue) {
    console.log(JSON.stringify({ success: false, error: `Issue #${input.number} not found` }));
    return;
  }

  await issue.close();

  console.log(JSON.stringify({
    success: true,
    data: { number: issue.number, state: issue.state },
  }));
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
