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
 * EffortRecord を生成する。initialEstimate のみ必須。plannedEstimate/actual は setter で段階的に設定する。
 */
export function createEffortRecord(initialEstimate: number): EffortRecord {
  if (!Number.isFinite(initialEstimate) || initialEstimate < 0) {
    throw new Error(
      `INVALID_INPUT: initialEstimate は0以上の数値である必要があります (received: ${initialEstimate})`,
    );
  }
  return { initialEstimate };
}

/**
 * EffortRecord に plannedEstimate を設定した新しいオブジェクトを返す。元のオブジェクトは不変。
 * plannedEstimate は initialEstimate に対し上方・下方どちらの修正も許容する
 * （guides/backlog-guidelines.md 2.2.1「計画前見積を上方または下方に修正した値となる」）。
 * 妥当な検証は0以上の数値であることのみ。
 */
export function withPlannedEstimate(
  record: EffortRecord,
  plannedEstimate: number,
): EffortRecord {
  if (!Number.isFinite(plannedEstimate) || plannedEstimate < 0) {
    throw new Error(
      `INVALID_INPUT: plannedEstimate は0以上の数値である必要があります (received: ${plannedEstimate})`,
    );
  }
  return { ...record, plannedEstimate };
}

/**
 * EffortRecord に actual を設定した新しいオブジェクトを返す。元のオブジェクトは不変。
 */
export function withActual(
  record: EffortRecord,
  actual: number,
): EffortRecord {
  if (!Number.isFinite(actual) || actual < 0) {
    throw new Error(
      `INVALID_INPUT: actual は0以上の数値である必要があります (received: ${actual})`,
    );
  }
  return { ...record, actual };
}

/**
 * SizeVariance を生成する。全てのフィールドは Builder で段階的に設定する。
 */
export function createSizeVariance(): SizeVariance {
  return {};
}

/**
 * SizeVariance に 予定サイズ を設定した新しいオブジェクトを返す。
 */
export function withSizeEstimate(
  sv: SizeVariance,
  estimate: Size,
): SizeVariance {
  return { ...sv, estimate };
}

/**
 * SizeVariance に 実績サイズ を設定した新しいオブジェクトを返す。
 */
export function withSizeActual(
  sv: SizeVariance,
  actual: Size,
): SizeVariance {
  return { ...sv, actual };
}

/**
 * SizeVariance に 乖離理由 を設定した新しいオブジェクトを返す。
 */
export function withVarianceReason(
  sv: SizeVariance,
  varianceReason: string,
): SizeVariance {
  return { ...sv, varianceReason };
}
