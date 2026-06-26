/**
 * Domain層の全型定義
 *
 * Architecture Design (L3) §3.4 に基づく。
 * 外部依存ゼロの純粋なTypeScript型定義。
 */

// ======== 抽象・共通型 ========

export interface Title {
  readonly value: string;
}

export interface EntityScope {
  readonly owner: string;
  readonly repository: string;
}

export interface Identifier {
  readonly scope: EntityScope;
  readonly title: Title;
  readonly id?: string;
  describe(): Plan;
}

export interface SearchCondition {
  describe(): Plan;
}

export interface List<T> {
  readonly items: readonly T[];
  readonly totalCount: number;
}

export interface ChangeReason {
  readonly description: string;
}

export class Size {
  private constructor(
    private readonly _display: string,
    private readonly _weight: number,
  ) {}
  toString(): string {
    return this._display;
  }
  toWeight(): number {
    return this._weight;
  }
  get display(): string {
    return this._display;
  }
  get weight(): number {
    return this._weight;
  }
  static readonly XS = new Size("XS", 1);
  static readonly S = new Size("S", 2);
  static readonly M = new Size("M", 3);
  static readonly L = new Size("L", 5);
  static readonly XL = new Size("XL", 8);
  static readonly values: readonly Size[] = [Size.XS, Size.S, Size.M, Size.L, Size.XL];
  static fromString(s: string): Size | undefined {
    return Size.values.find((sz) => sz._display === s);
  }
}

export interface SizeVariance {
  readonly estimate?: Size;
  readonly actual?: Size;
  readonly varianceReason?: string;
}

export interface EffortRecord {
  readonly initialEstimate: number;
  readonly plannedEstimate: number;
  readonly actual: number;
}

export interface ProcessAnalysis {
  readonly planningReview: string;
  readonly executionReview: string;
  readonly improvementSuggestions: string;
}

export interface ProcessEvidence {
  readonly effort?: EffortRecord;
  readonly processAnalysis?: ProcessAnalysis;
}

export interface Plan {
  readonly summary: string;
  readonly steps: readonly Step[];
}

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

export interface Step {
  readonly operation: Operation;
  readonly params: Record<string, unknown>;
}

export interface ExecutionResult {
  readonly stepResults: readonly StepResult[];
}

export interface StepResult {
  readonly operation: string;
  readonly success: boolean;
  readonly itemId?: string;
  readonly output?: unknown;
  readonly error?: string;
}

// ======== Vision系 ========

export interface VisionStatement {
  readonly targetAudience: string;
  readonly value: string;
  readonly differentiator: string;
}

export interface Outcome {
  readonly description: string;
}

export interface Outcomes {
  readonly items: readonly Outcome[];
}

export interface VisionData {
  readonly statement: VisionStatement;
  readonly outcomes: Outcomes;
}

// ======== Product Goal系 ========

export interface GoalStatement {
  readonly description: string;
}

export interface ProductGoalData {
  readonly statement: GoalStatement;
}

// ======== Sprint系 ========

export interface SprintIdentifier extends Identifier {
  readonly number: number;
}

export interface SprintData {
  readonly identifier: SprintIdentifier;
  readonly goal: GoalStatement;
  readonly dueDate?: Date;
}

// ======== Epic系 ========

export interface EpicStatement {
  readonly description: string;
}

export interface EpicIdentifier extends Identifier {
}

export interface EpicData {
  readonly identifier: EpicIdentifier;
  readonly statement: EpicStatement;
}

export interface EpicSearchCondition extends SearchCondition {
  readonly keyword?: string;
}

// ======== Feature系 ========

export interface FeatureStatement {
  readonly description: string;
}

export interface FeatureIdentifier extends Identifier {
}

export interface FeatureData {
  readonly identifier: FeatureIdentifier;
  readonly statement: FeatureStatement;
  readonly parentEpic?: EpicIdentifier;
}

export interface FeatureSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly parentEpic?: EpicIdentifier;
}

// ======== PBI系 ========

export interface ProductBacklogItemStatement {
  readonly summary: string;
  readonly artifacts?: Artifacts;
  readonly proofMethod?: string;
}

export interface ArtifactCategory {
  readonly name: string;
  readonly items: readonly ArtifactItem[];
}

export interface ArtifactItem {
  readonly description: string;
}

export interface Artifacts {
  readonly categories: readonly ArtifactCategory[];
}

export interface ProductBacklogItemIdentifier extends Identifier {
}

export interface ProductBacklogItemProcessEvidence extends ProcessEvidence {
  readonly sizeVariance: SizeVariance;
}

export interface ProductBacklogItemData {
  readonly identifier: ProductBacklogItemIdentifier;
  readonly statement: ProductBacklogItemStatement;
  readonly parentFeature?: FeatureIdentifier;
  readonly processEvidence?: ProductBacklogItemProcessEvidence;
}

export interface ProductBacklogItemSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly sprintNumber?: number;
  readonly status?: string;
}

// ======== WP系 ========

export interface AcceptanceCriteria {
  readonly number: string;
  readonly description: string;
  readonly judgment: "unchecked" | "pass" | "conditional" | "fail" | "removed";
  readonly evidence?: string;
  readonly note?: string;
}

export interface AcceptanceCriterias {
  readonly items: readonly AcceptanceCriteria[];
}

export interface WorkPackageStatement {
  readonly acceptanceCriteria: AcceptanceCriterias;
}

export interface WorkPackageIdentifier extends Identifier {
}

export interface SessionMetrics {
  readonly intentAlignmentRate: number;
  readonly constraintAdherenceScore: number;
  readonly contextExtractionQuality: number;
  readonly workSizeStability: number;
  readonly comment: string;
}

export interface WorkPackageProcessEvidence extends ProcessEvidence {
}

export interface WorkPackageData {
  readonly identifier: WorkPackageIdentifier;
  readonly statement: WorkPackageStatement;
  readonly parentPbi: ProductBacklogItemIdentifier;
  readonly processEvidence?: WorkPackageProcessEvidence;
  readonly sessionMetrics?: SessionMetrics;
  readonly kpta?: KeepProblemTryAdvice;
}

export interface WorkPackageSearchCondition extends SearchCondition {
  readonly keyword?: string;
  readonly parentPbi?: ProductBacklogItemIdentifier;
  readonly sprintNumber?: number;
  readonly status?: string;
}

// ======== Review系 ========

export interface ReviewStatement {
  readonly sprintNumber: number;
  readonly environment: string;
}

export interface AcGroup {
  readonly pbiNumber: number;
  readonly wpNumber: number;
  readonly acJudgments: readonly AcJudgment[];
}

export interface AcJudgment {
  readonly acNumber: string;
  readonly description: string;
  readonly judgment: "unchecked" | "pass" | "conditional" | "fail" | "removed";
  readonly evidence?: string;
  readonly note?: string;
}

export interface OverallReviewResult {
  readonly judgment: "pass" | "conditional" | "fail";
  readonly reason: string;
}

export interface ReviewIdentifier extends Identifier {
}

export interface ReviewData {
  readonly identifier: ReviewIdentifier;
  readonly statement: ReviewStatement;
  readonly plannedAcGroups: readonly AcGroup[];
  readonly postPlanAcGroups?: readonly AcGroup[];
  readonly overallResult?: OverallReviewResult;
}

export interface ReviewSearchCondition extends SearchCondition {
  readonly sprintNumber?: number;
}

// ======== Retrospective系 ========

// deno-lint-ignore no-empty-interface
export interface Metrics {
}

export interface SprintMetrics extends Metrics {
  readonly goalAchievementRate: number;
  readonly estimationAccuracy: number;
  readonly qualityIntegrity: number;
  readonly collaborationDiscipline: number;
  readonly velocity: number;
}

export interface KeepProblemTryAdvice {
  readonly keep: string;
  readonly problem: string;
  readonly try: string;
  readonly advise: string;
}

export interface RetrospectiveIdentifier extends Identifier {
}

export interface RetrospectiveData {
  readonly identifier: RetrospectiveIdentifier;
  readonly sprint: SprintIdentifier;
  readonly kpta?: KeepProblemTryAdvice;
  readonly metrics?: SprintMetrics;
}

export interface RetrospectiveSearchCondition extends SearchCondition {
  readonly sprintNumber?: number;
}

// ======== Gateway関連型 ========

export interface BoardOutput {
  readonly id: number;
  readonly name: string;
}

export interface ConfigContent {
  readonly source: string;
  readonly content: string;
}
