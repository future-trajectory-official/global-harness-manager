/**
 * エンティティ操作のバリデーション結果。
 * valid が false の場合、errors に理由が含まれる。
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/** 常に valid な結果。 */
export const VALID: ValidationResult = Object.freeze({ valid: true, errors: [] });

/**
 * エンティティ操作のバリデーター抽象。
 *
 * エンティティに対する全操作の事前条件・事後条件・不変条件を検証する。
 * from は操作前の状態、to は操作後の目標状態を表す。
 *
 * ## 用法
 *
 * Gateway層（PlanGateway.execute）が、Plan実行前に現在のエンティティ状態（from）と
 * Planに含まれる目標状態（to）を比較し、許可されない操作を検出するために使用する。
 *
 * ```typescript
 * const result = validator.validate("start", currentData, targetData);
 * if (!result.valid) {
 *   throw createDomainError("INVALID_STATE_TRANSITION", result.errors.join(", "));
 * }
 * ```
 *
 * ## 検証ルールの種類
 *
 * - **状態遷移ルール**: stage/state の遷移が許可されているか
 * - **値の制約ルール**: 見積サイズの削除禁止、effortの順序制約など
 * - **不変条件ルール**: 特定フィールドの不変性（完了後は属性変更不可等）
 */
export interface EntityValidator<T> {
  validate(operation: string, from: T, to: T): ValidationResult;
}
