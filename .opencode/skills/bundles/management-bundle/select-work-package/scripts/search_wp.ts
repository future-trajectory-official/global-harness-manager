#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

interface SearchWpInput {
  status?: string;
  sprintNumber?: number;
}

async function main(): Promise<void> {
  try {
    const input = await readJsonFromStdin<SearchWpInput>();
    const condition = {
      status: input.status ?? "Todo",
      sprintNumber: input.sprintNumber,
      describe() {
        return {
          summary: `Search work packages with status=${this.status}`,
          steps: [{
            entity: "WorkPackage" as const,
            operation: "search" as const,
            params: { labelType: "WP", status: this.status, sprintNumber: this.sprintNumber },
          }],
        };
      },
    };
    const plan = workPackageUseCase.search(condition);
    const result = await workPackageUseCase.executePlan(plan);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    const err = errorUtil.toError(e);
    errorUtil.log(err);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
