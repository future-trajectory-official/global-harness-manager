import { parseArgs } from "@std/cli/parse-args";
import type { Plan } from "../../domain/types.ts";
import { errorUtil } from "../types/error.ts";
import { readJsonFromStdin } from "../io/io.ts";

export interface RunCliOptions<T> {
  validate?: (input: T) => void;
  buildPlan: (input: T) => Plan;
  executePlan: (plan: Plan) => Promise<unknown>;
}

export async function runCli<T>(options: RunCliOptions<T>): Promise<void> {
  try {
    const args = parseArgs(Deno.args, {
      boolean: ["dry-run"],
      alias: { "dry-run": "d" },
    });
    const input = await readJsonFromStdin<T>();
    options.validate?.(input);
    const plan = options.buildPlan(input);

    if (args["dry-run"]) {
      console.log(JSON.stringify({ summary: plan.summary, steps: plan.steps }, null, 2));
    } else {
      const result = await options.executePlan(plan);
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}
