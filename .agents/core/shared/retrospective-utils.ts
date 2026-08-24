import { identify } from "../domain/types.ts";
import type { EntityScope, RetrospectiveSearchCondition, Step } from "../domain/types.ts";
import { retrospectiveUseCase } from "../domain/retrospective-usecase.ts";

/** KPT・メトリクスのナラティブフィールドの最大バイト数。 */
export const BYTE_LIMIT = 1024;

/** 文字列の UTF-8 バイト長を返す。 */
export function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/**
 * 指定フィールドの UTF-8 バイト長が limit 以下であることを検証する。
 * @param value - 検証対象の文字列
 * @param fieldName - エラーメッセージ用フィールド名
 * @param limit - 上限バイト数（既定 1024）
 */
export function assertByteLimit(
  value: string,
  fieldName: string,
  limit: number = BYTE_LIMIT,
): void {
  const actual = byteLength(value);
  if (actual > limit) {
    throw new Error(
      `INVALID_INPUT: ${fieldName} must be ${limit} bytes or fewer (actual: ${actual})`,
    );
  }
}

/**
 * 検索結果のタイトルが「Sprint N Retrospective」形式（N = スプリント番号）に一致するかを判定する。
 * 部分一致（`includes`）は "Sprint 2" が "Sprint 20" に誤マッチするため使用しない。
 * @param title - 検索結果の Issue タイトル
 * @param sprintNumber - 対象スプリント番号
 */
export function matchRetrospectiveTitle(title: string, sprintNumber: number): boolean {
  return new RegExp(`^Sprint\\s+${sprintNumber}\\s+Retrospective$`).test(title.trim());
}

/**
 * 対象Retrospectiveを search で特定し、{ code, title } を返す。一意でない場合はエラー。
 * search ステップの失敗（gh エラー・Scope 未解決等）は error をそのまま送出する。
 * @param sprintNumber - 対象スプリント番号
 */
export async function searchRetrospectiveIssue(
  sprintNumber: number,
): Promise<{ code: string; title: string }> {
  const searchCondition: RetrospectiveSearchCondition = {
    sprintNumber,
    describe: () => ({
      summary: `Search retrospectives for Sprint ${sprintNumber}`,
      steps: [{
        entity: "Retrospective",
        operation: "search",
        params: { labelType: "Retrospective" },
      }] as unknown as readonly Step[],
    }),
  };
  const searchPlan = retrospectiveUseCase.search(searchCondition);
  const searchResult = await retrospectiveUseCase.executePlan(searchPlan);
  const step = searchResult.getStep("Retrospective", "search");
  if (!step?.success) {
    throw new Error(
      step?.error ?? `Failed to search Retrospective Issues for Sprint ${sprintNumber}`,
    );
  }
  const searchOutput = step.output as Array<{ number: number; title: string }> | undefined;
  if (!searchOutput || searchOutput.length === 0) {
    throw new Error(`No Retrospective Issue found for Sprint ${sprintNumber}`);
  }
  const matched = searchOutput.filter((item) => matchRetrospectiveTitle(item.title, sprintNumber));
  if (matched.length === 0) {
    throw new Error(`No Retrospective Issue found for Sprint ${sprintNumber}`);
  }
  if (matched.length > 1) {
    throw new Error(
      `Multiple Retrospective Issues found for Sprint ${sprintNumber}: ` +
        matched.map((m) => m.number).join(", "),
    );
  }
  return { code: String(matched[0].number), title: matched[0].title };
}

/** 対象特定に必要な入力。code 優先、未指定時は sprintNumber で検索する。 */
export interface ResolveTargetInput {
  sprintNumber?: number;
  code?: string;
  title?: string;
}

/**
 * 対象Retrospectiveの識別子を解決する。
 * code 指定時は直接（search 不要）、未指定時は search で特定する。
 * @param input - 入力（code または sprintNumber）
 */
export async function resolveTarget(
  input: ResolveTargetInput,
): Promise<{ code: string; title: string }> {
  const code = input.code != null && String(input.code).trim() !== ""
    ? String(input.code)
    : undefined;
  if (code) {
    const title = input.title ??
      (input.sprintNumber != null ? `Sprint ${input.sprintNumber} Retrospective` : "Retrospective");
    return { code, title };
  }
  if (input.sprintNumber == null) {
    throw new Error("INVALID_INPUT: code or sprintNumber is required");
  }
  return await searchRetrospectiveIssue(input.sprintNumber);
}

/**
 * dry-run 用に対象を解決する。code 指定時のみ確定値を返し、未指定時は null を返す。
 * dry-run は GitHub（gh/git）を一切呼び出さない。対象未確定の場合は実実行時に検索される。
 * @param input - 入力（code または sprintNumber）
 */
export function dryRunTarget(
  input: ResolveTargetInput,
): { code: string; title: string } | null {
  const code = input.code != null && String(input.code).trim() !== ""
    ? String(input.code)
    : undefined;
  if (!code) return null;
  const title = input.title ??
    (input.sprintNumber != null ? `Sprint ${input.sprintNumber} Retrospective` : "Retrospective");
  return { code, title };
}

/**
 * 既存参照用の識別子を生成する。id には code（Issue番号）をプレースホルダとして設定する。
 * Gateway 層が code から node-id を内部解決するため、id 自体は検証用の存在確認にのみ使われる。
 * @param scope - 対象リポジトリのスコープ
 * @param target - 対象（code / title）
 */
export function retrospectiveRef(
  scope: EntityScope,
  target: { code: string; title: string },
) {
  return identify(scope, target.title, target.code, target.code);
}
