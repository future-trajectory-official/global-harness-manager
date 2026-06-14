import { parseArgs } from "@std/cli";
import { addLabels, closeIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  number?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "number"],
    boolean: ["dry-run"],
  }) as Args;

  if (!args.number) {
    console.error("--number is required");
    Deno.exit(1);
  }

  const issueNumber = Number(args.number);
  const prefix = args["label-prefix"] ?? "";

  const labeled = await addLabels(issueNumber, [`${prefix}archive`], { dryRun: args["dry-run"] });
  const closed = await closeIssue(issueNumber, { dryRun: args["dry-run"] });

  console.log(
    JSON.stringify({
      success: labeled && closed,
      data: { number: issueNumber, status: "archived" },
    }),
  );
}

if (import.meta.main) main();
