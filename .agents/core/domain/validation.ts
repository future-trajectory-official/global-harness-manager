/** タイトル（{ value: string }）が空でないことを検証する。 */
export function assertTitleNonEmpty(title: { value: string }, label: string): void {
  if (!title.value) {
    throw new Error(`INVALID_INPUT: ${label} must not be empty`);
  }
}

/** 文字列が空でないことを検証する。 */
export function assertStringNonEmpty(value: string, label: string): void {
  if (!value) {
    throw new Error(`INVALID_INPUT: ${label} must not be empty`);
  }
}

/** エンティティの id が undefined でないことを検証する。 */
export function assertIdDefined(id: string | undefined, label: string): void {
  if (id === undefined) {
    throw new Error(
      `INVALID_INPUT: Cannot ${label} that has not been created yet (id is undefined)`,
    );
  }
}

/**
 * エンティティの参照に必要な識別子（id または code）が定義されていることを検証する。
 * find 等の読取り操作は GitHub node-id（id）が無くても Issue 番号（code）だけで実行可能。
 */
export function assertReferenceDefined(
  id: string | undefined,
  code: string | undefined,
  label: string,
): void {
  if (id === undefined && code === undefined) {
    throw new Error(
      `INVALID_INPUT: Cannot ${label} without a reference (id or code is undefined)`,
    );
  }
}

/**
 * effort集計値（EffortSummary）が全て 0以上の有限数であることを検証する。
 * 部分指定・空オブジェクトによる harness-effort-summary への空記録を防ぐ。
 */
export function assertEffortSummary(
  effort: { initialEstimate: number; plannedEstimate: number; actual: number },
  label: string,
): void {
  for (const [key, value] of Object.entries(effort)) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`INVALID_INPUT: ${label}.${key} must be a finite non-negative number`);
    }
  }
}
