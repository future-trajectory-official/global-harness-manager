import { parseArgs } from "@std/cli";
import { createChildIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  title?: string;
  body?: string;
  "parent-number"?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["repo", "label-prefix", "title", "body", "parent-number"],
    boolean: ["dry-run"],
  }) as Args;

  if (!args["parent-number"]) {
    console.error("--parent-number is required");
    Deno.exit(1);
  }

  const input = args.title
    ? { title: args.title, body: args.body, parentNumber: Number(args["parent-number"]) }
    : { ...(await readStdin()), parentNumber: Number(args["parent-number"]) };

  const result = await createChildIssue(input, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

async function readStdin(): Promise<{ title: string; body?: string }> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
