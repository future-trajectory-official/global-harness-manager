import { parseArgs } from "@std/cli";
import { type IGitHubContext } from "../../../../../core/github.ts";
import { Issue } from "../../../../../core/issue.ts";

interface CliArgs {
  repo?: string;
  "dry-run"?: boolean;
}

interface StdinInput {
  milestone: string;
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

  const issues = await Issue.list(context, {
    milestone: input.milestone,
    state: "all",
  }, { dryRun: args["dry-run"] });

  const total = issues.length;
  const open = issues.filter((i) => i.state === "open").length;
  const closed = issues.filter((i) => i.state === "closed").length;

  console.log(JSON.stringify({
    success: true,
    data: {
      milestone: input.milestone,
      total,
      open,
      closed,
      completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
      issues: issues.map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        labels: i.labels,
      })),
    },
  }));
}

async function readStdin(): Promise<StdinInput> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
