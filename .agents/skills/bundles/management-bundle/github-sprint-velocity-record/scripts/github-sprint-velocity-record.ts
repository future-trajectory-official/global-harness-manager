import { parseArgs } from "@std/cli";
import { searchIssues } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  milestone?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "milestone"],
    boolean: ["dry-run"],
  }) as Args;

  const issues = await searchIssues({
    state: "closed",
    milestone: args.milestone,
  }, { dryRun: args["dry-run"] });

  const total = issues.length;
  console.log(
    JSON.stringify({
      success: true,
      data: { milestone: args.milestone, totalIssues: total, issues },
    }),
  );
}

if (import.meta.main) main();
