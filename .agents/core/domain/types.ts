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

/**
 * Domain層のエンティティを一意に識別する。
 * id が undefined の場合は未作成（createItem が必要）。
 * describe() は dry-run 時に「何をするか」を Plan として返す。
 */
export interface Identifier {
  readonly scope: EntityScope;
  readonly title: Title;
  readonly id?: string;
  describe(): Plan;
}

/**
 * エンティティの検索条件。
 * describe() は dry-run 時に検索内容を Plan として返す。
 */
export interface SearchCondition {
  describe(): Plan;
}

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

/** Gateway層が実行する操作種別。 */
export type Operation =
  | "createItem"
  | "updateItem"
  | "closeItem"
  | "findItem"
  | "searchItems"
  | "createTimebox"
  | "updateTimebox"
  | "closeTimebox"
  | "readConfig"
  | "writeConfig";

/** Plan 内の1実行単位。operation と params で構成。 */
export interface Step {
  readonly operation: Operation;
  readonly params: Record<string, unknown>;
}

/** Plan の実行結果。各 Step の結果を保持。 */
export interface ExecutionResult {
  readonly stepResults: readonly StepResult[];
}

/** 1Step の実行結果。success=false の場合 error に理由が設定される。 */
export interface StepResult {
  readonly operation: string;
  readonly success: boolean;
  readonly itemId?: string;
  readonly output?: unknown;
  readonly error?: string;
}

// ======== Vision系 ========

/** ビジョンステートメント。対象ユーザー・価値・差別化要因で構成。 */
export interface VisionStatement {
  readonly targetAudience: string;
  readonly value: string;
  readonly differentiator: string;
}

/** 単一のターゲットアウトカム。 */
export interface Outcome {
  readonly description: string;
}

/** アウトカムのリスト。 */
export interface Outcomes {
  readonly items: readonly Outcome[];
}

/** ビジョンデータ全体。ステートメント・アウトカム・変更履歴を内包。 */
export interface VisionData {
  readonly statement: VisionStatement;
  readonly outcomes: Outcomes;
  readonly changeHistory?: readonly ChangeEntry[];
}

// ======== Product Goal系 ========

/** プロダクトゴールの記述。 */
export interface GoalStatement {
  readonly description: string;
}

/** プロダクトゴールデータ。変更履歴を保持可能。 */
export interface ProductGoalData {
  readonly statement: GoalStatement;
  readonly changeHistory?: readonly ChangeEntry[];
}

// ======== Sprint系 ========

/** Sprint の識別子。title.value がスプリント名を保持。ファクトリで number を解決する。 */
export interface SprintIdentifier extends Identifier {
}

/** Sprint の全データ。 */
export interface SprintData {
  readonly identifier: SprintIdentifier;
  readonly goal: GoalStatement;
  readonly dueDate?: Date;
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

/** PBI の全データ。親Featureとプロセス証跡を保持可能。 */
export interface ProductBacklogItemData {
  readonly identifier: ProductBacklogItemIdentifier;
  readonly statement: ProductBacklogItemStatement;
  readonly parentFeature?: FeatureIdentifier;
  readonly processEvidence?: ProductBacklogItemProcessEvidence;
}

/** PBI の検索条件。キーワード・スプリント番号・ステータスで絞り込み可能。 */
export interface ProductBacklogItemSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly sprintNumber?: number;
  readonly status?: string;
}

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

/** WP の全データ。親PBI・セッションメトリクス・KPTA を保持可能。 */
export interface WorkPackageData {
  readonly identifier: WorkPackageIdentifier;
  readonly statement: WorkPackageStatement;
  readonly parentPbi: ProductBacklogItemIdentifier;
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
  readonly wpNumber: number;
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

/** スプリントレビューの全データ。対象スプリント・計画・事後ACグループと全体判定を含む。 */
export interface ReviewData {
  readonly identifier: ReviewIdentifier;
  readonly statement: ReviewStatement;
  readonly sprint: SprintIdentifier;
  readonly plannedAcGroups: readonly AcGroup[];
  readonly postPlanAcGroups?: readonly AcGroup[];
  readonly overallResult?: OverallReviewResult;
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

/** 振り返りの全データ。対象スプリント・KPTA・メトリクスを保持。 */
export interface RetrospectiveData {
  readonly identifier: RetrospectiveIdentifier;
  readonly sprint: SprintIdentifier;
  readonly kpta?: KeepProblemTryAdvice;
  readonly metrics?: SprintMetrics;
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
