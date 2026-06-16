import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";

interface StdinInput {
  number: number;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);

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

if (import.meta.main) main();
