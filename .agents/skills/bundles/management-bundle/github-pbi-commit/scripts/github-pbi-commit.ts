import { parseArgs } from "@std/cli";
import { updateIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  number?: string;
  milestone?: string;
  "project-id"?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "number", "milestone", "project-id"],
    boolean: ["dry-run"],
  }) as Args;

  if (!args.number) {
    console.error("--number is required");
    Deno.exit(1);
  }

  const issueNumber = Number(args.number);
  const prefix = args["label-prefix"] ?? "";

  await updateIssue(issueNumber, {
    state: "open",
    milestone: args.milestone,
    addLabels: [`${prefix}todo`],
    removeLabels: [`${prefix}idea`],
  }, { dryRun: args["dry-run"] });

  console.log(
    JSON.stringify({ success: true, data: { number: issueNumber, status: "committed" } }),
  );
}

if (import.meta.main) main();
