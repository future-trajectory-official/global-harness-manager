import { parseArgs } from "@std/cli";
import { ReviewIssue, ReviewIssueParams } from "../../../../../core/review.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<ReviewIssueParams>();
  const context = parseContext(args.repo);
  const issue = await ReviewIssue.createFromParams(
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
