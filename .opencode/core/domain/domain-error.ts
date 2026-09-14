/**
 * Domain層のエラーコード。
 * 入力バリデーション・状態遷移違反・依存関係違反を分類する。
 */
export type DomainErrorCode =
  | "INVALID_INPUT"
  | "MISSING_REQUIRED_FIELD"
  | "INVALID_STATE_TRANSITION"
  | "ALREADY_COMPLETED"
  | "ALREADY_ARCHIVED"
  | "PARENT_NOT_FOUND"
  | "CHILD_WPS_REMAINING"
  | "DUPLICATE_AC_NUMBER"
  | "UNEXPECTED";

/**
 * Domain層のエラー。
 * code でエラー種別を識別し、message で説明、details で追加情報を提供する。
 */
export interface DomainError {
  readonly code: DomainErrorCode;
  readonly message: string;
  readonly details?: unknown;
}

/**
 * DomainError を生成する。戻り値は Object.freeze により不変。
 */
export function createDomainError(
  code: DomainErrorCode,
  message: string,
  details?: unknown,
): DomainError {
  return Object.freeze({ code, message, details });
}

const ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  INVALID_INPUT: "入力値の形式が不正です",
  MISSING_REQUIRED_FIELD: "必須フィールドが欠落しています",
  INVALID_STATE_TRANSITION: "許容されない状態遷移です",
  ALREADY_COMPLETED: "既に完了している操作です",
  ALREADY_ARCHIVED: "既にアーカイブ済みです",
  PARENT_NOT_FOUND: "親PBIが見つかりません",
  CHILD_WPS_REMAINING: "子WPが残っています",
  DUPLICATE_AC_NUMBER: "重複したAC番号です",
  UNEXPECTED: "予期しないエラーが発生しました",
};

/**
 * DomainError をデフォルトメッセージ付きで生成する。
 * コードに対応する日本語メッセージが自動設定される。
 */
export function createDomainErrorWithDefaultMessage(
  code: DomainErrorCode,
  details?: unknown,
): DomainError {
  return Object.freeze({
    code,
    message: ERROR_MESSAGES[code],
    details,
  });
}

/**
 * 値が DomainError の構造を満たすか判定する。型ガードとして使用可能。
 */
export function isDomainError(value: unknown): value is DomainError {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.code !== "string") return false;
  if (typeof candidate.message !== "string") return false;
  return true;
}
