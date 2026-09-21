export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * `.harnessrc` 設定を JSON Schema（draft-07 のサブセット）で検証する。
 * 依存ゼロ（Deno std のみ）で実装したミニバリデータ。npm 依存を排除し、Deno 単独で動作させる。
 *
 * 対応キーワード: `type` / `required` / `properties` / `items` / `enum` / `minItems` /
 * `uniqueItems` / `additionalProperties`（`false` のみ）。`$schema` は無視する。
 * @param config - 検証対象の設定オブジェクト
 * @param schema - JSON Schema（draft-07 サブセット）
 * @returns 検証結果（`valid` と `errors`）
 */
/** 本バリデータが対応する検証キーワード（M3対応: これ以外の検証キーワードは fail-fast）。 */
const SUPPORTED_KEYWORDS = new Set([
  "type",
  "required",
  "properties",
  "items",
  "enum",
  "minItems",
  "uniqueItems",
  "additionalProperties",
]);
/** 検証に影響しないメタキーワード（無視してよい）。 */
const META_KEYWORDS = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "default",
  "examples",
  "deprecated",
  "readOnly",
  "writeOnly",
  "definitions",
  "$defs",
]);

export function validateHarnessConfig(
  config: Record<string, unknown>,
  schema: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationError[] = [];
  collectUnsupportedKeywords(schema, "", errors);
  validateValue(config, schema, "", errors);
  return { valid: errors.length === 0, errors };
}

/**
 * 未対応の JSON Schema キーワードを走査して検出する（M3対応）。
 * サブセット実装が静かに不正な設定を通さないよう、未対応キーワードを fail-fast する。
 */
function collectUnsupportedKeywords(
  schema: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): void {
  for (const key of Object.keys(schema)) {
    if (SUPPORTED_KEYWORDS.has(key) || META_KEYWORDS.has(key)) continue;
    errors.push({
      path: path || "/",
      message: `unsupported JSON Schema keyword '${key}'`,
    });
  }
  const props = schema.properties as Record<string, unknown> | undefined;
  if (props) {
    for (const [prop, sub] of Object.entries(props)) {
      if (typeof sub === "object" && sub !== null) {
        collectUnsupportedKeywords(sub as Record<string, unknown>, `${path}/${prop}`, errors);
      }
    }
  }
  if (schema.items && typeof schema.items === "object") {
    collectUnsupportedKeywords(schema.items as Record<string, unknown>, `${path}/items`, errors);
  }
}

/** 値をスキーマで再帰的に検証し、errors へ追記する。 */
function validateValue(
  value: unknown,
  schema: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
): void {
  const type = schema.type;
  if (type && !matchesType(value, type)) {
    errors.push({
      path: path || "/",
      message: `expected type '${String(type)}', got '${typeof value}'`,
    });
    return;
  }

  if (schema.enum && !(schema.enum as unknown[]).some((e) => deepEqual(e, value))) {
    errors.push({ path: path || "/", message: `must be one of ${JSON.stringify(schema.enum)}` });
  }

  if (isObject(value)) {
    for (const required of (schema.required as string[] | undefined) ?? []) {
      if (!(required in value)) {
        errors.push({
          path: childPath(path, required),
          message: `missing required property '${required}'`,
        });
      }
    }
    for (
      const [prop, propSchema] of Object.entries(
        (schema.properties as Record<string, unknown>) ?? {},
      )
    ) {
      if (prop in value) {
        validateValue(
          (value as Record<string, unknown>)[prop],
          propSchema as Record<string, unknown>,
          childPath(path, prop),
          errors,
        );
      }
    }
    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys((schema.properties as Record<string, unknown>) ?? {}));
      for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
          errors.push({
            path: childPath(path, key),
            message: `additional property '${key}' is not allowed`,
          });
        }
      }
    }
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      errors.push({ path: path || "/", message: `must have at least ${schema.minItems} items` });
    }
    if (schema.uniqueItems === true && new Set(value).size !== value.length) {
      errors.push({ path: path || "/", message: "items must be unique" });
    }
    if (schema.items) {
      value.forEach((item, index) => {
        validateValue(item, schema.items as Record<string, unknown>, `${path}/${index}`, errors);
      });
    }
  }
}

function matchesType(value: unknown, type: unknown): boolean {
  if (Array.isArray(type)) {
    return type.some((t) => matchesType(value, t));
  }
  switch (type) {
    case "object":
      return isObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function childPath(parent: string, key: string): string {
  return parent ? `${parent}/${key}` : `/${key}`;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}
