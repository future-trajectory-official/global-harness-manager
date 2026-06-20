import { parseArgs } from "@std/cli";
import { ReflectionIssue, ReflectionIssueParams } from "../../../../../core/reflection.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<ReflectionIssueParams>();
  const context = parseContext(args.repo);
  const issue = await ReflectionIssue.createFromParams(
    context,
    input,
    { dryRun: args["dry-run"] },
  );

  console.log(JSON.stringify({
    success: true,
    data: {
      number: issue.number,
      title: issue.title,
      labels: issue.labels,
      state: issue.state,
      milestone: issue.milestone,
    },
  }));
}

if (import.meta.main) main();
