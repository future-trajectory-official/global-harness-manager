import { parseArgs } from "@std/cli";
import { searchIssues } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  "parent-number"?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "parent-number"],
    boolean: ["dry-run"],
  }) as Args;

  const issues = await searchIssues({
    labels: args["parent-number"] ? [`parent:#${args["parent-number"]}`] : undefined,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: true, data: issues }));
}

if (import.meta.main) main();
