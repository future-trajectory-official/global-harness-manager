import { parseArgs } from "@std/cli";
import { searchIssues } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  state?: string;
  labels?: string;
  milestone?: string;
  assignee?: string;
  limit?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "state", "labels", "milestone", "assignee", "limit"],
    boolean: ["dry-run"],
  }) as Args;

  const issues = await searchIssues({
    state: (args.state ?? "open") as "open" | "closed" | "all",
    labels: args.labels?.split(","),
    milestone: args.milestone,
    assignee: args.assignee,
    limit: args.limit ? Number(args.limit) : undefined,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: true, data: issues }));
}

if (import.meta.main) main();
