import { Size } from "./types.ts";
import type { EffortRecord, SizeVariance } from "./types.ts";

/**
 * 文字列から Size インスタンスを生成する。
 * 不正な値の場合はエラーをスローする。
 */
export function createSize(value: string): Size {
  const size = Size.fromString(value);
  if (size === undefined) {
    throw new Error(
      `INVALID_INPUT: 無効なSize値です: "${value}"。有効な値: XS, S, M, L, XL`,
    );
  }
  return size;
}

/**
 * EffortRecord を生成する。全数値は0以上である必要がある。
 */
export function createEffortRecord(
  initialEstimate: number,
  plannedEstimate: number,
  actual: number,
): EffortRecord {
  if (!Number.isFinite(initialEstimate) || initialEstimate < 0) {
    throw new Error(
      `INVALID_INPUT: initialEstimate は0以上の数値である必要があります (received: ${initialEstimate})`,
    );
  }
  if (!Number.isFinite(plannedEstimate) || plannedEstimate < 0) {
    throw new Error(
      `INVALID_INPUT: plannedEstimate は0以上の数値である必要があります (received: ${plannedEstimate})`,
    );
  }
  if (!Number.isFinite(actual) || actual < 0) {
    throw new Error(
      `INVALID_INPUT: actual は0以上の数値である必要があります (received: ${actual})`,
    );
  }
  return { initialEstimate, plannedEstimate, actual } as const;
}

/**
 * SizeVariance を生成する。全てのフィールドは任意。
 */
export function createSizeVariance(
  options: {
    estimate?: Size;
    actual?: Size;
    varianceReason?: string;
  },
): SizeVariance {
  return {
    estimate: options.estimate,
    actual: options.actual,
    varianceReason: options.varianceReason,
  };
}
