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

/**
 * Project V2 フィールド型の定義。
 *
 * `gh project field-create --data-type` に渡す型名の正。
 * フィールド名はリポジトリ・アカウントに依存せず不変のため、本モジュールが単一の正源泉となる。
 */
export type FieldType = "TEXT" | "SINGLE_SELECT" | "NUMBER";

/**
 * フィールド名から型への対応表（design-spec 5.3 の型定義）。
 *
 * サイズ見積・実績は T-Shirt Size（XS/S/M/L/XL）を単一選択で設定するため
 * `SINGLE_SELECT` 型とする。他のフィールドはテキスト入力のため `TEXT` 型とする。
 */
export const FIELD_TYPES = {
  "harness-size-estimate": "SINGLE_SELECT",
  "harness-size-actual": "SINGLE_SELECT",
  "harness-effort-summary": "TEXT",
  "harness-variance-review-size": "TEXT",
  "harness-variance-review-planning": "TEXT",
  "harness-variance-review-execution": "TEXT",
  "harness-improvement-suggestions": "TEXT",
  "harness-metrics-summary": "TEXT",
  "harness-metrics-intent-alignment": "TEXT",
  "harness-metrics-constraint-adherence": "TEXT",
  "harness-metrics-context-extraction": "TEXT",
  "harness-metrics-work-size-stability": "TEXT",
  "harness-metrics-goal-achievement": "TEXT",
  "harness-metrics-estimation-accuracy": "TEXT",
  "harness-metrics-quality-integrity": "TEXT",
  "harness-metrics-collaboration-discipline": "TEXT",
  "harness-metrics-velocity": "TEXT",
  "harness-kpt-keep": "TEXT",
  "harness-kpt-problem": "TEXT",
  "harness-kpt-try": "TEXT",
  "harness-kpt-advise": "TEXT",
  "harness-sequence": "TEXT",
} as const satisfies Record<HarnessFieldName, FieldType>;

/** ボード識別子。`.harnessrc` の projects キーと一致する。 */
export const BOARDS = {
  productBacklog: "productBacklog",
  sprintBoard: "sprintBoard",
  retrospectiveBoard: "retrospectiveBoard",
} as const;

export type BoardKey = keyof typeof BOARDS;

/**
 * ボード種別と番号の対応（`.harnessrc` の projects キー）。
 *
 * `generate-harnessrc.ts`・`create-boards.ts` が共有する正の定義。本モジュールが
 * 単一の正源泉であり、スクリプト側は再定義せず本型を参照する（WP #763 レビュー指摘対応）。
 * 既存の利用箇所との互換のため `generate-harnessrc.ts` から再エクスポートする。
 */
export interface HarnessRcBoards {
  readonly productBacklog: number;
  readonly sprintBoard: number;
  readonly retrospectiveBoard: number;
}

/**
 * 未確定のボード番号の初期値（全キー0）を生成する。
 *
 * `BOARDS` のキー集合（`create-boards.ts` の `BOARD_ORDER` と同一）から生成し、
 * ゼロ初期化リテラルの重複を排除する（WP #763 レビュー指摘対応）。
 * 順序付きの処理自体は `BOARD_ORDER` を使用すること。
 *
 * @returns 全キーが0のボード番号（呼出元で複写して使用する）
 */
export function emptyBoardNumbers(): HarnessRcBoards {
  const numbers = {} as Record<BoardKey, number>;
  for (const key of Object.values(BOARDS)) {
    numbers[key] = 0;
  }
  return numbers;
}

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
