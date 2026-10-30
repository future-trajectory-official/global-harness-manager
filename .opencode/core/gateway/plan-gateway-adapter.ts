import { executeCommand, type ExecuteResult } from "../shared/io/command.ts";
import { parseGitRemoteUrl } from "../shared/account/account-identifier.ts";
import { readOriginRemoteUrl, resolveRepoDir } from "../shared/scope-repo-dir.ts";
import { logger } from "../shared/io/logger.ts";
import type {
  EntityScope,
  EntityType,
  EpicData,
  ExecutionResult,
  FeatureData,
  Plan,
  Stage,
  Step,
  StepOperation,
  StepResult,
} from "../domain/types.ts";
import { identify } from "../domain/types.ts";
import type { PlanGateway } from "../domain/plan-gateway.ts";
import { ProductBacklogItemHandler } from "./product-backlog-item-handler.ts";
import { WorkPackageHandler } from "./work-package-handler.ts";
import { RetrospectiveHandler } from "./retrospective-handler.ts";
import {
  type BoardKey,
  type BoardOwner,
  type BoardOwnerType,
  FIELD,
  type FieldRef,
  HARNESS_FIELDS,
  STATUS_FIELD,
} from "./field-registry.ts";

export type CommandRunner = (cmd: string, args: string[]) => Promise<ExecuteResult>;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ProjectV2 ボードから取得したWP検索用の生アイテム。
 * 射影前の情報を保持し、`handleProjectSearchItems` が公開用の形へ変換する。
 */
interface ProjectSearchItem {
  number: number;
  title: string;
  id: string;
  issueState: string;
  /** Issue本文。AC件数の算出にのみ使い、出力には含めない。 */
  body: string;
  status: string | null;
  parent: { number: number; title: string; id: string } | null;
  /** `harness-effort-summary` の生テキスト（TEXTフィールド）。 */
  effortText: string | null;
}

/** ACチェックボックス行の解析結果。 */
interface AcLineMatch {
  indent: string;
  marker: string;
  /** 明示番号の原文（全角数字や先行ゼロを保持するため文字列で持つ）。番号省略形式では空文字。 */
  digits: string;
  rest: string;
  /** 行末の改行記号（CRLF の `\r` を保持するため）。 */
  eol: string;
}

/**
 * ACチェックボックス行に一致する正規表現。
 *
 * 受理する書式（`management.md` §5.1 の番号なし形式も含む）:
 * - ビュレット: `-` または `*`
 * - チェックボックス: `[ ]` / `[x]` / `[X]`
 * - 番号: `AC1:`（半角/全角コロン、全角数字、番号省略可）
 * - 行末に `\r` があっても一致する（CRLF 本文対応）
 */
const AC_LINE_RE = /^([ \t]*)([-*]) \[( |x|X)\] AC([0-9０-９]*)[ \t]*[:：](.*?)(\r?)$/;

/**
 * 全角数字を半角数字へ変換する。
 * @param text 変換対象
 * @returns 半角数字に置換した文字列
 */
function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

/**
 * 1行をACチェックボックス行として解析する。
 * 付随行（エビデンス等）は一致しない。
 *
 * @param line 対象行（改行を含まない）
 * @returns 解析結果。AC行でなければ null
 */
function matchAcLine(line: string): AcLineMatch | null {
  const m = line.match(AC_LINE_RE);
  if (!m) return null;
  return { indent: m[1], marker: m[3], digits: m[4], rest: m[5], eol: m[6] };
}

/** 本文中のAC行1件分の位置情報。 */
interface AcLineInfo extends AcLineMatch {
  /** 本文を行分割した際のインデックス。 */
  lineIndex: number;
  /** AC番号。番号省略形式では出現順（1始まり）を割り当てる。 */
  number: number;
}

/**
 * 本文からAC行を抽出する。
 *
 * コードフェンス（``` / ~~~）内の行は「書式例」とみなして対象外とする。
 * 番号省略形式（`- [ ] AC: 内容`）は出現順に1始まりの番号を割り当てる。
 *
 * @param body Issue本文
 * @returns AC行の位置情報一覧
 */
function collectAcLines(body: string): AcLineInfo[] {
  const infos: AcLineInfo[] = [];
  let inFence = false;
  body.split("\n").forEach((line, lineIndex) => {
    if (/^[ \t]*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    const match = matchAcLine(line);
    if (!match) return;
    const explicit = match.digits === "" ? undefined : Number(toHalfWidthDigits(match.digits));
    infos.push({ ...match, lineIndex, number: explicit ?? infos.length + 1 });
  });
  return infos;
}

/**
 * Issue本文中のACチェックボックス行を数える。
 * 未✅・✅の双方を1件として数え、コードフェンス内の行は対象外とする。
 *
 * @param body Issue本文
 * @returns AC行の件数。AC行が無ければ 0
 */
function countAcceptanceCriteria(body: string): number {
  return collectAcLines(body).length;
}

/**
 * Issue本文中のACチェックボックス行のうち、対象番号のものだけを✅化する純関数。
 *
 * 更新するのはAC行のチェックボックス（`[ ]` → `[x]`）のみで、付随行（ネストした
 * エビデンス）・本文の他領域・改行コード（LF/CRLF）はバイト単位で保持する。
 * 既に✅の行は変更しない（冪等）。同一番号の行が複数ある場合は先頭行のみ✅化し、
 * その番号を `duplicates` として報告する。
 *
 * @param body Issue本文
 * @param numbers ✅化するAC番号。省略または空配列の場合は本文中の全ACを対象にする
 * @returns 更新後本文、✅化したAC番号（updated）、既に✅だったAC番号（alreadyDone）、
 *          本文に存在しなかったAC番号（missing）、重複していたAC番号（duplicates）、
 *          本文中のAC行数（total）
 */
export function applyAcceptanceCriteriaDone(
  body: string,
  numbers?: readonly number[],
): {
  body: string;
  updated: number[];
  alreadyDone: number[];
  missing: number[];
  duplicates: number[];
  total: number;
} {
  const lines = body.split("\n");
  const infos = collectAcLines(body);
  const requested = numbers && numbers.length > 0 ? new Set(numbers) : null;

  const grouped = new Map<number, AcLineInfo[]>();
  for (const info of infos) {
    const list = grouped.get(info.number);
    if (list) list.push(info);
    else grouped.set(info.number, [info]);
  }

  const updated: number[] = [];
  const alreadyDone: number[] = [];
  const duplicates: number[] = [];

  for (const [number, group] of grouped) {
    if (requested && !requested.has(number)) continue;
    if (group.length > 1) duplicates.push(number);
    const first = group[0];
    if (first.marker !== " ") {
      alreadyDone.push(number);
      continue;
    }
    // チェックボックス記号のみを置換する（番号表記・全角コロン・改行コードを保持）。
    lines[first.lineIndex] = lines[first.lineIndex].replace("[ ]", "[x]");
    updated.push(number);
  }

  const missing = requested ? [...requested].filter((n) => !grouped.has(n)) : [];
  const sortAsc = (a: number, b: number) => a - b;
  return {
    body: lines.join("\n"),
    updated: updated.sort(sortAsc),
    alreadyDone: alreadyDone.sort(sortAsc),
    missing: missing.sort(sortAsc),
    duplicates: duplicates.sort(sortAsc),
    total: infos.length,
  };
}

/**
 * `harness-effort-summary` のJSONテキストから計画前・計画後の見積を取り出す。
 * 未設定・不正JSON・キー欠落は `null` として扱う（例外にしない）。
 *
 * @param text Sprint Board の `harness-effort-summary`（TEXT）値
 * @returns 計画前見積（initialEstimate）と計画後見積（plannedEstimate）
 */
function parseEffortEstimates(
  text: string | null | undefined,
): { initialEstimate: number | null; plannedEstimate: number | null } {
  if (!text) return { initialEstimate: null, plannedEstimate: null };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { initialEstimate: null, plannedEstimate: null };
  }
  const toNumber = (v: unknown): number | null => {
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  return {
    initialEstimate: toNumber(data.initial_estimate),
    plannedEstimate: toNumber(data.planned_estimate),
  };
}

/**
 * report で置換できなかった AC 判定1件の警告エントリ。
 * 未定義の文脈キー（部分文脈など）は JSON 化でキーが落ちるため、欠落＝未指定として読む。
 */
export interface UnreplacedAcJudgment {
  pbiNumber: number | undefined;
  wpNumber: string | undefined;
  acNumber: string;
  /** no-match＝該当行なし、duplicate＝同一ブロック内に重複行があり先頭1件のみ適用 */
  reason: "no-match" | "duplicate";
}

/**
 * report の部分成功時に StepResult.output へ載せる警告。
 * 部分成功も success:true で返すため、呼出側は output.unreplaced の有無で
 * 全件成功と部分成功を区別すること（欠落＝全件成功）。
 */
export interface ReviewReportOutput {
  unreplaced: UnreplacedAcJudgment[];
  /** 人間可読の要約。output を見ない呼出側への注意喚起用。 */
  note: string;
}

function buildUnreplacedOutput(unreplaced: UnreplacedAcJudgment[]): ReviewReportOutput {
  return {
    unreplaced,
    note: `${unreplaced.length} AC judgment(s) did not fully apply; ` +
      `markers left unchanged. See output.unreplaced for details.`,
  };
}

/**
 * Milestone description の `## Velocity` セクションを追記・更新する。
 * 既存セクションがあれば置換し、`## Goal` 等の他セクションは保持する。
 * セクションが1つもない場合は末尾に追記する。
 * 複数の `## Velocity` セクションが存在する場合は全て置換する。
 * 置換後、後続セクションとの間に空行を保証する。
 */
export function upsertVelocitySection(current: string, velocitySection: string): string {
  const velocitySectionRe = /^## Velocity\s*$[\s\S]*?(?=^## |$(?![\s\S]))/gm;
  const matches = [...current.matchAll(velocitySectionRe)];
  if (matches.length === 0) {
    return current.trimEnd() + "\n\n" + velocitySection;
  }
  const firstIndex = matches[0].index;
  const withoutVelocity = current.replace(velocitySectionRe, "");
  const before = withoutVelocity.slice(0, firstIndex).replace(/\s+$/, "");
  const after = withoutVelocity.slice(firstIndex).replace(/^\s+/, "");
  return [before, velocitySection, after].filter((part) => part.length > 0).join("\n\n");
}

function parseJsonOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** `gh api graphql` の引数に GraphQL 文書を渡す際の接頭辞。 */
const QUERY_ARG_PREFIX = "query=";

/** 未知の JSON 値をレコードとして読めるか判定する型ガード。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * ProjectV2 参照クエリの応答が「Organization 未解決」によるものか判定する（純関数）。
 *
 * User所有ボードでは `organization(login:)` が `organization: null` を返す。
 * Organization 自体は解決したがボード番号が無い場合（`projectV2: null`）は
 * フォールバック対象外とする。判定は「`organization === null`」または
 * 「NOT_FOUND かつ Organization 解決失敗を示す errors」のいずれかを満たす場合に
 * 真となる（OR 条件）。
 *
 * @param stdout gh api graphql の標準出力
 * @returns Organization 未解決の場合 true
 */
export function isOrganizationUnresolved(stdout: string): boolean {
  const parsed = parseJsonOutput(stdout) as
    | { data?: { organization?: unknown } | null; errors?: unknown }
    | undefined;
  if (!isRecord(parsed)) return false;
  const { data, errors } = parsed;
  if (isRecord(data) && "organization" in data && data.organization === null) {
    return true;
  }
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => {
    if (!isRecord(e)) return false;
    const { type, message } = e;
    return type === "NOT_FOUND" && typeof message === "string" && /organization/i.test(message);
  });
}

/**
 * ProjectV2 参照クエリのルートフィールドを `organization(login:` から
 * `user(login:` へ書き換える（純関数）。
 *
 * 現状の参照クエリは単一ルートのため全件置換と単発置換は等価だが、将来の
 * 複数ルート混在（半端な混成クエリ生成）を避けるため全件置換とする。
 * 該当箇所が無い場合は無変更。
 *
 * @param query organization 版の GraphQL クエリ文字列
 * @returns user 版の GraphQL クエリ文字列
 */
export function toUserProjectQuery(query: string): string {
  return query.replaceAll("organization(login:", "user(login:");
}

/**
 * ボード所有者の種別に応じた GraphQL ルート種別を返す（純関数）。
 *
 * 役割: ProjectV2 参照クエリの起点（organization / user）を所有者種別から決める。
 * 引数: 所有者の種別。
 * 戻り値: "user" または "organization"。クエリ組立時に `${root}(login: ...)` と埋め込む。
 */
export function projectV2OwnerRoot(ownerType: BoardOwnerType): "user" | "organization" {
  return ownerType === "user" ? "user" : "organization";
}

/**
 * ProjectV2 参照クエリのルートフィールドを `user(login:` から
 * `organization(login:` へ書き換える（純関数）。
 *
 * user-first クエリが未解決だった場合の逆フォールバック用。該当箇所が無い場合は無変更。
 *
 * @param query user 版の GraphQL クエリ文字列
 * @returns organization 版の GraphQL クエリ文字列
 */
export function toOrganizationProjectQuery(query: string): string {
  return query.replaceAll("user(login:", "organization(login:");
}

/**
 * ProjectV2 参照クエリの応答が「User 未解決」によるものか判定する（純関数）。
 *
 * user-first クエリで `user: null` が返った場合、または User 解決失敗を示す
 * NOT_FOUND エラーの場合に真となる。`isOrganizationUnresolved` の user 対称版。
 *
 * @param stdout gh api graphql の標準出力
 * @returns User 未解決の場合 true
 */
export function isUserUnresolved(stdout: string): boolean {
  const parsed = parseJsonOutput(stdout) as
    | { data?: { user?: unknown } | null; errors?: unknown }
    | undefined;
  if (!isRecord(parsed)) return false;
  const { data, errors } = parsed;
  if (isRecord(data) && "user" in data && data.user === null) {
    return true;
  }
  if (!Array.isArray(errors)) return false;
  return errors.some((e) => {
    if (!isRecord(e)) return false;
    const { type, message } = e;
    return type === "NOT_FOUND" && typeof message === "string" && /user/i.test(message);
  });
}

/**
 * user フォールバック応答の `data.user` を `data.organization` へ付け替える（純関数）。
 * 呼出側のパース（`data.organization.projectV2` 読取）を無変更で再利用するための透過化。
 * 付け替え後は `data.user` を削除し、単一の正（`data.organization`）のみを残す。
 *
 * @param stdout user 版クエリの標準出力
 * @returns 正規化後の標準出力（該当しない場合・非JSONの場合は無変更）
 */
export function aliasUserAsOrganization(stdout: string): string {
  const parsed = parseJsonOutput(stdout) as
    | { data?: { organization?: unknown; user?: unknown } | null }
    | undefined;
  if (!isRecord(parsed)) return stdout;
  const { data, ...rest } = parsed;
  if (!isRecord(data)) return stdout;
  const { organization, user, ...others } = data as
    & { organization?: unknown; user?: unknown }
    & Record<
      string,
      unknown
    >;
  if (organization !== null && organization !== undefined) return stdout;
  if (user === null || user === undefined) return stdout;
  return JSON.stringify({ ...rest, data: { ...others, organization: user } });
}

export type OperationHandler = (
  operation: string,
  params: Record<string, unknown>,
  lastItemId?: string,
) => Promise<StepResult>;

export interface PlanResult extends ExecutionResult {
  getStep(entity: string, operation: string): StepResult | undefined;
}

export class PlanGatewayAdapter implements PlanGateway {
  private readonly stepHandlers = new Map<EntityType, Map<StepOperation, OperationHandler>>();
  private resolvedScope: EntityScope | null = null;
  private projectConfig: {
    productBacklogBoardNumber?: number;
    sprintBoardNumber?: number;
    retrospectiveBoardNumber?: number;
    boardOwner?: BoardOwner;
  } = {};

  constructor(
    readonly runCommand: CommandRunner = (cmd, args) => executeCommand({ cmd, args }),
    /** 非git cwd でも `git -C` の基準dir を per-repo で解決する関数（既定は `resolveRepoDir`、テスト注入可）。 */
    private readonly repoDirResolver: () => string | null = () => resolveRepoDir(),
  ) {
    // === Vision 操作の登録 ===
    const visionCreate: OperationHandler = async (op, params) => {
      const existingItems = await this.handleSearchItems({ labelType: "Vision" });
      if (
        existingItems.success && Array.isArray(existingItems.output) &&
        existingItems.output.length > 0
      ) {
        const existing = existingItems.output[0] as { number: number };
        return {
          operation: op,
          success: false,
          error:
            `A Vision already exists (Issue #${existing.number}). Use pivot to update instead.`,
        };
      }
      return await this.handleCreateItem(params, "Vision");
    };
    const visionComment: OperationHandler = (_op, params, lastItemId) =>
      this.handleAddComment(params, lastItemId);
    const visionView: OperationHandler = (_op, params) => this.handleFindItem(params);
    const visionSearch: OperationHandler = (_op, params) => this.handleSearchItems(params);
    const visionUpdate: OperationHandler = (_op, params) => this.handleUpdateItem(params);

    for (const op of ["create"] as const) {
      this.register("Vision", op, visionCreate);
    }
    for (const op of ["comment"] as const) {
      this.register("Vision", op, visionComment);
    }
    this.register("Vision", "view", visionView);
    this.register("Vision", "search", visionSearch);
    for (const op of ["update"] as const) {
      this.register("Vision", op, visionUpdate);
    }

    // === Review 操作の登録 ===
    const reviewCreate: OperationHandler = (_op, params) => this.handleCreateItem(params, "Review");
    this.register("Review", "plan", reviewCreate);
    this.register("Review", "report", (_op, params) => this.handleReviewReport(params));
    this.register("Review", "archive", (_op, params) => this.handleCloseItem(params));
    this.register("Review", "view", (_op, params) => this.handleFindItem(params));
    this.register("Review", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Review", "update", async (_op, params, lastItemId) => {
      if (params.title) {
        return await this.handleUpdateItem({ ...params, bodyAppend: params.body });
      }
      return await this.handleAddComment(params, lastItemId);
    });
    this.register("Review", "revise", (_op, params) => this.handleReviewRevise(params));

    // === ProductGoal 操作の登録 ===
    const productGoalCreate: OperationHandler = async (op, params) => {
      const existingItems = await this.handleSearchItems({ labelType: "ProductGoal" });
      if (
        existingItems.success && Array.isArray(existingItems.output) &&
        existingItems.output.length > 0
      ) {
        const existing = existingItems.output[0] as { number: number };
        return {
          operation: op,
          success: false,
          error:
            `A ProductGoal already exists (Issue #${existing.number}). Use pivot to update instead.`,
        };
      }
      return await this.handleCreateItem(params, "ProductGoal");
    };
    this.register("ProductGoal", "create", productGoalCreate);
    this.register(
      "ProductGoal",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("ProductGoal", "view", (_op, params) => this.handleFindItem(params));
    this.register("ProductGoal", "update", (_op, params) => this.handleUpdateItem(params));
    this.register("ProductGoal", "search", (_op, params) => this.handleSearchItems(params));

    // === Epic 操作の登録 ===
    this.register("Epic", "create", (_op, params) => this.handleCreateItem(params, "Epic"));
    this.register(
      "Epic",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("Epic", "view", (_op, params) => this.handleFindItem(params));
    this.register("Epic", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Epic", "update", (_op, params) => this.handleUpdateItem(params));
    this.register("Epic", "showHierarchy", async (_op, params) => {
      return await this.#handleShowHierarchy(params);
    });
    this.register("Epic", "showHierarchyAll", async (_op, _params) => {
      return await this.#handleShowHierarchyAll();
    });

    // === Feature 操作の登録 ===
    this.register("Feature", "create", async (_op, params) => {
      const result = await this.handleCreateItem(params, "Feature");
      if (result.success && params.parentEpic && result.itemId) {
        const parentResult = await this.handleSetParent(result.itemId, String(params.parentEpic));
        if (!parentResult.success) {
          return parentResult;
        }
      }
      return result;
    });
    this.register(
      "Feature",
      "comment",
      (_op, params, lastItemId) => this.handleAddComment(params, lastItemId),
    );
    this.register("Feature", "view", (_op, params) => this.handleFindItem(params));
    this.register("Feature", "search", (_op, params) => this.handleSearchItems(params));
    this.register("Feature", "update", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "update", success: false, error: "itemId is required" };
      }
      if (params.parentEpic) {
        return await this.handleSetParent(itemId, String(params.parentEpic));
      }
      if ("parentEpic" in params) {
        return await this.handleRemoveParent(itemId);
      }
      if (params.title || params.bodyAppend) {
        return await this.handleUpdateItem(params);
      }
      return await this.handleUpdateItem(params);
    });

    // === ProductBacklogItem 操作の登録 ===
    this.register("ProductBacklogItem", "assignToFeature", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "assignToFeature", success: false, error: "itemId is required" };
      }
      const parentFeature = String(params.parentFeature ?? "");
      if (!parentFeature) {
        return { operation: "assignToFeature", success: false, error: "parentFeature is required" };
      }
      return await this.handleSetParent(itemId, parentFeature);
    });
    this.register("ProductBacklogItem", "unassignFromFeature", async (_op, params) => {
      const itemId = String(params.itemId ?? "");
      if (!itemId) {
        return { operation: "unassignFromFeature", success: false, error: "itemId is required" };
      }
      return await this.handleRemoveParent(itemId);
    });

    // === Sprint (Milestone) 操作の登録 ===
    this.register("Sprint", "create", (op, params) => this.#handleSprintCreate(op, params));
    this.register("Sprint", "endSprint", (op, params) => this.#handleSprintEnd(op, params));
    this.register("Sprint", "setGoal", (op, params) => this.#handleSprintSetGoal(op, params));
    this.register(
      "Sprint",
      "recordVelocity",
      (op, params) => this.#handleSprintRecordVelocity(op, params),
    );
    this.register("Sprint", "setDueDate", (op, params) => this.#handleSprintSetDueDate(op, params));
    this.register("Sprint", "search", (op, params) => this.#handleSprintSearch(op, params));
    this.register(
      "Sprint",
      "view",
      (op, params, lastItemId) => this.#handleSprintView(op, params, lastItemId),
    );
    this.register("Scope", "resolve", (_op, params) => this.handleScopeResolve(params));

    // === ProductBacklogItem 操作の登録 ===
    new ProductBacklogItemHandler(this).register(this.stepHandlers);

    // === WorkPackage 操作の登録 ===
    new WorkPackageHandler(this).register(this.stepHandlers);

    // === Retrospective 操作の登録 ===
    new RetrospectiveHandler(this).register(this.stepHandlers);
  }

  /** テスト用にscopeを直接設定する。通常はScope.resolve Stepで設定される。 */
  setScope(owner: string, repository: string): void {
    this.resolvedScope = { owner, repository };
  }

  /** Product Backlog Board のプロジェクト番号。Handlerから参照される。 */
  get productBacklogBoardNumber(): number | undefined {
    return this.projectConfig.productBacklogBoardNumber;
  }

  /** Sprint Board のプロジェクト番号。Handlerから参照される。 */
  get sprintBoardNumber(): number | undefined {
    return this.projectConfig.sprintBoardNumber;
  }

  /** Retrospective Board のプロジェクト番号。Handlerから参照される。 */
  get retrospectiveBoardNumber(): number | undefined {
    return this.projectConfig.retrospectiveBoardNumber;
  }

  /** Project V2 ボード番号を設定する。テスト用および初期化時に使用する。 */
  setProjectBoardNumbers(
    productBacklog?: number,
    sprint?: number,
    retrospective?: number,
  ): void {
    this.projectConfig = {
      ...this.projectConfig,
      productBacklogBoardNumber: productBacklog,
      sprintBoardNumber: sprint,
      retrospectiveBoardNumber: retrospective,
    };
  }

  /**
   * Project V2 ボードの所有者を設定する。
   *
   * 役割: `.harnessrc` の boardOwner を Gateway に反映し、リポジトリownerと
   * ボードownerが異なる場合（個人所有ボード）の解決を可能にする。
   * 引数: ボード所有者（ログイン名と種別）。
   * 戻り値: なし。
   */
  setBoardOwner(boardOwner: BoardOwner): void {
    this.projectConfig = { ...this.projectConfig, boardOwner };
  }

  /**
   * ボード解決に用いるログイン名と種別を返す。
   *
   * 役割: 設定済みボード所有者を優先し、未設定時は従来どおり
   * リポジトリownerの organization 解決にフォールバックする。
   * 戻り値: ログイン名（未解決時は undefined）と所有者種別。
   */
  private resolveBoardOwner(): { login: string | undefined; ownerType: BoardOwnerType } {
    const configured = this.projectConfig.boardOwner;
    if (configured) {
      return { login: configured.owner, ownerType: configured.ownerType };
    }
    return { login: this.resolvedScope?.owner, ownerType: "organization" };
  }

  /**
   * Issue をボードに追加し、その project item node id を解決する。
   * ボードへ既に追加済みの場合は既存項目を探索して返す。解決不能な場合は null を返す。
   * 各ハンドラーで重複していた「addItemToProject → catch → lookup → スキップ判定」を
   * ここへ共通化する。
   *
   * @param itemId - Issue 番号（lookup 用）
   * @param issueNodeId - Issue の node id（add 用）
   * @param boardKey - 対象ボード識別子
   * @returns project item node id、または null（追加・解決に失敗）
   */
  async resolveProjectItemOnBoard(
    itemId: string,
    issueNodeId: string,
    boardKey: BoardKey,
  ): Promise<string | null> {
    const boardNumber = this.boardNumberForKey(boardKey);
    if (boardNumber === undefined) return null;
    try {
      const { projectItemNodeId } = await this.addItemToProject(issueNodeId, boardNumber);
      return projectItemNodeId;
    } catch {
      // add 失敗時は既存項目を探索して解決を試みる
      const owned = this.scopeOwner;
      const repod = this.scopeRepository;
      if (!owned || !repod) return null;
      const lookup =
        `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
      const lr = await this.runCommand("gh", [
        "api",
        "graphql",
        "-f",
        `query=${lookup}`,
        "-f",
        `owner=${owned}`,
        "-f",
        `repo=${repod}`,
        "-F",
        `num=${parseInt(itemId, 10)}`,
      ]);
      if (lr.code !== 0) return null;
      const ld = JSON.parse(lr.stdout) as {
        data?: {
          repository?: {
            issue?: {
              projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
            };
          };
        };
      };
      const matched = ld?.data?.repository?.issue?.projectItems?.nodes?.find((n) =>
        n.project.number === boardNumber
      );
      return matched?.id ?? null;
    }
  }

  /**
   * ProjectV2 参照用の `gh api graphql` を実行する。User所有ボードでは
   * `organization(login:)` が NOT_FOUND になるため、その場合のみ同一クエリの
   * `user(login:)` 版へフォールバックする（1回のみ再試行し、繰返しはしない）。
   * 逆に user-first クエリが未解決の場合は `organization(login:)` 版へ
   * フォールバックする（種別設定が実態と逆の場合の救済）。
   * gh auth のアカウント切替は行わない（PO確認なしの切替は禁止）。
   *
   * @param args ProjectV2 参照クエリを含む gh 引数（`query=` を含むこと）
   * @returns 初回またはフォールバックの実行結果
   */
  private async runProjectV2Query(args: string[]): Promise<ExecuteResult> {
    const first = await this.runCommand("gh", args);
    // gh の GraphQL エラーは code 0＋応答内 errors で返る前提。code 非ゼロ
    //（認証・通信失敗）はフォールバックせず即時返却する（安全側の仕様）。
    if (first.code !== 0) return first;
    const firstQuery = args.find((a) => a.startsWith(QUERY_ARG_PREFIX)) ?? "";
    if (firstQuery.includes("user(login:")) {
      if (!isUserUnresolved(first.stdout)) {
        return { ...first, stdout: aliasUserAsOrganization(first.stdout) };
      }
      logger.debug("[runProjectV2Query] user unresolved; retrying with organization(login:)");
      const orgArgs = args.map((a) =>
        a.startsWith(QUERY_ARG_PREFIX)
          ? `${QUERY_ARG_PREFIX}${toOrganizationProjectQuery(a.slice(QUERY_ARG_PREFIX.length))}`
          : a
      );
      // 置換不能（user 形式でないクエリ）の場合は初回結果を返す。
      if (orgArgs.every((a, i) => a === args[i])) {
        logger.debug("[runProjectV2Query] no user root found; returning first result");
        return first;
      }
      const second = await this.runCommand("gh", orgArgs);
      if (second.code !== 0) {
        logger.debug("[runProjectV2Query] organization fallback query failed");
        return second;
      }
      return second;
    }
    if (!isOrganizationUnresolved(first.stdout)) return first;
    logger.debug("[runProjectV2Query] organization unresolved; retrying with user(login:)");
    const userArgs = args.map((a) =>
      a.startsWith(QUERY_ARG_PREFIX)
        ? `${QUERY_ARG_PREFIX}${toUserProjectQuery(a.slice(QUERY_ARG_PREFIX.length))}`
        : a
    );
    // 置換不能（organization 形式でないクエリ）の場合は初回結果を返す。
    if (userArgs.every((a, i) => a === args[i])) {
      logger.debug("[runProjectV2Query] no organization root found; returning first result");
      return first;
    }
    const second = await this.runCommand("gh", userArgs);
    if (second.code !== 0) {
      logger.debug("[runProjectV2Query] user fallback query failed");
      return second;
    }
    return { ...second, stdout: aliasUserAsOrganization(second.stdout) };
  }

  /**
   * Issue を Project V2 ボードに追加する。
   * @returns プロジェクト上の item node id
   */
  async addItemToProject(
    issueNodeId: string,
    projectNumber: number,
  ): Promise<{ projectItemNodeId: string }> {
    const board = this.resolveBoardOwner();
    if (!board.login) throw new Error("Scope not resolved");
    const root = projectV2OwnerRoot(board.ownerType);
    const getProjectIdQuery =
      `query($owner: String!, $number: Int!) { ${root}(login: $owner) { projectV2(number: $number) { id } } }`;
    const projectResult = await this.runProjectV2Query([
      "api",
      "graphql",
      "-f",
      `query=${getProjectIdQuery}`,
      "-f",
      `owner=${board.login}`,
      "-F",
      `number=${projectNumber}`,
    ]);
    if (projectResult.code !== 0) {
      throw new Error(`Failed to get project ID: ${projectResult.stderr}`);
    }
    let projectData: { data?: { organization?: { projectV2?: { id: string } } } };
    try {
      projectData = JSON.parse(projectResult.stdout);
      const errors = (projectData as { errors?: Array<{ message: string }> }).errors;
      if (errors?.length) {
        throw new Error(`GraphQL error: ${errors.map((e) => e.message).join("; ")}`);
      }
    } catch (e) {
      throw new Error(
        `Failed to parse project ID response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    const projectId = projectData?.data?.organization?.projectV2?.id;
    if (!projectId) {
      throw new Error(`Project V2 #${projectNumber} not found`);
    }

    const addItemMutation =
      `mutation($project: ID!, $content: ID!) { addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } } }`;
    const addResult = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${addItemMutation}`,
      "-f",
      `project=${projectId}`,
      "-f",
      `content=${issueNodeId}`,
    ]);
    if (addResult.code !== 0) {
      throw new Error(`Failed to add item to project: ${addResult.stderr}`);
    }
    let addData: {
      data?: { addProjectV2ItemById?: { item?: { id: string } } };
      errors?: Array<{ message: string }>;
    };
    try {
      addData = JSON.parse(addResult.stdout);
    } catch (e) {
      throw new Error(
        `Failed to parse add item response: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    if (addData.errors?.length) {
      const alreadyOnProject = addData.errors.some((e) =>
        e.message.includes("already on the project")
      );
      if (alreadyOnProject && this.resolvedScope) {
        const numQuery = `query($id:ID!){node(id:$id){...on Issue{number}}}`;
        const numResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${numQuery}`,
          "-f",
          `id=${issueNodeId}`,
        ]);
        if (numResult.code === 0) {
          const numData = JSON.parse(numResult.stdout) as { data?: { node?: { number?: number } } };
          const issueNum = numData?.data?.node?.number;
          if (issueNum) {
            const lookupQuery =
              `query($owner:String!,$repo:String!,$num:Int!){repository(owner:$owner,name:$repo){issue(number:$num){projectItems(first:20){nodes{id project{number}}}}}}`;
            const lookupResult = await this.runCommand("gh", [
              "api",
              "graphql",
              "-f",
              `query=${lookupQuery}`,
              "-f",
              `owner=${this.resolvedScope.owner}`,
              "-f",
              `repo=${this.resolvedScope.repository}`,
              "-F",
              `num=${issueNum}`,
            ]);
            if (lookupResult.code === 0) {
              const lookupData = JSON.parse(lookupResult.stdout) as {
                data?: {
                  repository?: {
                    issue?: {
                      projectItems?: { nodes: Array<{ id: string; project: { number: number } }> };
                    };
                  };
                };
              };
              const matched = lookupData?.data?.repository?.issue?.projectItems?.nodes
                ?.find((n) => n.project.number === projectNumber);
              if (matched) return { projectItemNodeId: matched.id };
            }
          }
        }
      }
      throw new Error(`GraphQL error: ${addData.errors.map((e) => e.message).join("; ")}`);
    }
    const projectItemNodeId = addData?.data?.addProjectV2ItemById?.item?.id;
    if (!projectItemNodeId) {
      throw new Error("Failed to get project item node ID");
    }
    return { projectItemNodeId };
  }

  /** プロジェクトV2の単一選択フィールドのオプション名からIDを解決する。 */
  async resolveSingleSelectOptionId(
    ref: FieldRef,
    optionName: string,
  ): Promise<string | undefined> {
    const projectNumber = this.resolveRefBoardNumber(ref);
    if (projectNumber === undefined) return;
    const board = this.resolveBoardOwner();
    const owner = board.login;
    if (!owner) return undefined;
    const root = projectV2OwnerRoot(board.ownerType);
    const result = await this.runProjectV2Query([
      "api",
      "graphql",
      "-f",
      `query=query($owner: String!, $number: Int!, $field: String!) { ${root}(login: $owner) { projectV2(number: $number) { field(name: $field) { ... on ProjectV2SingleSelectField { options { id name } } } } } }`,
      "-f",
      `owner=${owner}`,
      "-F",
      `number=${projectNumber}`,
      "-f",
      `field=${ref.fieldName}`,
    ]);
    if (result.code !== 0) return undefined;
    try {
      const data = JSON.parse(result.stdout) as {
        data?: {
          organization?: {
            projectV2?: { field?: { options: Array<{ id: string; name: string }> } };
          };
        };
      };
      return data?.data?.organization?.projectV2?.field?.options
        ?.find((o) => o.name === optionName)?.id;
    } catch {
      return undefined;
    }
  }

  /** フィールド名からフィールドIDを解決する（内部ヘルパー）。 */
  private async resolveFieldId(
    projectNumber: number,
    fieldName: string,
  ): Promise<{ fieldId: string } | { error: string }> {
    const board = this.resolveBoardOwner();
    if (!board.login) return { error: "Scope not resolved" };
    const root = projectV2OwnerRoot(board.ownerType);
    const query =
      `query($owner: String!, $number: Int!, $fieldName: String!) { ${root}(login: $owner) { projectV2(number: $number) { field(name: $fieldName) { ... on ProjectV2SingleSelectField { id } ... on ProjectV2Field { id } } } } }`;
    const result = await this.runProjectV2Query([
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${board.login}`,
      "-F",
      `number=${projectNumber}`,
      "-f",
      `fieldName=${fieldName}`,
    ]);
    if (result.code !== 0) return { error: result.stderr };
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { organization?: { projectV2?: { field?: { id: string } } } };
      };
      const fieldId = data?.data?.organization?.projectV2?.field?.id;
      if (!fieldId) return { error: `Field "${fieldName}" not found` };
      return { fieldId };
    } catch {
      return { error: "Failed to parse field query response" };
    }
  }

  /** Project V2 フィールドに単一選択値を設定する。 */
  /** プロジェクト番号からプロジェクトノードIDを解決する。 */
  private async resolveProjectNodeId(
    projectNumber: number,
  ): Promise<{ projectId: string } | { error: string }> {
    const board = this.resolveBoardOwner();
    if (!board.login) return { error: "Scope not resolved" };
    const root = projectV2OwnerRoot(board.ownerType);
    const query =
      `query($owner: String!, $number: Int!) { ${root}(login: $owner) { projectV2(number: $number) { id } } }`;
    const result = await this.runProjectV2Query([
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${board.login}`,
      "-F",
      `number=${projectNumber}`,
    ]);
    if (result.code !== 0) return { error: result.stderr };
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { organization?: { projectV2?: { id: string } } };
      };
      const projectId = data?.data?.organization?.projectV2?.id;
      if (!projectId) return { error: "Project not found" };
      return { projectId };
    } catch {
      return { error: "Failed to parse project query response" };
    }
  }

  /** FieldRef の boardKey に対応するボード番号を projectConfig から解決する。 */
  /** BoardKey に対応するボード番号を projectConfig から解決する。 */
  private boardNumberForKey(boardKey: BoardKey): number | undefined {
    switch (boardKey) {
      case "productBacklog":
        return this.projectConfig.productBacklogBoardNumber;
      case "sprintBoard":
        return this.projectConfig.sprintBoardNumber;
      case "retrospectiveBoard":
        return this.projectConfig.retrospectiveBoardNumber;
    }
  }

  /** FieldRef の boardKey に対応するボード番号を projectConfig から解決する。 */
  private resolveRefBoardNumber(ref: FieldRef): number | undefined {
    return this.boardNumberForKey(ref.boardKey);
  }

  /** Project V2 フィールドに単一選択値を設定する。 */
  async setSingleSelectFieldValue(
    projectItemNodeId: string,
    ref: FieldRef,
    optionId: string,
  ): Promise<StepResult> {
    const projectNumber = this.resolveRefBoardNumber(ref);
    if (projectNumber === undefined) {
      return {
        operation: "updateField",
        success: false,
        error: `Board "${ref.boardKey}" not configured`,
      };
    }
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, ref.fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--single-select-option-id",
      optionId,
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
  }

  /**
   * IssueのV2ボード上のStatusを設定する（stage値→V2 Status名に自動変換）。
   *
   * ボード未設定・`idea`（Status未設定で表現）はスキップとして扱い `ok: true` を返す。
   * 設定を試みて失敗した場合は `ok: false` と理由を返すため、呼出側は不一致の発生を検知できる。
   *
   * @param itemId Issue番号
   * @param ref 対象ボードのStatusフィールド参照
   * @param stage 遷移先の作業段階
   * @returns `ok` は更新成功またはスキップ、`error` は失敗理由
   */
  async setBoardStatus(
    itemId: string,
    ref: FieldRef,
    stage: Stage,
  ): Promise<{ ok: boolean; error?: string }> {
    const boardNumber = this.resolveRefBoardNumber(ref);
    if (boardNumber === undefined) {
      logger.warn(
        `[setBoardStatus] Board "${ref.boardKey}" is not configured; status update skipped`,
      );
      return { ok: true };
    }
    // Idea は Project V2 の Status 選択肢に存在しない（Status 未設定 = null で表現する）。
    // 既存 Status を保持したまま何も書き込まない。
    if (stage === "idea") {
      return { ok: true };
    }
    const stageToStatus: Record<Exclude<Stage, "idea">, string> = {
      todo: "Todo",
      inProgress: "In Progress",
      done: "Done",
    };
    const statusName = stageToStatus[stage];
    if (!statusName) {
      const error = `Unknown stage "${stage}"`;
      logger.warn(`[setBoardStatus] ${error}; status update skipped`);
      return { ok: false, error };
    }
    const nodeResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "id",
      ...this.buildRepoArg(),
    ]);
    if (nodeResult.code !== 0) {
      const error = `Failed to resolve issue node id: ${nodeResult.stderr}`;
      logger.warn(`[setBoardStatus] ${error}`);
      return { ok: false, error };
    }
    try {
      const nodeData = JSON.parse(nodeResult.stdout) as { id: string };
      const { projectItemNodeId } = await this.addItemToProject(nodeData.id, boardNumber);
      const optionId = await this.resolveSingleSelectOptionId(ref, statusName);
      if (!optionId) {
        const error = `Status option "${statusName}" not found on board "${ref.boardKey}"`;
        logger.warn(`[setBoardStatus] ${error}`);
        return { ok: false, error };
      }
      const result = await this.setSingleSelectFieldValue(projectItemNodeId, ref, optionId);
      if (!result.success) {
        const error = result.error ?? "unknown error";
        logger.warn(`[setBoardStatus] Failed to set status: ${error}`);
        return { ok: false, error };
      }
      return { ok: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      logger.warn(`[setBoardStatus] Status update failed: ${error}`);
      return { ok: false, error };
    }
  }

  /** Project V2 アイテムのテキストフィールド値を読み取る。 */
  async readTextFieldValue(
    projectItemNodeId: string,
    ref: FieldRef,
  ): Promise<string | undefined> {
    const query =
      `query($item: ID!) { node(id: $item) { ... on ProjectV2Item { fv: fieldValueByName(name: "${ref.fieldName}") { ... on ProjectV2ItemFieldTextValue { text } } } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `item=${projectItemNodeId}`,
    ]);
    if (result.code !== 0) return undefined;
    try {
      const data = JSON.parse(result.stdout) as {
        data?: { node?: { fv?: { text?: string } } };
      };
      return data?.data?.node?.fv?.text;
    } catch {
      return undefined;
    }
  }

  /** Project V2 フィールドに数値を設定する。 */
  async setNumberFieldValue(
    projectItemNodeId: string,
    ref: FieldRef,
    numberValue: number,
  ): Promise<StepResult> {
    const projectNumber = this.resolveRefBoardNumber(ref);
    if (projectNumber === undefined) {
      return {
        operation: "updateField",
        success: false,
        error: `Board "${ref.boardKey}" not configured`,
      };
    }
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, ref.fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--number",
      String(numberValue),
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
  }

  /** Project V2 フィールドにテキスト値を設定する。 */
  async setTextFieldValue(
    projectItemNodeId: string,
    ref: FieldRef,
    text: string,
  ): Promise<StepResult> {
    const projectNumber = this.resolveRefBoardNumber(ref);
    if (projectNumber === undefined) {
      return {
        operation: "updateField",
        success: false,
        error: `Board "${ref.boardKey}" not configured`,
      };
    }
    const [resolved1, resolved2] = await Promise.all([
      this.resolveFieldId(projectNumber, ref.fieldName),
      this.resolveProjectNodeId(projectNumber),
    ]);
    if ("error" in resolved1) {
      return { operation: "updateField", success: false, error: resolved1.error };
    }
    if ("error" in resolved2) {
      return { operation: "updateField", success: false, error: resolved2.error };
    }
    const result = await this.runCommand("gh", [
      "project",
      "item-edit",
      "--project-id",
      resolved2.projectId,
      "--id",
      projectItemNodeId,
      "--field-id",
      resolved1.fieldId,
      "--text",
      text,
    ]);
    if (result.code !== 0) {
      return { operation: "updateField", success: false, error: result.stderr };
    }
    return { operation: "updateField", success: true };
  }

  private async handleScopeResolve(params: Record<string, unknown>): Promise<StepResult> {
    const owner = String(params.owner ?? "");
    const repository = String(params.repository ?? "");

    if (owner && repository && owner !== "unknown" && repository !== "unknown") {
      this.resolvedScope = { owner, repository };
      return { operation: "resolve", success: true };
    }

    // 解決順: ambient cwd（git repo なら最優先）→ repoDir（env/.harnessrc）へ `git -C` 再試行（M1/M4）。
    // 呼出組立は共有関数 readOriginRemoteUrl に一本化（M5）。
    const origin = await readOriginRemoteUrl(this.runCommand, this.repoDirResolver);
    if (!origin.ok) {
      return {
        operation: "resolve",
        success: false,
        error: origin.error ?? "Failed to resolve scope",
      };
    }

    const remoteUrl = origin.url ?? "";
    // github.com 系の抽出は共有ヘルパーに一本化（正規表現の二重管理を解消）。
    // 非GitHub SSH のフォールバックは本関数の責務として残す。
    const parsedScope = parseGitRemoteUrl(remoteUrl);
    const remoteOwner = parsedScope?.owner;
    const remoteRepo = parsedScope?.repository;
    if (!remoteOwner || !remoteRepo) {
      const sshMatch = remoteUrl.match(/^git@[^:]+:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (sshMatch) {
        this.resolvedScope = { owner: sshMatch[1], repository: sshMatch[2] };
        return {
          operation: "resolve",
          success: true,
          itemId: `${sshMatch[1]}/${sshMatch[2]}`,
          output: { owner: sshMatch[1], repository: sshMatch[2] },
        };
      }
      return {
        operation: "resolve",
        success: false,
        error: `Could not parse owner/repo from git remote: ${remoteUrl}`,
      };
    }

    const authResult = await this.runCommand("gh", ["auth", "status"]);
    if (authResult.code !== 0) {
      return {
        operation: "resolve",
        success: false,
        error: `Not authenticated with gh. Run \`gh auth login\` first.`,
      };
    }

    const repoResult = await this.runCommand("gh", [
      "repo",
      "view",
      "--json",
      "owner,name",
      "--repo",
      `${remoteOwner}/${remoteRepo}`,
    ]);
    if (repoResult.code !== 0) {
      return {
        operation: "resolve",
        success: false,
        error:
          `Repository '${remoteOwner}/${remoteRepo}' not found or no access. Check your gh auth with \`gh auth status\` and switch account with \`gh auth switch\` if needed.`,
      };
    }

    try {
      const data = JSON.parse(repoResult.stdout);
      this.resolvedScope = { owner: data.owner.login, repository: data.name };
      return { operation: "resolve", success: true };
    } catch {
      return {
        operation: "resolve",
        success: false,
        error: `Failed to parse gh repo view output: ${repoResult.stdout}`,
      };
    }
  }

  private register(entity: EntityType, operation: StepOperation, handler: OperationHandler): void {
    let entityMap = this.stepHandlers.get(entity);
    if (!entityMap) {
      entityMap = new Map<StepOperation, OperationHandler>();
      this.stepHandlers.set(entity, entityMap);
    }
    entityMap.set(operation, handler);
  }

  async execute(plan: Plan): Promise<PlanResult> {
    if (plan.steps.length === 0) {
      return {
        stepResults: [],
        getStep: () => undefined,
      };
    }

    const stepResults: StepResult[] = [];
    let lastItemId: string | undefined;

    for (const step of plan.steps) {
      const result = await this.executeStep(step, lastItemId);
      stepResults.push(result);
      if (result.success && result.itemId) {
        lastItemId = result.itemId;
      }
    }

    const planSteps = plan.steps;

    return {
      stepResults,
      getStep(entity: string, operation: string): StepResult | undefined {
        const idx = planSteps.findIndex(
          (s) => s.entity === entity && s.operation === operation,
        );
        return idx >= 0 ? stepResults[idx] : undefined;
      },
    };
  }

  private async executeStep(
    step: Step,
    lastItemId?: string,
  ): Promise<StepResult> {
    const entry = step as {
      entity: EntityType;
      operation: StepOperation;
      params: Record<string, unknown>;
    };
    const entity = entry.entity;
    const operation = entry.operation;

    const entityMap = this.stepHandlers.get(entity);
    const handler = entityMap?.get(operation);

    if (!handler) {
      return {
        operation,
        success: false,
        error: `No handler registered for ${entity}:${operation}`,
      };
    }

    try {
      return await handler(operation, entry.params, lastItemId);
    } catch (e) {
      return {
        operation,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async handleSetMilestone(itemId: string, sprint: string): Promise<StepResult> {
    const sprintArgs = [
      "issue",
      "edit",
      itemId,
      "--milestone",
      sprint,
      ...this.buildRepoArg(),
    ];
    const result = await this.runCommand("gh", sprintArgs);
    if (result.code !== 0) {
      return { operation: "commit", success: false, error: result.stderr };
    }
    return { operation: "commit", success: true, itemId };
  }

  async handleCloseItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "archive", success: false, error: "itemId is required" };
    }
    const args = [
      "issue",
      "close",
      itemId,
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "archive", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      // 楽観的close後の競合（viewとcloseの間に閉じられた場合）も冪等に扱う。
      if (/already closed/i.test(result.stderr)) {
        return this.buildAlreadyClosedResult(itemId);
      }
      return { operation: "archive", success: false, error: result.stderr };
    }
    return { operation: "archive", success: true, itemId };
  }

  /**
   * 既closed品の冪等成功結果を組み立てる。
   * @param itemId - 対象 Issue 番号
   * @returns 成功＋注記（alreadyClosed）の StepResult
   */
  buildAlreadyClosedResult(itemId: string): StepResult {
    return {
      operation: "archive",
      success: true,
      itemId,
      output: {
        alreadyClosed: true,
        note: `Issue #${itemId} is already closed`,
      },
    };
  }

  /**
   * 対象 Issue が既closedか事前確認する。WP/PBI の archive ガード共通用。
   * @param itemId - 対象 Issue 番号
   * @returns 既closedの場合は冪等成功結果、未closed・判定不能の場合は null（close試行へ進む）
   */
  async checkAlreadyClosed(itemId: string): Promise<StepResult | null> {
    const viewResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "state,closed",
      ...this.buildRepoArg(),
    ]);
    if (viewResult.code === 0) {
      try {
        const viewData = JSON.parse(viewResult.stdout) as { state?: string; closed?: boolean };
        if (viewData.state === "CLOSED" || viewData.closed) {
          return this.buildAlreadyClosedResult(itemId);
        }
      } catch {
        // view応答のparse失敗時は判定不能としてclose試行へフォールスルーする。
      }
    }
    // view失敗時は判定不能としてclose試行へフォールスルーする。
    return null;
  }

  /** 現在のスコープのowner名を返す。Handlerから参照される。 */
  get scopeOwner(): string | undefined {
    return this.resolvedScope?.owner;
  }

  /** 現在のスコープのrepository名を返す。Handlerから参照される。 */
  get scopeRepository(): string | undefined {
    return this.resolvedScope?.repository;
  }

  buildRepoArg(): string[] {
    if (!this.resolvedScope) {
      return [];
    }
    return ["--repo", `${this.resolvedScope.owner}/${this.resolvedScope.repository}`];
  }

  /**
   * createItem 操作を処理する。GitHub Issue を作成し、作成結果の itemId と nodeId を返す。
   * @param params.title - Issue のタイトル
   * @param params.body - Issue の本文
   * @param params.type - Issue に付与するラベル種別（デフォルト: PBI）
   * @returns 作成された Issue の itemId, nodeId, url を含む StepResult
   */
  async handleCreateItem(
    params: Record<string, unknown>,
    entity?: string,
  ): Promise<StepResult> {
    const title = String(params.title ?? "");
    const body = String(params.body ?? "");
    const type = String(params.type ?? params.labelType ?? entity ?? "PBI");
    const args = [
      "issue",
      "create",
      "--title",
      title,
      "--body",
      body,
      "--label",
      `type:${type}`,
      ...this.buildRepoArg(),
    ];
    const sprint = params.sprint;
    if (sprint) {
      const milestone = typeof sprint === "string"
        ? sprint
        : (sprint as { title?: { value?: string } }).title?.value;
      if (milestone) {
        args.push("--milestone", milestone);
      }
    }
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "create", success: false, error: result.stderr };
    }
    const url = result.stdout.trim();
    const match = url.match(/\/issues\/(\d+)$/);
    const itemId = match ? match[1] : undefined;

    let nodeId: string | undefined;
    if (itemId) {
      try {
        const viewResult = await this.runCommand(
          "gh",
          ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
        );
        if (viewResult.code === 0) {
          nodeId = JSON.parse(viewResult.stdout).id;
        }
      } catch {
        logger.warn(`Failed to fetch nodeId for issue #${itemId}, continuing without it`);
      }
    }

    return { operation: "create", success: true, itemId, nodeId, output: { url } };
  }

  /**
   * addComment 操作を処理する。GitHub Issue にコメントを追加する。
   * @param params.itemId - コメント先の Issue 番号（省略時は直前の createItem 結果を使用）
   * @param params.body - コメント本文
   * @param lastItemId - 前 Step で作成された itemId（連鎖用）
   * @returns コメント追加結果の StepResult
   */
  async handleAddComment(
    params: Record<string, unknown>,
    lastItemId?: string,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? lastItemId ?? "");
    if (!itemId) {
      return {
        operation: "comment",
        success: false,
        error: "No target issue specified and no previous createItem context available",
      };
    }
    const body = String(params.body ?? "");
    const args = [
      "issue",
      "comment",
      itemId,
      "--body",
      body,
      ...this.buildRepoArg(),
    ];
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "comment", success: false, error: result.stderr };
    }
    return { operation: "comment", success: true, itemId };
  }

  /**
   * Review Issue 本文を「スプリント開始時検証計画」「スプリント中追加検証計画」に分割する。
   *
   * 開始時検証計画の旧AC（➖論理削除含む）と、スプリント中追加検証計画の新ACは
   * 同じPBI番号・WP番号・AC番号を持ち得るため、セクションをアンカーにして
   * 誤マッチ（追加ACが開始時検証計画の同番号ACを上書きする）を防ぐために使う。
   */
  private splitReviewSections(
    body: string,
  ): { beforeStart: string; startSection: string; addedSection: string } {
    const startMarker = "## スプリント開始時検証計画";
    const addedMarker = "## スプリント中追加検証計画";
    const startIdx = body.indexOf(startMarker);
    const addedIdx = body.indexOf(addedMarker);
    let beforeStart = "";
    let startSection = "";
    let addedSection = "";
    if (startIdx >= 0) {
      beforeStart = body.slice(0, startIdx);
      startSection = body.slice(startIdx, addedIdx >= 0 ? addedIdx : body.length);
    }
    if (addedIdx >= 0) {
      addedSection = body.slice(addedIdx);
    }
    if (startIdx < 0 && addedIdx < 0) {
      beforeStart = body;
    }
    return { beforeStart, startSection, addedSection };
  }

  /**
   * report 操作を処理する。GitHub Issue の本文内の AC マーカー（❔）を
   * 合格/不合格/条件付き合格 のマーカーに置き換え、Overall Result を追記する。
   */
  private async handleReviewReport(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "report", success: false, error: "itemId is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "body",
      ...this.buildRepoArg(),
    ]);
    if (viewResult.code !== 0) {
      return { operation: "report", success: false, error: viewResult.stderr };
    }
    const parsed = JSON.parse(viewResult.stdout) as { body?: string } | undefined;
    const currentBody = parsed?.body ?? "";

    const postPlanAcGroups = params.postPlanAcGroups as
      | Array<{
        pbiNumber?: number;
        wpNumber?: string;
        acJudgments: Array<{ number: string; judgment: string }>;
      }>
      | undefined;

    let newBody = currentBody;

    let { beforeStart, startSection, addedSection } = this.splitReviewSections(newBody);

    // 対象セクション内の AC マーカーを置換する。論理削除済み（➖）は上書きしない。
    // 置換探索順は「追加検証計画 → 開始時検証計画 → 全体」。文脈指定あり（PBI・WP両方）は
    // 各セクションでキー完全一致のみで置換し、盲目フォールバックは行わない。
    // 文脈指定なしの旧来呼び出しのみ盲目置換を維持する（全体で先頭1件のみ・短絡）。
    // 片方のみ指定の部分文脈は不一致として未置換（警告）に回す。同一ブロック内の重複行は
    // 先頭1件のみ置換し、残存は未置換として報告する（サイレント部分成功の防止）。
    // 1件の判定は最初に一致したセクションでのみ適用する（先勝ち・後続セクションへ波及しない）。
    const replaceInSection = (
      section: string,
      pbiNumber: number | undefined,
      wpNumber: string | undefined,
      acNumber: string,
      marker: string,
    ): { section: string; replaced: boolean; duplicateCount: number } => {
      // ⚠️ は2コードポイント（U+26A0＋U+FE0F）のため文字クラス [...] では壊れる。
      // alternation＋u フラグで1記号として扱う。
      const markerAlternatives = "❔|✅|❌|⚠️";
      const hasFullContext = pbiNumber !== undefined && wpNumber !== undefined;
      if (hasFullContext) {
        // 中間の任意文字列は PBI（### 📦）・WP（#### WP_）ヘッダを跨がない。
        // 対象WP内に該当ACが無い場合の後続ブロックへの誤到達（誤帰属）を防ぐ。
        const contextPattern = new RegExp(
          `(### 📦 PBI: \\[${escapeRegex(String(pbiNumber))}\\]` +
            `(?:(?!### 📦)[\\s\\S])*?` +
            `#### WP_${escapeRegex(String(wpNumber))}:.*?\\n` +
            `(?:(?!### 📦|#### WP_)[\\s\\S])*?` +
            `)(${markerAlternatives})\\s*(AC_${escapeRegex(String(acNumber))}:)`,
          "u",
        );
        const matched = contextPattern.exec(section);
        if (!matched) return { section, replaced: false, duplicateCount: 0 };
        section = section.replace(contextPattern, `$1${marker} $3`);
        // 同一WPブロック内の同キー残存行を数える。先頭1件のみ適用のため残りは警告する。
        // PBIアンカー付き全体パターンは全体で1件しか数えられないため、ブロック範囲で行を数える。
        const wpHeaderLiteral = `#### WP_${String(wpNumber)}:`;
        const wpStart = section.indexOf(wpHeaderLiteral, matched.index);
        let blockEnd = section.length;
        for (const delimiter of ["### 📦", "#### WP_"]) {
          const idx = section.indexOf(delimiter, wpStart + wpHeaderLiteral.length);
          if (idx !== -1 && idx < blockEnd) blockEnd = idx;
        }
        const rowPattern = new RegExp(
          `-\\s*(?:${markerAlternatives})\\s*AC_${escapeRegex(String(acNumber))}:`,
          "gu",
        );
        const rowCount = section.slice(wpStart, blockEnd).match(rowPattern)?.length ?? 0;
        return { section, replaced: true, duplicateCount: Math.max(0, rowCount - 1) };
      }
      if (pbiNumber === undefined && wpNumber === undefined) {
        const acPattern = new RegExp(
          `(${markerAlternatives})\\s*(AC_${escapeRegex(String(acNumber))}:)`,
          "u",
        );
        if (acPattern.test(section)) {
          section = section.replace(acPattern, `${marker} $2`);
          return { section, replaced: true, duplicateCount: 0 };
        }
        return { section, replaced: false, duplicateCount: 0 };
      }
      // 部分文脈（片方のみ指定）は盲目置換に落とさず、未置換として呼出側で警告化する。
      return { section, replaced: false, duplicateCount: 0 };
    };

    const unreplaced: UnreplacedAcJudgment[] = [];

    // 成功応答の組み立て。部分成功も success:true で返し、呼出側は
    // output.unreplaced の有無で全件成功と部分成功を区別する。
    const reportSuccess = (): StepResult => {
      if (unreplaced.length > 0) {
        return {
          operation: "report",
          success: true,
          itemId,
          output: buildUnreplacedOutput(unreplaced),
        };
      }
      return { operation: "report", success: true, itemId };
    };

    if (postPlanAcGroups) {
      for (const group of postPlanAcGroups) {
        for (const ac of group.acJudgments) {
          const marker = ac.judgment === "pass" ? "✅" : ac.judgment === "fail" ? "❌" : "⚠️";
          const pbiNumber = group.pbiNumber;
          const wpNumber = group.wpNumber;

          let replaceResult = replaceInSection(
            addedSection,
            pbiNumber,
            wpNumber,
            ac.number,
            marker,
          );
          addedSection = replaceResult.section;
          if (!replaceResult.replaced) {
            replaceResult = replaceInSection(
              startSection,
              pbiNumber,
              wpNumber,
              ac.number,
              marker,
            );
            startSection = replaceResult.section;
          }
          if (!replaceResult.replaced) {
            // beforeStart（凡例・概要・総合判定）は PBI/WP ヘッダを含まないため
            // 文脈あり経路では一致しない。文脈なし旧来呼び出し用にのみ試行する。
            replaceResult = replaceInSection(
              beforeStart,
              pbiNumber,
              wpNumber,
              ac.number,
              marker,
            );
            beforeStart = replaceResult.section;
          }
          if (!replaceResult.replaced) {
            unreplaced.push({ pbiNumber, wpNumber, acNumber: ac.number, reason: "no-match" });
          } else if (replaceResult.duplicateCount > 0) {
            unreplaced.push({ pbiNumber, wpNumber, acNumber: ac.number, reason: "duplicate" });
          }
        }
      }
      newBody = beforeStart + startSection + addedSection;
    }

    if (params.overallResult) {
      const or = params.overallResult as { judgment: string; reason?: string };
      const judgmentMap: Record<string, string> = {
        pass: "✅ 合格",
        conditional: "⚠️ 条件付き合格",
        fail: "❌ 不合格",
      };
      const judgmentText = judgmentMap[or.judgment] ?? or.judgment;
      newBody = newBody.replace(/(?<=### 判定結果\n\n).*/, judgmentText);
      if (or.reason) {
        newBody = newBody.replace(/(?<=### PO意見\n\n).*/, or.reason);
      }
    }

    if (postPlanAcGroups && newBody === currentBody && !params.overallResult) {
      // 判定入力あり・本文無改変・総合判定なし＝実質 no-op のため gh issue edit を呼ばない。
      // 無駄な書込みと履歴ノイズを避ける。判定入力なしの旧来呼び出しの無条件 edit 契約は維持する。
      return reportSuccess();
    }

    const editResult = await this.runCommand("gh", [
      "issue",
      "edit",
      itemId,
      "--body",
      newBody,
      ...this.buildRepoArg(),
    ]);
    if (editResult.code !== 0) {
      return { operation: "report", success: false, error: editResult.stderr };
    }

    // 文脈不一致で置換できなかった判定を警告として可視化する。
    // 部分成功も success:true で返すため、呼出側は output.unreplaced の有無で区別すること。
    return reportSuccess();
  }

  /**
   * revise 操作を処理する。Issue 本文内の AC マーカーを論理削除（➖）に書き換え、
   * スプリント中追加検証計画に新規 AC を追記する。
   */
  private async handleReviewRevise(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "revise", success: false, error: "itemId is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "body",
      ...this.buildRepoArg(),
    ]);
    if (viewResult.code !== 0) {
      return { operation: "revise", success: false, error: viewResult.stderr };
    }
    const parsed = JSON.parse(viewResult.stdout) as { body?: string } | undefined;
    const currentBody = parsed?.body ?? "";

    let { beforeStart, startSection, addedSection } = this.splitReviewSections(currentBody);
    let newBody = currentBody;
    const removed = params.removed as
      | { items?: Array<{ number: string; description: string }> }
      | undefined;
    const removedScoped = params.removedScoped as
      | Array<{ pbiNumber: number; wpNumber: string; number: string; description: string }>
      | undefined;
    const addedGroups = params.addedGroups as
      | Array<
        {
          pbiNumber: number;
          pbiTitle?: string;
          wpNumber: string;
          wpTitle?: string;
          acJudgments: Array<{ number: string; description?: string; judgment?: string }>;
        }
      >
      | undefined;

    // スコープ指定された AC を論理削除（➖）する。
    // 追加検証計画セクション → 開始時検証計画セクション → 全体（フォールバック）の順に置換し、
    // 同番号の旧ACを誤って削除することを防ぐ。
    const removeAcInSection = (
      section: string,
      item: { pbiNumber: number; wpNumber: string; number: string; description: string },
    ): { section: string; removed: boolean } => {
      const acNum = String(item.number);
      const pbiMarker = `### 📦 PBI: [${item.pbiNumber}]`;
      const wpMarker = `#### WP_${item.wpNumber}:`;
      const re = new RegExp(
        `(${escapeRegex(pbiMarker)}[\\s\\S]*?${escapeRegex(wpMarker)}[\\s\\S]*?)- [❔✅⚠️❌] AC_${
          escapeRegex(acNum)
        }:.*`,
      );
      let removed = false;
      if (re.test(section)) {
        section = section.replace(re, `$1- ➖ AC_${acNum}: ${item.description}`);
        removed = true;
      }
      return { section, removed };
    };

    if (removedScoped?.length) {
      for (const item of removedScoped) {
        let r = removeAcInSection(addedSection, item);
        addedSection = r.section;
        if (!r.removed) {
          r = removeAcInSection(startSection, item);
          startSection = r.section;
        }
        if (!r.removed) {
          r = removeAcInSection(beforeStart, item);
          beforeStart = r.section;
        }
      }
      newBody = beforeStart + startSection + addedSection;
    } else if (removed?.items) {
      for (const item of removed.items) {
        const acNum = String(item.number);
        const acPattern = new RegExp(`-\\s*[❔✅⚠️❌]\\s*AC_${escapeRegex(acNum)}:.*`);
        newBody = newBody.replace(acPattern, `- ➖ AC_${acNum}: ${item.description}`);
      }
    }

    if (addedGroups && addedGroups.length > 0) {
      const planSectionMatch = newBody.match(/^## スプリント中追加検証計画[\s\S]*?(?=\n## )/m) ??
        newBody.match(/^## スプリント中追加検証計画[\s\S]*$/m);
      const planLines: string[] = [];
      planLines.push("## スプリント中追加検証計画");
      planLines.push("");
      for (const group of addedGroups) {
        planLines.push(`### 📦 PBI: [${group.pbiNumber}] ${group.pbiTitle ?? ""}`);
        planLines.push("");
        planLines.push(`#### WP_${group.wpNumber}: ${group.wpTitle ?? ""}`);
        planLines.push("");
        for (const ac of group.acJudgments) {
          const desc = ac.description ?? "";
          planLines.push(`- ❔ AC_${ac.number}: ${desc}`);
        }
        planLines.push("");
      }
      const planSection = planLines.join("\n");
      if (planSectionMatch) {
        newBody = newBody.replace(planSectionMatch[0], planSection);
      } else {
        newBody = newBody + "\n" + planSection;
      }
    }

    const editResult = await this.runCommand("gh", [
      "issue",
      "edit",
      itemId,
      "--body",
      newBody,
      ...this.buildRepoArg(),
    ]);
    if (editResult.code !== 0) {
      return { operation: "revise", success: false, error: editResult.stderr };
    }

    return { operation: "revise", success: true, itemId };
  }

  /**
   * findItem 操作を処理する。指定された Issue 番号の詳細情報を取得する。
   * gh issue view に加え、GraphQL で parent/milestone を追加取得する。
   * @param params.itemId - 取得対象の Issue 番号
   * @returns Issue の詳細情報（number, title, body, labels, comments, parent, milestone）を含む StepResult
   */
  async handleFindItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "view", success: false, error: "itemId is required" };
    }
    const args = [
      "issue",
      "view",
      itemId,
      "--json",
      "number,title,body,labels,comments,id,state",
      ...this.buildRepoArg(),
    ];
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "view", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "view", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout) as Record<string, unknown> | undefined;
    if (!output) {
      return { operation: "view", success: false, error: "Failed to parse gh output" };
    }

    // Issue の open/closed を issueState として明示する。
    // ProjectV2 の Status（Todo/In Progress/Done）とは別概念のため、キーを分けて公開する。
    if (typeof output.state === "string") {
      output.issueState = output.state;
    }

    if (this.resolvedScope) {
      try {
        const fieldSelections = HARNESS_FIELDS.map((name, index) =>
          `f${index}: fieldValueByName(name: "${name}") { ... on ProjectV2ItemFieldTextValue { text } ... on ProjectV2ItemFieldSingleSelectValue { name } ... on ProjectV2ItemFieldNumberValue { number } }`
        ).join(" ");
        const enrichQuery =
          `query($owner: String!, $repo: String!, $number: Int!) { repository(owner: $owner, name: $repo) { issue(number: $number) { parent { ... on Issue { number title id } } milestone { number title } subIssues(first: 100) { nodes { ... on Issue { number title id } } } projectItems(first: 10) { nodes { id project { title number } status: fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } ${fieldSelections} } } } } }`;
        const gqlResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${enrichQuery}`,
          "-f",
          `owner=${this.resolvedScope.owner}`,
          "-f",
          `repo=${this.resolvedScope.repository}`,
          "-F",
          `number=${parseInt(itemId, 10)}`,
        ]);
        if (gqlResult.code === 0) {
          const gqlData = JSON.parse(gqlResult.stdout) as {
            data?: {
              repository?: {
                issue?: {
                  parent?: { number: number; title: string; id: string } | null;
                  milestone?: { number: number; title: string } | null;
                  subIssues?: {
                    nodes: Array<{ number: number; title: string; id: string }> | null;
                  };
                  projectItems?: {
                    nodes: Array<Record<string, unknown>> | null;
                  };
                };
              };
            };
          };
          const issue = gqlData?.data?.repository?.issue;
          if (issue) {
            const scope = this.resolvedScope;
            if (issue.parent) {
              output.parent = identify(
                scope,
                issue.parent.title,
                issue.parent.id,
                String(issue.parent.number),
              );
            }
            if (issue.milestone) {
              output.milestone = identify(
                scope,
                issue.milestone.title,
                String(issue.milestone.number),
                String(issue.milestone.number),
              );
            }
            if (issue.subIssues?.nodes) {
              output.children = issue.subIssues.nodes.map((
                n: { number: number; title: string; id: string },
              ) => identify(scope, n.title, n.id, String(n.number)));
            }
            if (issue.projectItems?.nodes) {
              output.projectItems = issue.projectItems.nodes.map((item) => {
                const fields: Record<string, string | number> = {};
                HARNESS_FIELDS.forEach((name, index) => {
                  const raw = item[`f${index}`] as
                    | { text?: string; name?: string; number?: number }
                    | null
                    | undefined;
                  if (!raw) return;
                  if (raw.text !== undefined) fields[name] = raw.text;
                  else if (raw.name !== undefined) fields[name] = raw.name;
                  else if (raw.number !== undefined) fields[name] = raw.number;
                });
                const status = item.status as { name?: string } | null | undefined;
                if (status?.name !== undefined) fields[STATUS_FIELD] = status.name;
                return {
                  project: item.project as { title: string; number: number },
                  itemId: item.id as string,
                  fields,
                };
              });
            }
          }
        }
      } catch { /* enrichment is best-effort */ }
    }

    return {
      operation: "view",
      success: true,
      itemId,
      nodeId: output.id as string | undefined,
      output,
    };
  }

  /**
   * 指定 Issue の milestone（=Sprint）を REST の1呼び出しで取得する。
   * handleFindItem の GraphQL enrich に依存しないため、ガード判定に安全に使える。
   * @param itemId - 取得対象の Issue 番号
   * @returns milestone（GH 上で未設定の場合は null）を含む Success / 失敗時は error
   */
  async getSprintMilestone(itemId: string): Promise<
    StepResult & {
      milestone: {
        number: number;
        title: string;
      } | null;
    }
  > {
    const result = await this.runCommand("gh", [
      "issue",
      "view",
      itemId,
      "--json",
      "milestone",
      ...this.buildRepoArg(),
    ]);
    if (result.code !== 0) {
      return {
        operation: "view",
        success: false,
        itemId,
        error: result.stderr,
        milestone: null,
      };
    }
    try {
      const data = JSON.parse(result.stdout) as {
        milestone?: { number: number; title: string } | null;
      };
      return {
        operation: "view",
        success: true,
        itemId,
        milestone: data?.milestone ?? null,
      };
    } catch {
      return {
        operation: "view",
        success: false,
        itemId,
        error: "Failed to parse milestone from gh output",
        milestone: null,
      };
    }
  }

  /**
   * searchItems 操作を処理する。指定されたラベル種別で Issue を検索する。
   * @param params.type - 検索するラベル種別（例: "Vision"）
   * @returns 検索結果（number, title, labels の配列）を含む StepResult
   */
  async handleSearchItems(params: Record<string, unknown>): Promise<StepResult> {
    const type = String(params.type ?? params.labelType ?? "");
    if (!type) {
      return { operation: "search", success: false, error: "type is required" };
    }
    const keyword = String(params.keyword ?? "");
    if (keyword) {
      return {
        operation: "search",
        success: false,
        error: "keyword search is not yet implemented",
      };
    }
    const state = String(params.state ?? "open");
    const args = [
      "issue",
      "list",
      "--label",
      `type:${type}`,
      "--json",
      "number,title,labels",
      "--state",
      state,
      "--limit",
      "100",
      ...this.buildRepoArg(),
    ];
    const sprintNumber = params.sprintNumber;
    if (sprintNumber !== undefined && sprintNumber !== "") {
      args.push("--milestone", `Sprint ${sprintNumber}`);
    }
    let result;
    try {
      result = await this.runCommand("gh", args);
    } catch (e) {
      return { operation: "search", success: false, error: String(e) };
    }
    if (result.code !== 0) {
      return { operation: "search", success: false, error: result.stderr };
    }

    const output = parseJsonOutput(result.stdout);
    if (output === undefined) {
      return { operation: "search", success: false, error: "Failed to parse gh output" };
    }

    return { operation: "search", success: true, output };
  }

  /**
   * Project V2 Board の Status フィールドでアイテムを検索する。
   *
   * 返却する各アイテムはWP操作スキルへそのまま渡せる識別子と、判断材料を含む：
   * `number` / `title` / `id`（node id）/ `code`（Issue番号文字列）/ `status`（ProjectV2 Status）/
   * `issueState`（Issueの開閉。Statusとは別概念）/ `parentPbi`（親PBI識別子。無ければ null）/
   * `initialEstimate` / `plannedEstimate`（Sprint Boardの `harness-effort-summary`。未設定は null）/
   * `acCount`（本文中のAC行数）。
   *
   * @param params.status - 検索する Status 名（"Todo", "In Progress", "Done", "__none__" 等）
   * @param params.labelType - ラベル種別（例: "WP"）
   * @param params.boardNumber - Project V2 ボード番号
   * @param params.parentPbiNumber - 親PBIのIssue番号。指定時は当該PBI配下のWPのみに絞り込む
   * @param params.sprintNumber - スプリント番号。指定時はマイルストーンで絞り込む
   */
  async handleProjectSearchItems(params: Record<string, unknown>): Promise<StepResult> {
    const status = String(params.status ?? "");
    const labelType = String(params.labelType ?? "");
    const boardNumber = Number(params.boardNumber ?? 0);
    if (!status || !labelType || !boardNumber) {
      return {
        operation: "search",
        success: false,
        error: "status, labelType, and boardNumber are required",
      };
    }
    const keyword = String(params.keyword ?? "");
    if (keyword) {
      return {
        operation: "search",
        success: false,
        error: "keyword search is not yet implemented",
      };
    }
    const board = this.resolveBoardOwner();
    if (!board.login) {
      return { operation: "search", success: false, error: "Scope not resolved" };
    }

    // ProjectV2 の `query` 引数（プロジェクトUIフィルタDSL）でサーバー側フィルタする。
    // status と sprintNumber はスキル呼出時の引数（WorkPackageSearchCondition）をそのまま使う。
    const sprintNumber = params.sprintNumber;
    const isNoneStatus = status === "__none__";
    const rawParentPbiNumber = params.parentPbiNumber;
    const parentPbiNumber = rawParentPbiNumber === undefined || rawParentPbiNumber === null ||
        rawParentPbiNumber === ""
      ? null
      : Number(rawParentPbiNumber);
    if (parentPbiNumber !== null && (!Number.isInteger(parentPbiNumber) || parentPbiNumber <= 0)) {
      return {
        operation: "search",
        success: false,
        error: "INVALID_INPUT: parentPbiNumber must be a positive integer",
      };
    }

    const filterParts: string[] = [];
    if (!isNoneStatus) {
      filterParts.push(`status:"${status}"`);
    }
    if (sprintNumber !== undefined && sprintNumber !== "") {
      filterParts.push(`milestone:"Sprint ${sprintNumber}"`);
    }
    const filterQuery = filterParts.join(" ");

    const items = await this.#fetchProjectItems(
      board.login,
      boardNumber,
      filterQuery,
      board.ownerType,
    );
    if (items === null) {
      return {
        operation: "search",
        success: false,
        error: "Failed to fetch project items via GraphQL",
      };
    }

    // `__none__`（status未設定）はクエリDSLで表現できないため、取得後にローカルで判定する。
    // `parentPbiNumber` もクエリDSLで表現できないため、同じく取得後にローカルで絞り込む
    //（100件上限を超えるボードでは取りこぼし得る既知の制約）。
    const matched = items.filter((item) => {
      if (isNoneStatus) {
        if (item.status != null) return false;
      } else {
        if ((item.status ?? null) !== status) return false;
      }
      if (parentPbiNumber !== null && item.parent?.number !== parentPbiNumber) return false;
      return true;
    });
    return {
      operation: "search",
      success: true,
      output: matched.map((item) => {
        const { initialEstimate, plannedEstimate } = parseEffortEstimates(item.effortText);
        // 親の意味は entity で異なる（WPの親はPBI、PBIの親はFeature）。
        // WP検索は `parentPbi`、それ以外は汎用キー `parent` で返す。
        const parentKey = labelType === "WP" ? "parentPbi" : "parent";
        const parent = item.parent
          ? {
            title: item.parent.title,
            id: item.parent.id,
            code: String(item.parent.number),
          }
          : null;
        return {
          number: item.number,
          title: item.title,
          id: item.id,
          code: String(item.number),
          status: item.status,
          issueState: item.issueState,
          [parentKey]: parent,
          initialEstimate,
          plannedEstimate,
          acCount: countAcceptanceCriteria(item.body),
        };
      }),
    };
  }

  /**
   * ProjectV2 ボードの項目を GraphQL で取得する。
   * `ProjectV2.items` の `query` 引数（プロジェクトUIフィルタDSL）でサーバー側フィルタし、
   * WP検索に必要なフィールド（Issue番号・タイトル・node id・開閉・本文・親PBI・Status・
   * effort見積）のみ取得する。ページネーション対応。
   * @returns 取得した項目の配列。取得失敗時は null
   */
  async #fetchProjectItems(
    owner: string,
    boardNumber: number,
    filterQuery: string,
    ownerType: BoardOwnerType = "organization",
  ): Promise<ProjectSearchItem[] | null> {
    const root = projectV2OwnerRoot(ownerType);
    const query = `query($owner: String!, $number: Int!, $filter: String, $cursor: String) {
      ${root}(login: $owner) {
        projectV2(number: $number) {
          items(first: 100, after: $cursor, query: $filter) {
            pageInfo { hasNextPage endCursor }
            nodes {
              content {
                ... on Issue {
                  id
                  number
                  title
                  state
                  body
                  parent { ... on Issue { id number title } }
                }
              }
              fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } }
              effort: fieldValueByName(name: "${FIELD.effortSummary}") { ... on ProjectV2ItemFieldTextValue { text } }
            }
          }
        }
      }
    }`;
    const items: ProjectSearchItem[] = [];
    let cursor: string | null = null;
    while (true) {
      const args = [
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-f",
        `owner=${owner}`,
        "-F",
        `number=${boardNumber}`,
        "-f",
        `filter=${filterQuery}`,
      ];
      if (cursor) {
        args.push("-f", `cursor=${cursor}`);
      }
      const res = await this.runProjectV2Query(args);
      if (res.code !== 0) return null;
      const parsed = parseJsonOutput(res.stdout) as {
        data?: {
          organization?: {
            projectV2?: {
              items?: {
                pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
                nodes?: Array<{
                  content?: {
                    id?: string;
                    number?: number;
                    title?: string;
                    state?: string;
                    body?: string;
                    parent?: { id?: string; number?: number; title?: string } | null;
                  } | null;
                  fieldValueByName?: { name?: string } | null;
                  effort?: { text?: string } | null;
                }>;
              };
            };
          };
        };
      };
      const conn = parsed?.data?.organization?.projectV2?.items;
      if (!conn) return null;
      for (const node of conn.nodes ?? []) {
        const number = node.content?.number;
        const title = node.content?.title;
        if (number === undefined || title === undefined) continue;
        const parent = node.content?.parent;
        items.push({
          number,
          title,
          id: node.content?.id ?? "",
          issueState: node.content?.state ?? "",
          body: node.content?.body ?? "",
          status: node.fieldValueByName?.name ?? null,
          parent: parent && parent.number !== undefined && parent.title !== undefined
            ? { number: parent.number, title: parent.title, id: parent.id ?? "" }
            : null,
          effortText: node.effort?.text ?? null,
        });
      }
      if (conn.pageInfo?.hasNextPage && conn.pageInfo.endCursor) {
        cursor = conn.pageInfo.endCursor;
      } else {
        break;
      }
    }
    return items;
  }

  async #handleShowHierarchy(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "showHierarchy", success: false, error: "itemId is required" };
    }
    if (!this.resolvedScope) {
      return { operation: "showHierarchy", success: false, error: "Scope not resolved" };
    }

    const query = `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
          number
          title
          body
          subIssues(first: 100) {
            nodes {
              ... on Issue {
                id
                number
                title
                body
                labels(first: 10) { nodes { name } }
              }
            }
          }
        }
      }
    }`;

    let graphqlResult;
    try {
      graphqlResult = await this.runCommand("gh", [
        "api",
        "graphql",
        "-f",
        `query=${query}`,
        "-f",
        `owner=${this.resolvedScope.owner}`,
        "-f",
        `repo=${this.resolvedScope.repository}`,
        "-F",
        `number=${parseInt(itemId, 10)}`,
      ]);
    } catch (e) {
      return { operation: "showHierarchy", success: false, error: String(e) };
    }
    if (graphqlResult.code !== 0) {
      return { operation: "showHierarchy", success: false, error: graphqlResult.stderr };
    }

    const parsed = parseJsonOutput(graphqlResult.stdout);
    if (parsed === undefined) {
      return {
        operation: "showHierarchy",
        success: false,
        error: "Invalid response from GitHub API",
      };
    }

    const data = parsed as {
      errors?: Array<{ message: string }>;
      data?: {
        repository?: {
          issue: {
            id: string;
            number: number;
            title: string;
            body: string;
            subIssues: {
              nodes:
                | Array<{
                  id: string;
                  number: number;
                  title: string;
                  body: string;
                  labels: { nodes: Array<{ name: string }> };
                }>
                | null;
            };
          } | null;
        };
      };
    };

    if (data.errors && data.errors.length > 0) {
      return {
        operation: "showHierarchy",
        success: false,
        error: `GraphQL error: ${data.errors.map((e) => e.message).join("; ")}`,
      };
    }

    const issue = data?.data?.repository?.issue;
    if (!issue) {
      return { operation: "showHierarchy", success: false, error: "Epic not found" };
    }

    const featureList: FeatureData[] = (issue.subIssues?.nodes ?? []).map((node) => ({
      identifier: identify(
        this.resolvedScope!,
        node.title,
        node.id,
        String(node.number),
      ),
      statement: { description: node.body ?? "" },
      state: "open" as const,
    }));

    const epicData: EpicData = {
      identifier: identify(
        this.resolvedScope!,
        issue.title,
        issue.id,
        String(issue.number),
      ),
      statement: { description: issue.body ?? "" },
      state: "open" as const,
      features: { items: featureList, totalCount: featureList.length },
    };

    return {
      operation: "showHierarchy",
      success: true,
      itemId,
      output: epicData,
    };
  }

  async #handleShowHierarchyAll(): Promise<StepResult> {
    if (!this.resolvedScope) {
      return { operation: "showHierarchyAll", success: false, error: "Scope not resolved" };
    }

    const listResult = await this.runCommand("gh", [
      "issue",
      "list",
      "--label",
      "type:Epic",
      "--json",
      "number,title,body",
      "--state",
      "open",
      ...this.buildRepoArg(),
    ]);
    if (listResult.code !== 0) {
      return { operation: "showHierarchyAll", success: false, error: listResult.stderr };
    }

    const epics = parseJsonOutput(listResult.stdout) as
      | Array<{ number: number; title: string; body: string }>
      | undefined;
    if (!epics || epics.length === 0) {
      return {
        operation: "showHierarchyAll",
        success: true,
        output: { items: [], totalCount: 0 },
      };
    }

    const query = `query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          id
          number
          title
          body
          subIssues(first: 100) {
            nodes {
              ... on Issue {
                id
                number
                title
                body
                labels(first: 10) { nodes { name } }
              }
            }
          }
        }
      }
    }`;

    const epicDataList: EpicData[] = [];
    for (const epic of epics) {
      let graphqlResult;
      try {
        graphqlResult = await this.runCommand("gh", [
          "api",
          "graphql",
          "-f",
          `query=${query}`,
          "-f",
          `owner=${this.resolvedScope.owner}`,
          "-f",
          `repo=${this.resolvedScope.repository}`,
          "-F",
          `number=${epic.number}`,
        ]);
      } catch {
        continue;
      }
      if (graphqlResult.code !== 0) continue;

      const parsed = parseJsonOutput(graphqlResult.stdout) as {
        data?: {
          repository?: {
            issue?: {
              id: string;
              number: number;
              title: string;
              body: string;
              subIssues: {
                nodes:
                  | Array<
                    {
                      id: string;
                      number: number;
                      title: string;
                      body: string;
                      labels: { nodes: Array<{ name: string }> };
                    }
                  >
                  | null;
              };
            } | null;
          };
        };
      } | undefined;
      const issue = parsed?.data?.repository?.issue;
      if (!issue) continue;

      const featureList: FeatureData[] = (issue.subIssues?.nodes ?? []).map((node) => ({
        identifier: identify(this.resolvedScope!, node.title, node.id, String(node.number)),
        statement: { description: node.body ?? "" },
        state: "open" as const,
      }));

      epicDataList.push({
        identifier: identify(this.resolvedScope!, issue.title, issue.id, String(issue.number)),
        statement: { description: issue.body ?? "" },
        state: "open" as const,
        features: { items: featureList, totalCount: featureList.length },
      });
    }

    return {
      operation: "showHierarchyAll",
      success: true,
      output: { items: epicDataList, totalCount: epicDataList.length },
    };
  }

  /**
   * AC指定値（数値配列・単一値・未指定）を正規化する。
   * @param value `acceptanceCriteria` の生値
   * @returns 番号配列。未指定なら undefined、不正値なら null
   */
  #normalizeAcNumbers(value: unknown): number[] | undefined | null {
    if (value === undefined || value === null) return undefined;
    const raw = Array.isArray(value) ? value : [value];
    if (raw.length === 0) return null;
    const numbers: number[] = [];
    for (const item of raw) {
      const number = typeof item === "number" ? item : Number(String(item));
      if (!Number.isInteger(number) || number <= 0) return null;
      numbers.push(number);
    }
    return numbers;
  }

  /**
   * Issue本文を取得する。
   * `handleCheckAcceptanceCriteria` と `updateItemWithBodyAppend` で共通利用する。
   *
   * @param itemId 対象Issue番号
   * @returns `body` または `error`（gh失敗・応答不正）
   */
  async #readIssueBody(itemId: string): Promise<{ body: string } | { error: string }> {
    let result: ExecuteResult;
    try {
      result = await this.runCommand("gh", [
        "issue",
        "view",
        itemId,
        "--json",
        "body",
        ...this.buildRepoArg(),
      ]);
    } catch (e) {
      return { error: String(e) };
    }
    if (result.code !== 0) return { error: result.stderr };
    const parsed = parseJsonOutput(result.stdout);
    if (!isRecord(parsed) || typeof parsed.body !== "string") {
      return { error: "Failed to parse gh output" };
    }
    return { body: parsed.body };
  }

  /**
   * Issue本文中のACチェックボックス行を✅化する。
   *
   * 更新範囲はAC行のみに限定され（付随エビデンス行・本文の他領域・改行コードは保持）、
   * 本文全体を差し替えるインターフェースは提供しない。
   *
   * 失敗させる条件（fail-closed）:
   * - `acceptanceCriteria` が空配列、または正の整数でない
   * - 指定AC番号が本文に存在しない
   * - AC番号を省略したが、本文にAC行が1件も無い（書式不一致の無言スキップを防ぐ）
   *
   * 書換が不要（全て既に✅）ならGitHubへの書込を行わず `skipped: true` を返す。
   *
   * @param params.itemId - 対象WPのIssue番号
   * @param params.acceptanceCriteria - ✅化するAC番号の配列。省略時は本文中の全AC
   * @returns 更新結果。`output.updated` に✅化したAC番号、`output.alreadyDone` に既✅、
   *          `output.duplicates` に重複番号、`output.total` に本文中のAC行数、
   *          `output.skipped` に書込省略の有無
   */
  async handleCheckAcceptanceCriteria(params: Record<string, unknown>): Promise<StepResult> {
    const operation = "checkAcceptanceCriteria";
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const numbers = this.#normalizeAcNumbers(params.acceptanceCriteria);
    if (numbers === null) {
      return {
        operation,
        success: false,
        itemId,
        error: "INVALID_INPUT: acceptanceCriteria must be a non-empty array of positive integers",
      };
    }

    const view = await this.#readIssueBody(itemId);
    if ("error" in view) {
      return { operation, success: false, itemId, error: view.error };
    }

    const result = applyAcceptanceCriteriaDone(view.body, numbers);
    if (result.missing.length > 0) {
      return {
        operation,
        success: false,
        itemId,
        error: `INVALID_INPUT: acceptance criteria not found: ${result.missing.join(", ")}`,
      };
    }
    // AC番号を省略したのにAC行が1件も無い場合は、書式不一致による無言スキップとみなして失敗させる。
    if (numbers === undefined && result.total === 0) {
      return {
        operation,
        success: false,
        itemId,
        error: "INVALID_INPUT: no acceptance criteria lines found in the issue body",
      };
    }
    if (result.updated.length === 0) {
      return {
        operation,
        success: true,
        itemId,
        output: {
          itemId,
          updated: [],
          alreadyDone: result.alreadyDone,
          duplicates: result.duplicates,
          total: result.total,
          skipped: true,
        },
      };
    }

    const edit = await this.runCommand("gh", [
      "issue",
      "edit",
      itemId,
      "--body",
      result.body,
      ...this.buildRepoArg(),
    ]);
    if (edit.code !== 0) {
      return { operation, success: false, itemId, error: edit.stderr };
    }
    return {
      operation,
      success: true,
      itemId,
      output: {
        itemId,
        updated: result.updated,
        alreadyDone: result.alreadyDone,
        duplicates: result.duplicates,
        total: result.total,
        skipped: false,
      },
    };
  }

  /**
   * updateItem 操作を処理する。GitHub Issue のタイトル更新および本文操作を行う。
   * @param params.itemId - 更新対象の Issue 番号
   * @param params.title - 新しいタイトル（省略時は変更なし）
   * @param params.body - 既存本文を全文置換する内容（省略時は置換なし）。
   *                       bodyAppend と同時指定された場合は bodyAppend が優先される。
   * @param params.bodyAppend - 既存本文に追記する内容（省略時は追記なし）。
   *                            body より優先される。
   * @returns 更新結果の StepResult
   */
  async handleUpdateItem(params: Record<string, unknown>): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation: "update", success: false, error: "itemId is required" };
    }
    const title = params.title ? String(params.title) : undefined;
    const body = params.body ? String(params.body) : undefined;
    const bodyAppend = params.bodyAppend ? String(params.bodyAppend) : undefined;

    if (bodyAppend) {
      return await this.updateItemWithBodyAppend(itemId, title, bodyAppend);
    }

    if (body) {
      return await this.updateItemWithFullBody(itemId, title, body);
    }

    const args = ["issue", "edit", itemId, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  private async updateItemWithBodyAppend(
    itemId: string,
    title: string | undefined,
    bodyAppend: string,
  ): Promise<StepResult> {
    const view = await this.#readIssueBody(itemId);
    if ("error" in view) {
      return { operation: "update", success: false, error: view.error };
    }
    const currentBody = view.body;
    // 既存本文と追記内容の間に空行を入れて Markdown 構造（見出し・リスト）の連結崩れを防ぐ。
    const newBody = currentBody ? `${currentBody}\n\n${bodyAppend}` : bodyAppend;
    const args = ["issue", "edit", itemId, "--body", newBody, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  private async updateItemWithFullBody(
    itemId: string,
    title: string | undefined,
    body: string,
  ): Promise<StepResult> {
    const args = ["issue", "edit", itemId, "--body", body, ...this.buildRepoArg()];
    if (title) args.push("--title", title);
    const result = await this.runCommand("gh", args);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  #milestoneUrl(itemId?: string): string {
    if (!this.resolvedScope) return "";
    const base = `repos/${this.resolvedScope.owner}/${this.resolvedScope.repository}/milestones`;
    return itemId ? `${base}/${itemId}` : base;
  }

  async #handleSprintCreate(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const title = String(params.title ?? "");
    const description = String(params.description ?? "");
    if (!title) {
      return { operation, success: false, error: "Milestone title is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "POST",
      this.#milestoneUrl(),
      "-f",
      `title=${title}`,
      "-f",
      `description=${description}`,
    ]);
    if (result.code !== 0) {
      const stderr = result.stderr ?? "";
      if (stderr.includes("HTTP 422") || stderr.includes("already exists")) {
        return {
          operation,
          success: false,
          error: `Milestone "${title}" already exists. Each sprint number must be unique.`,
        };
      }
      return { operation, success: false, error: stderr };
    }
    const output = parseJsonOutput(result.stdout) as { number?: number } | undefined;
    return {
      operation,
      success: true,
      itemId: String(output?.number ?? ""),
      output,
    };
  }

  async #handleSprintEnd(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      "state=closed",
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSetGoal(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const description = String(params.description ?? "");

    const viewResult = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (viewResult.code !== 0) {
      return { operation, success: false, error: viewResult.stderr };
    }
    const milestone = parseJsonOutput(viewResult.stdout) as { description?: string } | undefined;
    const current = milestone?.description ?? "";

    const velocitySectionRe = /^## Velocity\s*$[\s\S]*?(?=^## |$(?![\s\S]))/gm;
    const velocityMatches = current.match(velocitySectionRe) ?? [];
    const newDescription = velocityMatches.length > 0
      ? `${description.trimEnd()}\n\n${velocityMatches.join("\n")}`
      : description;

    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `description=${newDescription}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  /**
   * recordVelocity 操作を処理する。Milestone description に `## Velocity` セクションを追記し、
   * 既存の `## Goal` セクションと同居させる。
   * @param params.itemId - 対象 Milestone の番号
   * @param params.velocity - ベロシティ集計値（sprintNumber, pbiCount, totalWeight, matchRate, summary）
   */
  async #handleSprintRecordVelocity(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const velocity = params.velocity as
      | {
        sprintNumber: number;
        pbiCount: number;
        totalWeight: number;
        matchRate: number;
        summary: string;
      }
      | undefined;
    if (!velocity) {
      return { operation, success: false, error: "velocity is required" };
    }

    const viewResult = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (viewResult.code !== 0) {
      return { operation, success: false, error: viewResult.stderr };
    }
    const milestone = parseJsonOutput(viewResult.stdout) as { description?: string } | undefined;
    const current = milestone?.description ?? "";

    const velocityLine = `${velocity.pbiCount} PBI / ${velocity.totalWeight} points / ${
      Math.round(velocity.matchRate * 100)
    }% 一致 / ${String(velocity.summary ?? "").replace(/\s+/g, " ").trim()}`;
    const velocitySection = `## Velocity\n\n${velocityLine}`;

    const newDescription = upsertVelocitySection(current, velocitySection);

    const updateResult = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `description=${newDescription}`,
    ]);
    if (updateResult.code !== 0) {
      return { operation, success: false, error: updateResult.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSetDueDate(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const dueDate = String(params.dueDate ?? "");
    if (!dueDate) {
      return { operation, success: false, error: "dueDate is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      "-X",
      "PATCH",
      this.#milestoneUrl(itemId),
      "-f",
      `due_on=${dueDate}`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    return { operation, success: true, itemId };
  }

  async #handleSprintSearch(
    operation: string,
    params: Record<string, unknown>,
  ): Promise<StepResult> {
    const state = String(params.state ?? "open");
    const result = await this.runCommand("gh", [
      "api",
      `repos/${this.resolvedScope?.owner ?? "unknown"}/${
        this.resolvedScope?.repository ?? "unknown"
      }/milestones?state=${state}&per_page=100&direction=desc`,
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    const milestones = parseJsonOutput(result.stdout) as Array<{ number: number }> | undefined;
    if (!milestones || milestones.length === 0) {
      return { operation, success: false, error: `No ${state} milestones found` };
    }
    const latest = milestones[0];
    return {
      operation,
      success: true,
      itemId: String(latest.number),
      output: milestones,
    };
  }

  async #handleSprintView(
    operation: string,
    params: Record<string, unknown>,
    lastItemId?: string,
  ): Promise<StepResult> {
    const itemId = String(params.itemId ?? lastItemId ?? "");
    if (!itemId) {
      return { operation, success: false, error: "itemId is required" };
    }
    const result = await this.runCommand("gh", [
      "api",
      this.#milestoneUrl(itemId),
    ]);
    if (result.code !== 0) {
      return { operation, success: false, error: result.stderr };
    }
    const output = parseJsonOutput(result.stdout) as Record<string, unknown> | undefined;
    return { operation, success: true, itemId, output };
  }

  async handleSetParent(
    itemId: string,
    parentId: string,
  ): Promise<StepResult> {
    const epicNode = await this.runCommand(
      "gh",
      ["issue", "view", parentId, "--json", "id", ...this.buildRepoArg()],
    );
    if (epicNode.code !== 0) {
      return { operation: "update", success: false, error: epicNode.stderr };
    }
    const featureNode = await this.runCommand(
      "gh",
      ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
    );
    if (featureNode.code !== 0) {
      return { operation: "update", success: false, error: featureNode.stderr };
    }
    const epicNodeId = (JSON.parse(epicNode.stdout) as { id: string }).id;
    const featureNodeId = (JSON.parse(featureNode.stdout) as { id: string }).id;
    const mutation =
      `mutation($epic: ID!, $feature: ID!) { addSubIssue(input: {issueId: $epic, subIssueId: $feature, replaceParent: true}) { issue { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${mutation}`,
      "-f",
      `epic=${epicNodeId}`,
      "-f",
      `feature=${featureNodeId}`,
    ]);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }

  async handleRemoveParent(
    itemId: string,
  ): Promise<StepResult> {
    const featureNode = await this.runCommand(
      "gh",
      ["issue", "view", itemId, "--json", "id", ...this.buildRepoArg()],
    );
    if (featureNode.code !== 0) {
      return { operation: "update", success: false, error: featureNode.stderr };
    }
    const featureNodeId = (JSON.parse(featureNode.stdout) as { id: string }).id;
    const parentQuery =
      `query { node(id: "${featureNodeId}") { ... on Issue { parent { ... on Issue { id } } } } }`;
    const parentResult = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${parentQuery}`,
    ]);
    if (parentResult.code !== 0) {
      return { operation: "update", success: false, error: parentResult.stderr };
    }
    const parentData = JSON.parse(parentResult.stdout) as {
      data?: { node?: { parent?: { id: string } | null } };
    };
    const parentNodeId = parentData?.data?.node?.parent?.id;
    if (!parentNodeId) {
      return { operation: "update", success: true, itemId };
    }
    const mutation =
      `mutation($parent: ID!, $feature: ID!) { removeSubIssue(input: {issueId: $parent, subIssueId: $feature}) { issue { id } } }`;
    const result = await this.runCommand("gh", [
      "api",
      "graphql",
      "-f",
      `query=${mutation}`,
      "-f",
      `parent=${parentNodeId}`,
      "-f",
      `feature=${featureNodeId}`,
    ]);
    if (result.code !== 0) {
      return { operation: "update", success: false, error: result.stderr };
    }
    return { operation: "update", success: true, itemId };
  }
}
