/** GitHub Issue ラベルの定義。 */
export interface LabelDefinition {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

/**
 * システムで使用する Issue ラベルの定義。
 *
 * 本オブジェクトは Domain 層の単一情報源として機能し、
 * 全レイヤー（UseCase / Skill / Gateway）から参照される。
 * 新しい type ラベルを追加する場合はここにエントリを追加すること。
 *
 * ## 設計意図
 *
 * - type:XXX は検索キーであり、安易な変更は過去 Issue の検索を破壊する
 * - 設定ファイル化せず Domain 層の列挙として固定し、型安全性を担保する
 */
export const LabelTypes = {
  Vision: {
    name: "type:Vision",
    color: "#5319e7",
    description:
      "誰のためにこのプロダクトが存在し、何故他ではなくこれが、他の人でなく自分たちが生み出すのか、長期的な価値提案と情熱を表現する",
  },
  ProductGoal: {
    name: "type:ProductGoal",
    color: "#008672",
    description: "複数スプリントにわたり達成すべき中期的なプロダクト目標を定義する",
  },
  Retrospective: {
    name: "type:Retrospective",
    color: "#e4e669",
    description: "スプリント中のセッションにおける人間とAIの協働の実態、課題、改善策を記録する",
  },
  Epic: {
    name: "type:Epic",
    color: "#6f42c1",
    description: "複数の機能を束ねる大規模な機能領域を管理する",
  },
  Feature: {
    name: "type:Feature",
    color: "#0052cc",
    description: "Epic配下の具体的な機能単位を定義する",
  },
  PBI: {
    name: "type:PBI",
    color: "#0366d6",
    description:
      "ユーザーにどのような価値をもたらすかを表現し、そのために必要な最小作業単位群を統括する",
  },
  WP: {
    name: "type:WP",
    color: "#28a745",
    description: "検証可能な受入基準を達成するために必要な作業を最小単位で管理する",
  },
  Review: {
    name: "type:Review",
    color: "#d73a4a",
    description: "スプリントレビューの計画と結果を記録する",
  },
} as const;

/** LabelTypes の値の共用体型。型ガードやパターンマッチに使用する。 */
export type LabelType = typeof LabelTypes[keyof typeof LabelTypes];

/** 全ラベル定義を配列として取得する。 */
export function getAllLabelDefinitions(): readonly LabelDefinition[] {
  return Object.values(LabelTypes) as readonly LabelDefinition[];
}
