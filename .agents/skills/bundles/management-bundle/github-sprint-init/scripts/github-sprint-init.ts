import { parseArgs } from "@std/cli";
import { createMilestone } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  title?: string;
  description?: string;
  "due-on"?: string;
  owner?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "title", "description", "due-on", "owner"],
    boolean: ["dry-run"],
  }) as Args;

  if (!args.title || !args.owner) {
    console.error("--title and --owner are required");
    Deno.exit(1);
  }

  const [owner, repo] = args.repo?.split("/") ?? [args.owner, ""];
  const milestone = await createMilestone(
    {
      title: args.title,
      description: args.description,
      dueOn: args["due-on"],
    },
    owner,
    repo,
    { dryRun: args["dry-run"] },
  );

  console.log(JSON.stringify({ success: !!milestone, data: milestone }));
}

if (import.meta.main) main();
