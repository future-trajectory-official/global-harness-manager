import { parseArgs } from "@std/cli";
import { Milestone } from "../../../../../core/milestone.ts";
import { parseContext } from "../../../../../core/github.ts";
import { readJsonFromStdin } from "../../../../../core/io.ts";

interface StdinInput {
  title: string;
  description?: string;
  dueOn?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo"],
    boolean: ["dry-run"],
  });

  const input = await readJsonFromStdin<StdinInput>();
  const context = parseContext(args.repo);

  const milestone = await Milestone.create(context, {
    title: input.title,
    description: input.description,
    dueOn: input.dueOn,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({
    success: true,
    data: { number: milestone.number, title: milestone.title },
  }));
}

if (import.meta.main) main();
