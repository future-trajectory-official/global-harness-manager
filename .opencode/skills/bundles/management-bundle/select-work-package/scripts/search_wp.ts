#!/usr/bin/env -S deno run -A
import "../../../../../core/composition-root.ts";
import type { WorkPackageSearchCondition } from "../../../../../core/domain/types.ts";
import { workPackageUseCase } from "../../../../../core/domain/workpackage-usecase.ts";
import { errorUtil } from "../../../../../core/harness-core.ts";
import { readJsonFromStdin } from "../../../../../core/shared/io/io.ts";

/** `search_wp.ts` の入力。 */
export interface SearchWpInput {
  status?: string;
  sprintNumber?: number;
  parentPbiNumber?: number;
}

/** `status` に指定できる ProjectV2 Status 名（完全一致で照合される）。 */
export const SEARCHABLE_STATUSES: readonly string[] = ["Todo", "In Progress", "Done", "__none__"];

/**
 * 入力を検証する。型キャストでは防げない実行時の誤りをここで止める。
 *
 * @param input 標準入力から読み取った入力
 * @throws {Error} `status` が既知の値でない、または `parentPbiNumber` が正の整数でない場合
 */
export function validateInput(input: SearchWpInput): void {
  if (input.status !== undefined && !SEARCHABLE_STATUSES.includes(input.status)) {
    throw new Error(
      `INVALID_INPUT: status must be one of ${SEARCHABLE_STATUSES.join(" | ")}`,
    );
  }
  if (input.sprintNumber !== undefined && !Number.isInteger(input.sprintNumber)) {
    throw new Error("INVALID_INPUT: sprintNumber must be an integer");
  }
  if (
    input.parentPbiNumber !== undefined &&
    (!Number.isInteger(input.parentPbiNumber) || input.parentPbiNumber <= 0)
  ) {
    throw new Error("INVALID_INPUT: parentPbiNumber must be a positive integer");
  }
}

/**
 * 標準入力のJSONからWP検索条件を組み立てる。
 *
 * `status` は ProjectV2 の Status 名（Todo / In Progress / Done / __none__）を指し、
 * 未指定時は Todo を既定値とする。`parentPbiNumber` は親PBIのIssue番号で、
 * 指定時は当該PBI配下のWPのみに絞り込む。
 *
 * @param input 検索入力。すべて任意
 * @returns `workPackageUseCase.search` に渡す検索条件
 */
export function buildCondition(input: SearchWpInput): WorkPackageSearchCondition {
  const status = input.status ?? "Todo";
  const sprintNumber = input.sprintNumber;
  const parentPbiNumber = input.parentPbiNumber;
  const scope = parentPbiNumber === undefined ? "" : ` parentPbi=${parentPbiNumber}`;
  return {
    status,
    sprintNumber,
    parentPbiNumber,
    describe() {
      return {
        summary: `Search work packages with status=${status}${scope}`,
        steps: [{
          entity: "WorkPackage" as const,
          operation: "search" as const,
          params: { labelType: "WP", status, sprintNumber, parentPbiNumber },
        }],
      };
    },
  };
}

async function main(): Promise<void> {
  try {
    const input = await readJsonFromStdin<SearchWpInput>();
    validateInput(input);
    const plan = workPackageUseCase.search(buildCondition(input));
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
