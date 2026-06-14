/** バリデーションエラー1件を表す */
export interface SchemaValidationError {
  path: string;
  message: string;
}

/** バリデーション結果 */
export interface SchemaValidationResult {
  valid: boolean;
  errors: SchemaValidationError[];
}

/** バリデーションルール定義 */
export interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean" | "array" | "object";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

/** ルール定義に従って入力を検証する。 */
export function validateInput(
  input: Record<string, unknown>,
  rules: ValidationRule[],
): SchemaValidationResult {
  const errors: SchemaValidationError[] = [];

  for (const rule of rules) {
    const value = input[rule.field];

    if (value === undefined || value === null) {
      if (rule.required) {
        errors.push({ path: rule.field, message: `${rule.field} is required` });
      }
      continue;
    }

    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (actualType !== rule.type) {
      errors.push({ path: rule.field, message: `expected ${rule.type}, got ${actualType}` });
      continue;
    }

    if (typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({ path: rule.field, message: `must be at least ${rule.minLength} characters` });
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({ path: rule.field, message: `must be at most ${rule.maxLength} characters` });
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ path: rule.field, message: `does not match pattern ${rule.pattern}` });
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({ path: rule.field, message: `must be one of: ${rule.enum.join(", ")}` });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
