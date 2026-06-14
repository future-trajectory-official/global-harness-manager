import { parseArgs } from "@std/cli";
import { updateIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  number?: string;
  status?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "number", "status"],
    boolean: ["dry-run"],
  }) as Args;

  if (!args.number) {
    console.error("--number is required");
    Deno.exit(1);
  }

  const issueNumber = Number(args.number);
  const result = await updateIssue(issueNumber, {
    body: args.status ? `**Status**: ${args.status}` : undefined,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

if (import.meta.main) main();
