import { parseArgs } from "@std/cli";
import { updateIssue } from "../../../../../core/github.ts";

interface Args {
  repo?: string;
  "label-prefix"?: string;
  "dry-run"?: boolean;
  number?: string;
  title?: string;
  body?: string;
  "add-labels"?: string;
  "remove-labels"?: string;
  milestone?: string;
  state?: string;
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: [
      "repo",
      "label-prefix",
      "number",
      "title",
      "body",
      "add-labels",
      "remove-labels",
      "milestone",
      "state",
    ],
    boolean: ["dry-run"],
  }) as Args;

  const input = args.number
    ? {
      number: Number(args.number),
      title: args.title,
      body: args.body,
      addLabels: args["add-labels"]?.split(","),
      removeLabels: args["remove-labels"]?.split(","),
      milestone: args.milestone,
      state: args.state as "open" | "closed" | undefined,
    }
    : await readStdin();

  const result = await updateIssue(input.number, {
    title: input.title,
    body: input.body,
    addLabels: input.addLabels,
    removeLabels: input.removeLabels,
    milestone: input.milestone,
    state: input.state,
  }, { dryRun: args["dry-run"] });

  console.log(JSON.stringify({ success: !!result, data: result }));
}

async function readStdin(): Promise<
  {
    number: number;
    title?: string;
    body?: string;
    addLabels?: string[];
    removeLabels?: string[];
    milestone?: string;
    state?: "open" | "closed";
  }
> {
  const buffer = new Uint8Array(1024 * 16);
  const n = await Deno.stdin.read(buffer);
  if (n === null) throw new Error("No input provided");
  return JSON.parse(new TextDecoder().decode(buffer.subarray(0, n)));
}

if (import.meta.main) main();
