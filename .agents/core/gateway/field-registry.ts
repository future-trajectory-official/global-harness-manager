/**
 * Project V2 カスタムフィールドの正のレジストリ。
 *
 * design-spec.md 5.3（カスタムフィールド一覧）と architecture-design.md 第7章
 * （.harnessrc JSONキー定義）の内容を、機械参照可能な型付き定数として集約する。
 * FIELD 名はリポジトリ・アカウントに依存せず不変のため、本モジュールが単一の正源泉となる。
 *
 * 本モジュールはゲートウェイ層に属する（ドメインオブジェクトと GitHub ProjectV2 実装の
 * マッピングはゲートウェイ層の責務。ドメイン層に GitHub 実装の知識を持ち込まない）。
 */

/** 全 harness-* カスタムフィールド名の一覧（design-spec 5.3 の正のレジストリ）。 */
export const HARNESS_FIELDS = [
  // Product Backlog Board
  "harness-size-estimate",
  "harness-size-actual",
  "harness-effort-summary",
  "harness-variance-review-size",
  "harness-variance-review-planning",
  "harness-variance-review-execution",
  "harness-improvement-suggestions",
  // Sprint Board
  "harness-metrics-summary",
  "harness-metrics-intent-alignment",
  "harness-metrics-constraint-adherence",
  "harness-metrics-context-extraction",
  "harness-metrics-work-size-stability",
  "harness-kpt-keep",
  "harness-kpt-problem",
  "harness-kpt-try",
  "harness-kpt-advise",
  "harness-sequence",
  // Retrospective Board
  "harness-metrics-goal-achievement",
  "harness-metrics-estimation-accuracy",
  "harness-metrics-quality-integrity",
  "harness-metrics-collaboration-discipline",
  "harness-metrics-velocity",
] as const;

export type HarnessFieldName = (typeof HARNESS_FIELDS)[number];

/**
 * フィールド名の名前付きアクセサ。各ハンドラーは `${FIELD.xxx}` 形式で参照し、
 * リテラルのハードコード（複数箇所への散在）を排除するための単一源泉。
 * 値は HARNESS_FIELDS と同一で、`FIELD` の値集合は HARNESS_FIELDS に包含される。
 */
export const FIELD = {
  sizeEstimate: "harness-size-estimate",
  sizeActual: "harness-size-actual",
  effortSummary: "harness-effort-summary",
  varianceReviewSize: "harness-variance-review-size",
  varianceReviewPlanning: "harness-variance-review-planning",
  varianceReviewExecution: "harness-variance-review-execution",
  improvementSuggestions: "harness-improvement-suggestions",
  metricsSummary: "harness-metrics-summary",
  metricsIntentAlignment: "harness-metrics-intent-alignment",
  metricsConstraintAdherence: "harness-metrics-constraint-adherence",
  metricsContextExtraction: "harness-metrics-context-extraction",
  metricsWorkSizeStability: "harness-metrics-work-size-stability",
  metricsGoalAchievement: "harness-metrics-goal-achievement",
  metricsEstimationAccuracy: "harness-metrics-estimation-accuracy",
  metricsQualityIntegrity: "harness-metrics-quality-integrity",
  metricsCollaborationDiscipline: "harness-metrics-collaboration-discipline",
  metricsVelocity: "harness-metrics-velocity",
  kptKeep: "harness-kpt-keep",
  kptProblem: "harness-kpt-problem",
  kptTry: "harness-kpt-try",
  kptAdvise: "harness-kpt-advise",
  sequence: "harness-sequence",
} as const;

export type HarnessFieldConstant = (typeof FIELD)[keyof typeof FIELD];

/** ボード識別子。`.harnessrc` の projects キーと一致する。 */
export const BOARDS = {
  productBacklog: "productBacklog",
  sprintBoard: "sprintBoard",
  retrospectiveBoard: "retrospectiveBoard",
} as const;

export type BoardKey = keyof typeof BOARDS;

/**
 * ボード別カスタムフィールド定義（design-spec 5.3）。
 * フィールドはボードごとに定義され、同名フィールド（`harness-metrics-summary`,
 * `harness-kpt-*`）はボードが異なれば別物として扱う。
 * 値は設計spec 5.3 の各ボードのレジストリと厳密に対応する。
 */
export const BOARD_FIELDS = {
  productBacklog: [
    "harness-size-estimate",
    "harness-size-actual",
    "harness-effort-summary",
    "harness-variance-review-size",
    "harness-variance-review-planning",
    "harness-variance-review-execution",
    "harness-improvement-suggestions",
  ],
  sprintBoard: [
    "harness-effort-summary",
    "harness-variance-review-planning",
    "harness-variance-review-execution",
    "harness-improvement-suggestions",
    "harness-metrics-summary",
    "harness-metrics-intent-alignment",
    "harness-metrics-constraint-adherence",
    "harness-metrics-context-extraction",
    "harness-metrics-work-size-stability",
    "harness-kpt-keep",
    "harness-kpt-problem",
    "harness-kpt-try",
    "harness-kpt-advise",
    "harness-sequence",
  ],
  retrospectiveBoard: [
    "harness-metrics-summary",
    "harness-metrics-goal-achievement",
    "harness-metrics-estimation-accuracy",
    "harness-metrics-quality-integrity",
    "harness-metrics-collaboration-discipline",
    "harness-metrics-velocity",
    "harness-kpt-keep",
    "harness-kpt-problem",
    "harness-kpt-try",
    "harness-kpt-advise",
  ],
} as const satisfies Record<BoardKey, readonly string[]>;

/** V2 組み込みの Status フィールド名（各ボード共通。harness-* レジストリ外）。 */
export const STATUS_FIELD = "Status";

/**
 * 「どのボードのどのフィールド」かを一意に特定する参照構造体。
 * 同一フィールド名が複数ボードに存在する場合（harness-metrics-summary / harness-kpt-*）でも、
 * boardKey で区別できる。本構造体は Gateway 層のフィールド操作の参照単位である。
 * fieldName は harness-* カスタムフィールド、または V2 組み込みの Status を表す。
 */
export type FieldRef = {
  /** ボード識別子（BOARDS のキー）。 */
  readonly boardKey: BoardKey;
  /** フィールド名（HARNESS_FIELDS の値、または STATUS_FIELD）。 */
  readonly fieldName: HarnessFieldConstant | typeof STATUS_FIELD;
};

/** 指定したカスタムフィールドが特定ボードに所属するかを検証する。 */
export function isFieldOnBoard(
  board: BoardKey,
  field: HarnessFieldConstant,
): boolean {
  return (BOARD_FIELDS[board] as readonly string[]).includes(field);
}

/** カスタムフィールドの FieldRef を構築し、ボードとフィールドの対応が正しいことを保証する。 */
export function fieldRef(board: BoardKey, field: HarnessFieldConstant): FieldRef {
  if (!isFieldOnBoard(board, field)) {
    throw new Error(
      `Field "${field}" is not defined on board "${BOARDS[board]}"`,
    );
  }
  return { boardKey: board, fieldName: field };
}

/** V2 組み込みの Status フィールドの FieldRef を構築する（全ボード共通）。 */
export function statusRef(board: BoardKey): FieldRef {
  return { boardKey: board, fieldName: STATUS_FIELD };
}

export function isHarnessField(name: string): name is HarnessFieldName {
  return (HARNESS_FIELDS as readonly string[]).includes(name);
}
