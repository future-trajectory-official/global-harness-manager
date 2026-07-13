/**
 * Domain層の全型定義
 *
 * Architecture Design (L3) §3.4 に基づく。
 * 外部依存ゼロの純粋なTypeScript型定義。
 */

// ======== 抽象・共通型 ========

/** エンティティの名前。空文字不可。 */
export interface Title {
  readonly value: string;
}

/** GitHubリポジトリのスコープ（owner/repository）。 */
export interface EntityScope {
  readonly owner: string;
  readonly repository: string;
}

/** 未設定時のフォールバック値。Gateway層が実行時に実際の値を解決する。 */
export const UNKNOWN_SCOPE: EntityScope = { owner: "unknown", repository: "unknown" };

/**
 * Domain層のエンティティを一意に識別する。
 * id が undefined の場合は未作成（createItem が必要）。
 * id は GitHub node-id（グローバル識別子）、code はリポジトリ内識別子（Issue番号等）。
 * describe() は dry-run 時に「何をするか」を Plan として返す。
 */
export interface Identifier {
  readonly scope: EntityScope;
  readonly title: Title;
  readonly id?: string;
  readonly code?: string;
  describe(): Plan;
}

/**
 * Identifier の生成ヘルパー。
 *
 * ## 生成ルール
 *
 * | 関数 | id | code | 用途 | 該当操作 |
 * |------|----|------|------|----------|
 * | `identify(scope, title)` | undefined | undefined | 新規作成 | establish, set, start |
 * | `identify(scope, title, id)` | 指定値 | undefined | 既存参照(idのみ) | find, view |
 * | `identify(scope, title, id, code)` | 指定値 | 指定値 | 既存参照(完全) | pivot, end, setGoal |
 *
 * id が undefined かどうかで、UseCase は「新規作成」と「既存更新」を切り替える。
 */
export function identify<T extends Identifier>(
  scope: EntityScope,
  title: string,
  id?: string,
  code?: string,
): T {
  return {
    scope,
    title: { value: title },
    id,
    code,
    describe(): Plan {
      return { summary: title, steps: [] };
    },
  } as unknown as T;
}

/**
 * エンティティの検索条件。
 * describe() は dry-run 時に検索内容を Plan として返す。
 */
export interface SearchCondition {
  describe(): Plan;
}

/**
 * エンティティの開閉状態。
 * 全Domainエンティティ（PBI, WP, Vision, Epic, Feature, Sprint等）で共通。
 * archive/close 操作でのみ closed へ遷移する。
 */
export type EntityState = "open" | "closed";

/** EntityState の全値。 */
export const ENTITY_STATES: readonly EntityState[] = ["open", "closed"] as const;

/** 汎用リスト。items は不変。 */
export interface List<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
}

/** 変更理由を説明する。 */
export interface ChangeReason {
  readonly description: string;
}

/** 変更履歴の1エントリ。理由とタイムスタンプを持つ。 */
export interface ChangeEntry {
  readonly reason: ChangeReason;
  readonly timestamp: Date;
}

/**
 * PBI/WP の見積サイズ。不変クラス。
 * XS(1), S(2), M(3), L(5), XL(8) の5段階。
 */
export class Size {
  private constructor(
    private readonly _display: string,
    private readonly _weight: number,
  ) {}
  /** 表示名を返す（例: "M"）。 */
  toString(): string {
    return this._display;
  }
  /** ウェイト値を返す（例: 3）。 */
  toWeight(): number {
    return this._weight;
  }
  /** 表示名を取得する。 */
  get display(): string {
    return this._display;
  }
  /** ウェイト値を取得する。 */
  get weight(): number {
    return this._weight;
  }
  static readonly XS = new Size("XS", 1);
  static readonly S = new Size("S", 2);
  static readonly M = new Size("M", 3);
  static readonly L = new Size("L", 5);
  static readonly XL = new Size("XL", 8);
  /** 全インスタンスの配列。 */
  static readonly values: readonly Size[] = [Size.XS, Size.S, Size.M, Size.L, Size.XL];
  /** 文字列から Size を検索。見つからなければ undefined。 */
  static fromString(s: string): Size | undefined {
    return Size.values.find((sz) => sz._display === s);
  }
}

/** 予定サイズと実績サイズの乖離を記録する。 */
export interface SizeVariance {
  readonly estimate?: Size;
  readonly actual?: Size;
  readonly varianceReason?: string;
}

/** 工数実績。initialEstimate は作成時に設定し、plannedEstimate/actual は段階的に更新する。 */
export interface EffortRecord {
  readonly initialEstimate: number;
  readonly plannedEstimate?: number;
  readonly actual?: number;
}

/** AIによるプロセス分析結果。 */
export interface ProcessAnalysis {
  readonly planningReview: string;
  readonly executionReview: string;
  readonly improvementSuggestions: string;
}

/** プロセスに関する証跡。effort または processAnalysis を保持。 */
export interface ProcessEvidence {
  readonly effort?: EffortRecord;
  readonly processAnalysis?: ProcessAnalysis;
}

/** 実行計画。summary と Step のリストで構成。 */
export interface Plan {
  readonly summary: string;
  readonly steps: readonly Step[];
}

// ======== Entity + Operation 型（Discriminated Step 用） ========

/** エンティティ種別。全10種のDomainエンティティを識別する。 */
export type EntityType =
  | "Vision"
  | "ProductGoal"
  | "Feature"
  | "Epic"
  | "ProductBacklogItem"
  | "WorkPackage"
  | "Sprint"
  | "Review"
  | "Retrospective"
  | "Scope";

// ---- Entity-specific OperationType ----

/** Vision エンティティの操作種別。汎用操作に加え establish/pivot の混在を許容。 */
export type VisionOperation = "create" | "update" | "view" | "search" | "comment";

/** ProductGoal エンティティの操作種別。 */
export type ProductGoalOperation = "create" | "update" | "view" | "search" | "comment";

/** Feature エンティティの操作種別。 */
export type FeatureOperation = "create" | "update" | "view" | "search" | "comment";

/** Epic エンティティの操作種別。 */
export type EpicOperation = "create" | "update" | "view" | "search" | "comment" | "showHierarchy";

/** ProductBacklogItem エンティティの操作種別。PbiValidator.PbiOperation と対応。 */
export type ProductBacklogItemOperation =
  | "propose"
  | "commit"
  | "start"
  | "complete"
  | "archive"
  | "update"
  | "estimateSize"
  | "confirmSize"
  | "recordAnalysis"
  | "defineAcceptanceCriteria"
  | "assignToFeature"
  | "unassignFromFeature"
  | "view"
  | "search";

/** WorkPackage エンティティの操作種別。WpValidator.WpOperation と対応。 */
export type WorkPackageOperation =
  | "define"
  | "commit"
  | "start"
  | "complete"
  | "archive"
  | "update"
  | "assignToProductBacklogItem"
  | "unassignFromProductBacklogItem"
  | "estimateInitialEffort"
  | "estimatePlannedEffort"
  | "recordActualEffort"
  | "recordAnalysis"
  | "recordSessionMetrics"
  | "view"
  | "search";

/** Sprint エンティティの操作種別。 */
export type SprintOperation =
  | "create"
  | "endSprint"
  | "setGoal"
  | "setDueDate"
  | "view"
  | "search"
  | "comment";

/** Review エンティティの操作種別。ReviewValidator.ReviewOperation と対応。 */
export type ReviewOperation =
  | "plan"
  | "update"
  | "revise"
  | "report"
  | "archive"
  | "view"
  | "search";

/** Retrospective エンティティの操作種別。RetrospectiveValidator.RetrospectiveOperation と対応。 */
export type RetrospectiveOperation = "plan" | "execute" | "archive" | "view" | "search";

/** Scope エンティティの操作種別。スコープ解決を表す。 */
export type ScopeOperation = "resolve";

/** 全Entityの操作を統合したユニオン型。Gateway層でのハンドラ解決に使用する。 */
export type StepOperation =
  | VisionOperation
  | ProductGoalOperation
  | FeatureOperation
  | EpicOperation
  | ProductBacklogItemOperation
  | WorkPackageOperation
  | SprintOperation
  | ReviewOperation
  | RetrospectiveOperation
  | ScopeOperation;

/**
 * Plan 内の1実行単位。Discriminated Union により entity と operation の組合せを型安全に表現する。
 * entity ごとに許容される operation が異なるため、不正な組合せはコンパイル時に検出される。
 */
export type Step = {
  readonly entity: "Vision";
  readonly operation: VisionOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "ProductGoal";
  readonly operation: ProductGoalOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Feature";
  readonly operation: FeatureOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Epic";
  readonly operation: EpicOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "ProductBacklogItem";
  readonly operation: ProductBacklogItemOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "WorkPackage";
  readonly operation: WorkPackageOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Sprint";
  readonly operation: SprintOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Review";
  readonly operation: ReviewOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Retrospective";
  readonly operation: RetrospectiveOperation;
  readonly params: Record<string, unknown>;
} | {
  readonly entity: "Scope";
  readonly operation: ScopeOperation;
  readonly params: Record<string, unknown>;
};

/** Plan の実行結果。各 Step の結果を保持。 */
export interface ExecutionResult {
  readonly stepResults: readonly StepResult[];
}

/**
 * Gateway実行時のコンテキスト。
 * 前Stepの実行結果を後続Stepが参照するための連鎖機構。
 * createItem で作成した Issue 番号を addComment が解決する等に使用する。
 */
export interface ExecutionContext {
  readonly stepResults: readonly StepResult[];
}

/** 1Step の実行結果。success=false の場合 error に理由が設定される。 */
export interface StepResult {
  readonly operation: string;
  readonly success: boolean;
  /** Issue番号（リポジトリ内で一意）。gh CLI 操作の大半はこちらを使用する。 */
  readonly itemId?: string;
  /** GitHub GraphQL node_id（グローバルに一意）。必要に応じて API 操作に使用する。 */
  readonly nodeId?: string;
  readonly output?: unknown;
  readonly error?: string;
}

// ======== Vision系 ========

/** ビジョンステートメント。対象ユーザー・価値・差別化要因で構成。 */
export interface VisionStatement {
  readonly targetAudience: string;
  readonly value: string;
  readonly differentiator: string;
  readonly elevatorPitch?: string;
  readonly passion?: string;
}

/** 単一のターゲットアウトカム。タイトルと説明文で構成。 */
export interface Outcome {
  readonly title: string;
  readonly description: string;
}

/** アウトカムのリスト。 */
export interface Outcomes {
  readonly items: readonly Outcome[];
}

/** ビジョンの識別子。 */
export interface VisionIdentifier extends Identifier {
}

/** ビジョンデータ全体。ステートメント・アウトカム・変更履歴・開閉状態を内包。 */
export interface VisionData {
  readonly statement: VisionStatement;
  readonly outcomes: Outcomes;
  readonly changeHistory?: readonly ChangeEntry[];
  readonly state: EntityState;
}

// ======== Product Goal系 ========

/** プロダクトゴールの記述。 */
export interface GoalStatement {
  readonly description: string;
}

/** プロダクトゴールの識別子。 */
export interface ProductGoalIdentifier extends Identifier {
}

/** プロダクトゴールデータ。変更履歴・開閉状態を保持可能。 */
export interface ProductGoalData {
  readonly statement: GoalStatement;
  readonly changeHistory?: readonly ChangeEntry[];
  readonly state: EntityState;
}

// ======== Sprint系 ========

/**
 * Sprint の識別子。
 * 直接生成せず `sprintId(scope, number, id?)` を使用すること。
 * これにより "Sprint 16", "sprint 16", "Sprint16" 等の表記ブレを防止する。
 */
export interface SprintIdentifier extends Identifier {
}

/**
 * Sprint の Identifier を生成する。
 * number から正規化された "Sprint N" 形式の title を自動設定する。
 * id を省略した場合は新規作成用（start）、指定した場合は既存参照用（end, setGoal, find）。
 */
export function sprintId(
  scope: EntityScope,
  number: number,
  id?: string,
  code?: string,
): SprintIdentifier {
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`INVALID_INPUT: Sprint number must be a positive integer`);
  }
  return identify(scope, `Sprint ${number}`, id, code);
}

/** Sprint の全データ。 */
export interface SprintData {
  readonly identifier: SprintIdentifier;
  readonly goal: GoalStatement;
  readonly dueDate?: Date;
  readonly state: EntityState;
}

// ======== Epic系 ========

/** Epic の説明文。 */
export interface EpicStatement {
  readonly description: string;
}

/** Epic の識別子。 */
export interface EpicIdentifier extends Identifier {
}

/** Epic の全データ。 */
export interface EpicData {
  readonly identifier: EpicIdentifier;
  readonly statement: EpicStatement;
  readonly state: EntityState;
}

/** Epic の検索条件。キーワードで部分一致検索可能。 */
export interface EpicSearchCondition extends SearchCondition {
  readonly keyword?: string;
}

// ======== Feature系 ========

/** Feature の説明文。 */
export interface FeatureStatement {
  readonly description: string;
}

/** Feature の識別子。 */
export interface FeatureIdentifier extends Identifier {
}

/** Feature の全データ。parentEpic で親Epicを参照。 */
export interface FeatureData {
  readonly identifier: FeatureIdentifier;
  readonly statement: FeatureStatement;
  readonly parentEpic?: EpicIdentifier;
  readonly state: EntityState;
}

/** Feature の検索条件。親Epicでの絞り込みが可能。 */
export interface FeatureSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly parentEpic?: EpicIdentifier;
}

// ======== PBI系 ========

/** PBI の記述。サマリー・成果物・証明方法を含む。 */
export interface ProductBacklogItemStatement {
  readonly summary: string;
  readonly artifacts?: Artifacts;
  readonly proofMethod?: string;
}

/** 成果物カテゴリ。 */
export interface ArtifactCategory {
  readonly name: string;
  readonly items: readonly ArtifactItem[];
}

/** 単一の成果物アイテム。 */
export interface ArtifactItem {
  readonly description: string;
}

/** 成果物の集合。カテゴリに分類される。 */
export interface Artifacts {
  readonly categories: readonly ArtifactCategory[];
}

/** PBI の識別子。 */
export interface ProductBacklogItemIdentifier extends Identifier {
}

/** PBI のプロセス証跡。SizeVariance を含む。 */
export interface ProductBacklogItemProcessEvidence extends ProcessEvidence {
  readonly sizeVariance: SizeVariance;
}

/** PBI の全データ。親Feature・進行段階・開閉状態・プロセス証跡を保持可能。 */
export interface ProductBacklogItemData {
  readonly identifier: ProductBacklogItemIdentifier;
  readonly statement: ProductBacklogItemStatement;
  readonly parentFeature?: FeatureIdentifier;
  readonly stage: Stage;
  readonly state: EntityState;
  readonly processEvidence?: ProductBacklogItemProcessEvidence;
}

/** PBI の検索条件。キーワード・スプリント番号・ステータスで絞り込み可能。 */
export interface ProductBacklogItemSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly sprintNumber?: number;
  readonly status?: string;
}

/**
 * 作業アイテム（PBI, WP）の進行段階。
 * propose/define により idea で生成され、commit → todo、start → inProgress、complete → done と遷移する。
 */
export type Stage = "idea" | "todo" | "inProgress" | "done";

/** Stage の全値。 */
export const STAGES: readonly Stage[] = [
  "idea",
  "todo",
  "inProgress",
  "done",
] as const;

// ======== WP系 ========

/** 受入基準。judgment で判定状態を管理。 */
export interface AcceptanceCriteria {
  readonly number: string;
  readonly description: string;
  readonly judgment: "unchecked" | "pass" | "conditional" | "fail" | "removed";
  readonly evidence?: string;
  readonly note?: string;
}

/** 受入基準のリスト。 */
export interface AcceptanceCriterias {
  readonly items: readonly AcceptanceCriteria[];
}

/** WP の記述。AC のリストを含む。 */
export interface WorkPackageStatement {
  readonly acceptanceCriteria: AcceptanceCriterias;
}

/** WP の識別子。 */
export interface WorkPackageIdentifier extends Identifier {
}

/** セッションの協働指標。各スコアは1〜5。 */
export interface SessionMetrics {
  readonly intentAlignmentRate: number;
  readonly constraintAdherenceScore: number;
  readonly contextExtractionQuality: number;
  readonly workSizeStability: number;
  readonly comment: string;
}

/** WP のプロセス証跡。 */
export interface WorkPackageProcessEvidence extends ProcessEvidence {
}

/** WP の全データ。親PBI・進行段階・開閉状態・セッションメトリクス・KPTA を保持可能。 */
export interface WorkPackageData {
  readonly identifier: WorkPackageIdentifier;
  readonly statement: WorkPackageStatement;
  readonly parentPbi: ProductBacklogItemIdentifier;
  readonly stage: Stage;
  readonly state: EntityState;
  readonly processEvidence?: WorkPackageProcessEvidence;
  readonly sessionMetrics?: SessionMetrics;
  readonly kpta?: KeepProblemTryAdvice;
}

/** WP の検索条件。親PBI・スプリント・ステータスで絞り込み可能。 */
export interface WorkPackageSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly parentPbi?: ProductBacklogItemIdentifier;
  readonly sprintNumber?: number;
  readonly status?: string;
}

// ======== Review系 ========

/** スプリントレビューの記述。環境情報を保持。 */
export interface ReviewStatement {
  readonly environment: string;
}

/** AC のグループ。1PBI/WP 単位の判定結果をまとめる。 */
export interface AcGroup {
  readonly pbiNumber: number;
  readonly pbiTitle?: string;
  readonly wpNumber: string;
  readonly wpTitle?: string;
  readonly acJudgments: readonly AcJudgment[];
}

/** 単一 AC の判定結果。AcceptanceCriteria と同一構造。 */
export type AcJudgment = AcceptanceCriteria;

/** レビュー全体の判定。pass/conditional/fail の3値。 */
export interface OverallReviewResult {
  readonly judgment: "pass" | "conditional" | "fail";
  readonly reason: string;
}

/** スプリントレビューの識別子。 */
export interface ReviewIdentifier extends Identifier {
}

/** スプリントレビューの全データ。対象スプリント・計画・事後ACグループと全体判定・開閉状態を含む。 */
export interface ReviewData {
  readonly identifier: ReviewIdentifier;
  readonly statement: ReviewStatement;
  readonly sprint: SprintIdentifier;
  readonly plannedAcGroups: readonly AcGroup[];
  readonly postPlanAcGroups?: readonly AcGroup[];
  readonly overallResult?: OverallReviewResult;
  readonly state: EntityState;
}

/** スプリントレビューの検索条件。 */
export interface ReviewSearchCondition extends SearchCondition {
  readonly sprintNumber?: number;
}

// ======== Retrospective系 ========

/** メトリクスの基底インターフェース。拡張用。 */
// deno-lint-ignore no-empty-interface
export interface Metrics {
}

/** スプリント全体のメトリクス。各指標はパーセント値または実数。 */
export interface SprintMetrics extends Metrics {
  readonly goalAchievementRate: number;
  readonly estimationAccuracy: number;
  readonly qualityIntegrity: number;
  readonly collaborationDiscipline: number;
  readonly velocity: number;
}

/** KPTA（Keep/Problem/Try/Advise）形式の振り返り。 */
export interface KeepProblemTryAdvice {
  readonly keep: string;
  readonly problem: string;
  readonly try: string;
  readonly advise: string;
}

/** 振り返りの識別子。 */
export interface RetrospectiveIdentifier extends Identifier {
}

/** 振り返りの全データ。対象スプリント・KPTA・メトリクス・開閉状態を保持。 */
export interface RetrospectiveData {
  readonly identifier: RetrospectiveIdentifier;
  readonly sprint: SprintIdentifier;
  readonly kpta?: KeepProblemTryAdvice;
  readonly metrics?: SprintMetrics;
  readonly state: EntityState;
}

/** 振り返りの検索条件。 */
export interface RetrospectiveSearchCondition extends SearchCondition {
  readonly sprintNumber?: number;
}

// ======== Gateway関連型 ========

/** GitHub Project V2 ボードの出力。id と name を持つ。 */
export interface BoardOutput {
  readonly id: number;
  readonly name: string;
}

/** 設定ファイルの内容。source にファイルパス、content に実データ。 */
export interface ConfigContent {
  readonly source: string;
  readonly content: string;
}

/** GitHub Issue ラベルの定義。label-types.ts から再エクスポート。 */
export type { LabelDefinition } from "./label-types.ts";
