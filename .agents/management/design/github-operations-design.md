# GitHub Operations 設計方針

> 本ドキュメントは GitHub-PBI-Skills PBI 配下の WP 横断で参照される**設計契約**です。 各 WP の
> implementation_plan は本ドキュメントを前提として作成されます。

## 1. アーキテクチャ概要

3 層アーキテクチャを採用:

```
┌─────────────────────────────────────────────┐
│ Layer 3: Skill Layer (CLI scripts)          │  ← CLI エントリポイント
└─────────────────────────────────────────────┘
                ↓ uses
┌─────────────────────────────────────────────┐
│ Layer 2: Domain Model (Entity Objects)      │  ← ビジネスロジック
└─────────────────────────────────────────────┘
                ↓ uses
┌─────────────────────────────────────────────┐
│ Layer 1: Gateway (GitHubOperations)         │  ← gh CLI の thin wrapper
└─────────────────────────────────────────────┘
                ↓ uses
┌─────────────────────────────────────────────┐
│ Layer 0: gh CLI                             │  ← 外部コマンド
└─────────────────────────────────────────────┘
```

## 2. 設計原則（6 点）

### 2.1 owner/repo の明示性

全ての GitHub 操作は `context: IGitHubContext` を第 1 引数として受け取る。 暗黙の `gh`
コンテキスト（`CWD` / `GH_REPO` / `gh repo set-default`）に依存しない。

### 2.2 GitHub ネイティブ機能の優先

自前の workaround（body への `parent: #N` 追記等）は禁止。 GitHub が公式に用意している
API/機能（`addSubIssue` GraphQL mutation 等）を使用する。

### 2.3 GraphQL の安全性

ユーザー入力を GraphQL クエリ文字列に直接埋め込まない。 `gh api graphql -F field=value`
形式でフィールドパラメータ渡しする。

### 2.4 Context 統一性

全ての GitHub 操作関数は第 1 引数として `context: IGitHubContext` を受け取る。 target repository
の所在が関数シグネチャから明らかになり、誤用の余地を排除する。

### 2.5 OCP/LSP 準拠の Interface 階層

- **OCP**: 既存コードの修正なしに新機能を追加できる構造
- **LSP**: 派生クラスは基底クラスと置換可能
- `IGitHubOperations` Interface + `GitHubOperations` 具象クラスを**最小実装**として提供
- 堅牢化（auth, schema）は別 PBI で `AuthenticatedGitHubOperations extends GitHubOperations`
  として追加

### 2.6 命名規則（可読性優先）

- **省略形を避け、完全な名前を使う**（例: `ctx` ではなく `context`、`repo` ではなく `repository`）
- 文字数制限は理由にしない（TypeScript には存在しない）
- ただし、TypeScript 慣習として広く使われる省略形（`err`, `req`, `res`, `id` 等）は許容
- 本設計書では、**引数名・変数名は可読性優先**、**型名・クラス名は TypeScript
  慣習（PascalCase）**を遵守

## 3. PO 設計方針（採用するもの）

3. **JSON Schema 検証と per-skill 属性制限** — 別
   PBI（`AuthenticatedGitHubOperations.validatePayload`）で実装
4. **owner/repo 必須 + auth 切替/login 誘導** — 別
   PBI（`AuthenticatedGitHubOperations.ensureAuth`）で実装
5. **Projects V2 cross-repo check** — 別 PBI（`AuthenticatedGitHubOperations.addToProject`
   override）で実装

### 3.1 JSON Schema 活用方針（既存資産の再利用）

PO 介入 #8 で確認された既存資産を活用する:

**既存資産**: `.github/schemas/harnessrc-schema.json`（JSON Schema draft-07、116 行）

- `.harnessrc` 設定（Projects V2 番号、カスタムフィールド名、タイプ選択肢）を定義
- `customFields.{type,size,status,sequence,effort}` のマッピング規約を確立
- `harness-type.options` で PBI 種別（`Epic`/`Feature`/`PBI`/`WP`/`Review`/`Reflection`）を定義
- バリデータ: `.agents/core/validate-harnessrc.ts`（既存）

**per-skill JSON Schema の設計方針**:

- スキルごと payload スキーマは
  `.agents/skills/bundles/<bundle>/<skill>/schemas/<skill>-payload.schema.json` に配置
- フィールドの `enum` は `.harnessrc` の値（`harness-type.options` 等）と**整合**させる
- バリデーション時は `.harnessrc` を読み込み、動的に `enum` を解決する
- 例: `github-pbi-create-payload.schema.json` の `type` フィールドの `enum` は `.harnessrc` の
  `harness-type.options` から派生
- 静的な型定義と動的な値検証の**ハイブリッド**設計

**新しいスキーマファイルを作る際のチェックリスト**:

- [ ] `.github/schemas/` に類似の既存スキーマがないか確認
- [ ] `.harnessrc` の値と整合する `enum` を使う
- [ ] JSON Schema draft-07 準拠（既存と合わせる）
- [ ] `$id` を GitHub リポジトリ URL で設定（既存パターン踏襲）

## 4. レイヤー責務

### 4.1 Layer 1: Gateway (`GitHubOperations`)

**責務**: `gh` CLI の薄いラッパー。1 操作 = 1 `gh` 呼び出し。

**IF 契約**: `IGitHubOperations` Interface

```typescript
export interface IGitHubContext {
  owner: string;
  repo: string;
}

export interface IGitHubOperations {
  // === Issue 操作 ===
  createIssue(context: IGitHubContext, opts: CreateIssueOptions, options?: RunOptions): Promise<...>;
  searchIssues(context: IGitHubContext, opts?: SearchIssuesOptions, options?: RunOptions): Promise<...>;
  updateIssue(context: IGitHubContext, number: number, opts: UpdateIssueOptions, options?: RunOptions): Promise<...>;
  closeIssue(context: IGitHubContext, number: number, options?: RunOptions): Promise<...>;
  createChildIssue(context: IGitHubContext, opts: CreateChildIssueOptions, options?: RunOptions): Promise<...>;
  addLabels(context: IGitHubContext, number: number, labels: string[], options?: RunOptions): Promise<...>;

  // === Projects V2 操作 ===
  addToProject(context: IGitHubContext, issueNumber: number, projectId: string, options?: RunOptions): Promise<...>;
  getProjectFields(context: IGitHubContext, projectId: string, options?: RunOptions): Promise<...>;
  setProjectField(context: IGitHubContext, opts: SetProjectFieldOptions, options?: RunOptions): Promise<...>;

  // === Milestone 操作 ===
  createMilestone(context: IGitHubContext, opts: CreateMilestoneOptions, options?: RunOptions): Promise<...>;
  listMilestones(context: IGitHubContext, options?: RunOptions): Promise<...>;
}
```

**実装クラス**: `GitHubOperations implements IGitHubOperations`（11 メソッドの最小実装）

**関数エクスポート（後方互換）**:

```typescript
export const createIssue = (context, opts, options) =>
  new GitHubOperations().createIssue(context, opts, options);
// ... 11 関数すべて
```

### 4.2 Layer 2: Domain Model

**責務**: ビジネスロジックのカプセル化、エンティティのライフサイクル管理。

**エンティティ**:

```typescript
// === Issue エンティティ ===
export class Issue {
  constructor(
    public readonly context: IGitHubContext,
    public readonly number: number,
    public title: string,
    public body: string,
    public labels: string[],
    public state: "open" | "closed",
    public milestone?: string,
  ) {}

  // 静的ファクトリ（永続化）
  static async create(context: IGitHubContext, params): Promise<Issue>;
  static async find(context: IGitHubContext, number: number): Promise<Issue | null>;
  static async list(context: IGitHubContext, filter?): Promise<Issue[]>;

  // インスタンスメソッド（ドメインロジック）
  addLabel(label: string): this;
  removeLabel(label: string): this;
  async save(): Promise<Issue>;
  async close(): Promise<Issue>;
  async createChild(params): Promise<Issue>;
}

// === Project エンティティ ===
export class Project {
  constructor(public readonly context: IGitHubContext, public readonly id: string) {}
  static async find(context: IGitHubContext, id: string): Promise<Project>;
  async addItem(issue: Issue): Promise<void>;
  async getFields(): Promise<ProjectField[]>;
  async setField(itemId: string, field: ProjectField, value: string): Promise<void>;
}

// === Milestone エンティティ ===
export class Milestone {
  constructor(
    public readonly context: IGitHubContext,
    public readonly number: number,
    public title: string,
    public description?: string,
    public dueOn?: string,
  ) {}

  static async create(context: IGitHubContext, params): Promise<Milestone>;
  static async list(context: IGitHubContext): Promise<Milestone[]>;
}
```

**重要なパターン**: Active Record 風。エンティティが自身の永続化（`save`,
`close`）と関連操作（`createChild`, `addItem`）を持つ。

### 4.3 Layer 3: Skill Layer

**責務**: CLI スクリプト、stdin/stdout での入出力。

**利用方針**: Domain Model 層を経由して操作（直接 Gateway 関数を呼ばない）。

**例**:

```typescript
// github-pbi-open.ts
const context = parseRepoFlag(args.repo);
const issue = await Issue.create(context, {
  title: input.title,
  body: input.body,
  labels,
});
console.log(JSON.stringify({ success: true, data: { number: issue.number } }));
```

```typescript
// github-pbi-update.ts
const context = parseRepoFlag(args.repo);
const issue = await Issue.find(context, input.number);
if (!issue) {
  console.error("Not found");
  Deno.exit(1);
}
if (input.title) issue.title = input.title;
if (input.addLabels) input.addLabels.forEach((l) => issue.addLabel(l));
await issue.save();
```

## 5. WP 構造（PO 介入 #7 反映後の確定版）

| WP   | 名前                      | サイズ | 内容                                                                                | 状態                      |
| ---- | ------------------------- | ------ | ----------------------------------------------------------------------------------- | ------------------------- |
| WP_0 | スパイク調査              | XS     | 命名・IF 設計、移行マッピング                                                       | ✅ 完了                   |
| WP_1 | Core 4 関数 + スキル 4 件 | M      | `createIssue` 等 4 関数 + スキルスケルトン 4 件                                     | ✅ 完了 (PR #129)         |
| WP_2 | Interface + テストスタブ  | XS     | `IGitHubContext` / `IGitHubOperations` / Domain Model 抽象 IF 定義 + 失敗するテスト | ⏳ 次セッション           |
| WP_3 | Gateway 層修正            | M      | `GitHubOperations` クラス実装 + 既存 4 関数の破壊的変更 + 新規 7 関数追加           | ⏳                        |
| WP_4 | Domain Model 実装         | M      | `Issue` / `Project` / `Milestone` クラス実装                                        | ⏳                        |
| WP_5 | スキルからの呼出し実装    | S      | 既存 4 スキル + 新規 7 スキルを Domain Model 経由に書き換え                         | ⏳                        |
| WP_6 | 11 スキル配備 + SKILL.md  | S      | 全スキルを `.agents/skills/bundles/management-bundle/` に配置 + SKILL.md 整備       | ⏳（旧 WP_2' をリネーム） |

## 6. 設計上の重要決定事項

### 6.1 既存 4 関数の破壊的変更は WP_3 で実施

`createIssue(context, opts, options)` 等のシグネチャ変更は WP_3 で実施。 これにより、WP_1
で動作していたスキル 4 件は WP_3 中は一時的にビルド失敗状態になるが、WP_5 で修復される（git の `WIP`
コミットで管理）。

### 6.2 関数エクスポートの後方互換は WP_3 で確立

既存スキル層 4 件が WP_1 で import していた関数を、WP_3 でも利用可能にする。
`export const createIssue = (context, opts, options) => new GitHubOperations().createIssue(context, opts, options);`
形式で提供。

### 6.3 Domain Model クラスは WP_4 で導入

WP_2 では Domain Model の IF/抽象定義のみ、WP_4 で実クラス実装。 Active Record
パターン採用（エンティティが自身の永続化を持つ）。

### 6.4 スキル層は WP_5 で Domain Model 経由に移行

WP_1 で作成したスキル 4 件は WP_5 で Domain Model（`Issue`, `Project`,
`Milestone`）を使った書き方に変更。 新規 7 スキルも WP_5 で同時に作成。

### 6.5 auth 切替・per-skill JSON Schema は別 PBI

本 PBI（GitHub-PBI-Skills）のスコープ外。`GitHub-Operations-Robust-Layer` として別 PBI で実装。
`AuthenticatedGitHubOperations extends GitHubOperations` の形で OCP 準拠の追加。

## 7. 参照

- **既存実装状況**: `git log --oneline | head -10` で PR #129 を含む WP_1 のマージ履歴を確認
- **既存 IF 仕様**: `.local/spike-report-github-pbi-skills.md`（WP_0 の成果物）
- **設計決定の履歴**:
  [decisions-log.md](/.agents/management/design/decisions-log.md)（**永続化済**。本ドキュメントが採用した
  8 つの設計決定の背景）
- **本 PBI 以前の介入履歴（一時）**:
  `.session/intervention_log.md`（セッション終了時削除。重要な内容は decisions-log.md に永続化済）
- **旧実装計画（一時）**: `.session/implementation_plan.md`（WP_1.5'
  として肥大化していた旧計画、セッション終了時削除）
- **製品ビジョン**: `../VISION.md`
- **バックログ**: `../product-backlog.md`
