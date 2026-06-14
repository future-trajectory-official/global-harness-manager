import { parseArgs } from "@std/cli";
import { createIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  title?: string;
  body?: string;
  labels?: string;
  milestone?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "title", "body", "labels", "milestone"],
    boolean: ["dry-run"],
  }) as Args;

  const input = args.title
    ? {
      title: args.title,
      body: args.body,
      labels: args.labels?.split(","),
      milestone: args.milestone,
    }
    : await readStdin();

  const result = await createIssue({
    title: input.title,
    body: input.body,
    labels: input.labels,
    milestone: input.milestone,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

async function readStdin(): Promise<
  { title: string; body?: string; labels?: string[]; milestone?: string }
> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
