import { validate } from "@cfworker/json-schema";

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateHarnessConfig(
  config: Record<string, unknown>,
  schema: Record<string, unknown>,
): ValidationResult {
  const result = validate(config, schema);

  return {
    valid: result.valid,
    errors: (result.errors as Array<{ instanceLocation: string; error: string }>).map((e) => ({
      path: e.instanceLocation,
      message: e.error,
    })),
  };
}
