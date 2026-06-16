import { parseArgs } from "@std/cli";
import { Issue } from "../../../../../core/issue.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";

interface StdinInput {
  milestone: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);

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

if (import.meta.main) main();
