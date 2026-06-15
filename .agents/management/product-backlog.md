# プロダクトバックログ

## 推奨スプリントウェイト上限 (Recommended Sprint Weight Cap)

| 推奨スプリントウェイト上限 (Sprint Weight Cap) | 基準スプリント | 策定日     |
| :--------------------------------------------- | :------------- | :--------- |
| **6** (現行)                                   | Sprint 1       | 2026-06-01 |

### スプリント実績推移

| スプリント | 開発PBI数 | 合計ウェイト | 実感サイズ一致 | 備考                                                                                                                                                      |
| :--------- | :-------: | :----------: | :------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sprint 1   |    13     |      —       |     全一致     | ウェイト上限策定前の基盤構築スプリント                                                                                                                    |
| Sprint 2   |     4     |      7       |     全一致     | XS+S+S+S、上限(+1)超過も全完遂                                                                                                                            |
| Sprint 3   |     3     |      6       |    概ね一致    | M+S+XS、上限値での安定的消化を実証                                                                                                                        |
| Sprint 4   |     4     |      7       |    一部乖離    | S+2×XS+M、計画Weight 4に対しレビューPBI含む実績7。規律違反起因で乖離。                                                                                    |
| Sprint 5   |     4     |      8       |    75%一致     | 3/4一致（Sprint-5-Review-Verification が M→XS に乖離）                                                                                                    |
| Sprint 6   |     6     |      8       |     全一致     | 2XS+2S+2XS、全PBIで見積と実感が一致                                                                                                                       |
| Sprint 7   |     5     |      7       |    80%一致     | 4/5一致（Sprint-7-Review-Verification が M→XS に乖離）                                                                                                    |
| Sprint 8   |     5     |      11      |    40%一致     | 2/5一致（Sprint-8-Review-Verification が M→XS に乖離、Project-Setup-Workflow が M→L に乖離、Enforce-Mandatory-Rule-Reading-on-Task-Start が S→XS に乖離） |
| Sprint 9   |     2     |      6       |     全乖離     | 0/2一致（Sprint-9-Review-Verification が M→S に乖離、GitHub-Infrastructure-Setup が M→L に乖離）                                                          |
| Sprint 10  |     3     |      7       |    67%一致     | 2/3一致（Sprint-10-Review-Verification が M→XS に乖離）                                                                                                   |

### 分析と推奨

- Sprint 3 において上限6を計画通り完遂し、PO承認を得た実績が確認された。
- Sprint 2 は上限を1超過したものの、全PBIを完了しており、実質的なキャパシティは6〜7と推定される。
- 現時点では推奨上限を **6 に維持** する。将来の実績（Sprint
  4以降）により動的変動させる。<!-- 動的変動ルール: [backlog-guidelines.md](/.agents/management/backlog-guidelines.md) 2.2.2 参照 -->

## プロダクトゴール

**現在のゴール**:
「AIとの協働ガバナンスをマイクロマネジメントから意思決定マネジメントへ進化させ、POの確認負荷を最小化しつつ品質と規律を維持する仕組みを確立する」。
**策定日**: 2026-06-05

### ゴール変更履歴

| 日付       | ゴール         | 結果   | 理由                                                                                                                        |
| ---------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-05 | 本ゴールを策定 | 開始前 | もう一台のPCでのAI稼働が実現し、Opencode併用で利用枠制限が解消。ローカルLLMの優先度低下に伴い、ガバナンスの進化へ方向転換。 |
| 2026-05-12 | 旧ゴールを終了 | 完了   | アーキテクチャの刷新が完了し、運用実証と機能拡張のフェーズに入ったため。                                                    |

## Sprint 12

<!-- スプリントゴール: GitHub Issues/Projects と連携したPBI管理スキル群（8スキル）を構築し、既存PBIの対話的移行スクリプトと運用設計を整備することで、ローカルMarkdown管理からの脱却を開始する -->

### [TODO] [ManagementFoundation/ProjectGovernance]/Parallel-Run-and-Migration

- **概要**: 既存PBIのGitHub
  Issue移行、並行運用の検証、ローカル管理からGitHub単体運用への完全移行を実施する。既存の
  `product-backlog.md` の内容を対話的に移行するスクリプトを作成する。
- **見積サイズ**: M
- **証明方法**: 全PBIがGitHub Issues上で参照可能であり、既存の `product-backlog.md`
  と情報の一致が確認できること。

#### WP_0: 移行設計・運用フローの検討

- **Effort見積（介入回数）**: 2回
- [ ] AC1: 現行の全運用フロー（sprint-start, session-start, session-end,
      sprint-end）におけるPBI/WP操作を洗い出し、GitHub Issue化後にどう変わるかをAsIs/ToBeで整理する
- [ ] AC2:
      上記の差分分析をもとに、移行手順（移行順序・並列度・判断基準）をPOと合意し設計書に記載する
- [ ] AC3: 移行中の過渡期（一部GitHub・一部ローカル）の運用ルールを定義する
- [ ] AC4: 問題発生時のロールバック手順を定義する
- [ ] AC5: 完全移行の完了条件を明確にする
- **証明方法**: 設計書（AsIs/ToBeマッピングを含む）の実在確認とPOレビュー完了

#### WP_1: 運用手順書・移行ガイド作成

- **Effort見積（介入回数）**: 1回
- [ ] AC1: GitHub運用への移行手順（Issue作成/検索/更新/クローズの日々の操作方法）を文書化する
- [ ] AC2: セッション開始時・終了時のGitHub操作手順を従来のMarkdown手順と対比して記載する
- [ ] AC3: トラブルシューティングセクション（よくあるエラーと対処）を含む
- **証明方法**: 手順書の実在確認＋POレビュー

#### WP_2: Interactive移行スクリプト作成

- **Effort見積（介入回数）**: 2回
- [ ] AC1: スクリプト起動時に移行対象のPBIを1件表示し、POの確認後に `gh issue create`
      を実行する対話モードを持つ
- [ ] AC2: 完了PBI（アーカイブ）はclose状態でIssue作成される
- [ ] AC3: スクリプトは `.harnessrc` の設定（projects, customFields等）を参照して動作する
- [ ] AC4: WP単位の情報（Effort, ACチェックボックス）もIssue bodyに適切に反映される
- **証明方法**: スクリプトの実在確認＋テストパス＋dry-runモードでの動作確認

#### WP_3: 移行データ検証

- **Effort見積（介入回数）**: 1回
- [ ] AC1: 移行済みPBIについて、GitHub Issueの各フィールド（status, size,
      type等）が元のMarkdownと一致することを確認する
- [ ] AC2: WPのAC達成状況がIssueのsub-issuesまたはbodyに正しく反映されていることを確認する
- **証明方法**: サンプルPBIの実機突合確認ログ

#### WP_4: 完全移行

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `product-backlog.md` を削除する
- [ ] AC2: `product-backlog-archive.md` を削除する
- [ ] AC3: 移行完了をREADMEや関係者に通知する仕組みを整える
- **証明方法**: ファイル削除の確認＋PO承認

### [WIP] [ManagementFoundation/ProjectGovernance]/GitHub-PBI-Skills

- **概要**: GitHub Issues/Projects に対するPBI操作スキル群（8スキル）を`gh`
  CLIベースで実装する。PBIの作成・検索・更新・昇格（IDEA→TODO）・スプリント設定・アーカイブ・ベロシティ記録・メトリクスアップロードをカバーする。`labelPrefix`
  は引数で受け取り、互換性レイヤーから呼び出せるIFにする。
- **見積サイズ**: M
- **証明方法**: 全スキルの単体テストがパスすること。gh CLIを用いたE2Eの動作確認が完了していること。

#### WP_0: スパイク調査: スキル構成・命名設計

- **Effort見積（介入回数）**: 1回
- [ ] AC1: 「業務操作（sprint-plan / sprint-archive / velocity-record
      等）」と「CRUD操作（PBI/WPの作成/検索/更新）」の軸を整理し、スキル一覧と責務境界を確定する
- [ ] AC2: 各スキルの命名・引数IF・`labelPrefix` 互換性レイヤーの設計を行う
- [ ] AC3: 既存のMarkdown運用からGitHub操作への移行マッピングを整理する
- **証明方法**: スパイク調査レポートの提出とPOレビュー完了

#### WP_1': Core関数層 + PBI系スキル実装（スパイク結果反映）

- **参照**: [spike-report](/.local/spike-report-github-pbi-skills.md)
- **Effort見積（介入回数）**: 2回
- [ ] AC1: `.agents/core/github.ts` にgh CLIラッパー関数（createIssue, searchIssues, updateIssue,
      closeIssue）を実装する
- [ ] AC2: `.agents/core/label-prefix.ts` に labelPrefix 変換関数を実装する
- [ ] AC3: `.agents/core/schema.ts` に入力バリデーション（JSON Schema参照）を実装する
- [ ] AC4: 全スキルスクリプト（github-pbi-open, github-pbi-search, github-pbi-update,
      github-pbi-commit, github-sprint-init, github-sprint-review-plan, github-pbi-archive,
      github-sprint-velocity-record, github-wp-create, github-wp-search,
      github-wp-update）のスケルトン（CLI引数パース + Core関数呼び出し）を実装する
- [ ] AC5: 各Core関数の単体テストがパスすること
- **証明方法**: スキルファイル実在確認 + `deno task test` パスログ

#### WP_2: Interface 定義 + テストスタブ（GREEN）

- **目的**: 後続 WP（WP_3, WP_4）の実装に先立ち、Interface/抽象クラス契約と
  最小限のテストスタブを確定させる。実装ロジックは含まない（fake it パターン）。
- **参照**: [github-operations-design.md](/.agents/management/design/github-operations-design.md) §
  2, 3, 4
- **Effort見積（介入回数）**: 1回
- [ ] AC1: `.agents/core/github.ts` に `IGitHubContext`（`{ owner, repo }`）と
      `IGitHubOperations`（11 メソッドシグネチャ、`context` 第 1 引数）の Interface が export
      されている
- [ ] AC2: `.agents/core/` に `Issue`, `Project`, `Milestone` の抽象クラス （または interface）が
      export されている
- [ ] AC3: `IGitHubOperations` の 11 メソッドに対する**テストスタブ**
      （`github_test.ts`）が追加され、**すべて GREEN でパス**する
- [ ] AC4: `Issue`, `Project`, `Milestone` の公開メソッド（`create`, `find`, `save`, `close`,
      `addItem` 等）に対する**テストスタブ**が追加され、**すべて GREEN でパス**する
- [ ] AC5: 設計原則遵守の検証用 grep ターゲット（`parent:` 文字列、`replace(/"/g, ...)`、 `--repo`
      フラグ等）が `_test_helpers.ts` 等に定数として定義されている
- [ ] AC6: **既存 JSON Schema 資産との整合性確認**: - [ ]
      `.github/schemas/harnessrc-schema.json`（既存、draft-07）を読み込み、 `customFields` /
      `harness-type.options` の構造を把握 - [ ] `IGitHubContext` 等の新 Interface が既存
      `.harnessrc` のフィールド名 （`customFields.type` → `"harness-type"` 等）と整合することを確認
      - [ ] per-skill JSON Schema（future PBI で実装）の**配置場所と命名規則**を 設計契約 § 3.1
      に従い決定
- **証明方法**: `deno test -A --parallel` で追加したテストが **すべて GREEN でパス**すること + 既存
  `.github/schemas/` との整合性確認ログ

#### WP_3: Gateway 層修正

- **目的**: `IGitHubOperations` を実装する `GitHubOperations` クラスを追加し、 既存 4
  関数の破壊的変更と新規 7 関数の追加を行う。
- **参照**: [github-operations-design.md](/.agents/management/design/github-operations-design.md) §
  4.1
- **Effort見積（介入回数）**: 2回
- [ ] AC1: `GitHubOperations implements IGitHubOperations` クラスが追加されている
- [ ] AC2: 既存 4 関数（`createIssue`, `searchIssues`, `updateIssue`, `closeIssue`）の シグネチャが
      `(context: IGitHubContext, ...)` 形式に変更されている
- [ ] AC3: 新規 7 関数が `context` 第 1 引数で実装されている - `createChildIssue`: sub-issues
      機能（`addSubIssue` GraphQL mutation）使用、 body への `parent: #N` 追記禁止、戻り値
      `{ number, url, parentLinked: boolean }` - `addLabels`, `addToProject`, `getProjectFields`,
      `setProjectField`, `createMilestone`（`-F` GraphQL）, `listMilestones`
- [ ] AC4: 関数エクスポート（`createIssue(context, opts, options?)` 形式）の
      後方互換性が維持されている
- [ ] AC5: WP_2 で追加した 11 テストスタブが **すべて GREEN でパス**する
- [ ] AC6: スキル層 4 件（`github-pbi-open` 等）の `--repo` dead parameter バグが修正され、
      `context: IGitHubContext` として Core 関数に伝播している
- [ ] AC7: スキル層 4 件の deno check が型整合性 OK
- [ ] AC8: `createChildIssue` の body に `parent:` 文字列が**存在しない**こと（grep）
- [ ] AC9: `createMilestone` の実装に `replace(/"/g, ...)` 文字列エスケープが
      **存在しない**こと（grep）
- [ ] AC10: 11 関数の gh 呼び出しに `--repo ${context.owner}/${context.repo}`
      が付与されている（grep）
- [ ] AC11: auth/schema 関連ロジックが一切混入していないこと（future PBI 領域の保護）
- **証明方法**: `deno task qa` 全件クリア + 設計原則遵守の grep 確認

#### WP_4: Domain Model 実装

- **目的**: `Issue`, `Project`, `Milestone` の具象クラスを実装する。Gateway 層を
  内部利用し、エンティティのライフサイクル管理とドメインロジックを提供する。
- **参照**: [github-operations-design.md](/.agents/management/design/github-operations-design.md) §
  4.2
- **Effort見積（介入回数）**: 2回
- [ ] AC1: `Issue` クラスが実装されている - 静的ファクトリ: `create(context, params)`,
      `find(context, number)`, `list(context, filter?)` - インスタンスメソッド: `addLabel`,
      `removeLabel`, `save`, `close`, `createChild`
- [ ] AC2: `Project` クラスが実装されている - 静的ファクトリ: `find(context, id)` -
      インスタンスメソッド: `addItem(issue)`, `getFields()`, `setField(itemId, field, value)`
- [ ] AC3: `Milestone` クラスが実装されている - 静的ファクトリ: `create(context, params)`,
      `list(context)`
- [ ] AC4: 各クラスは内部で `GitHubOperations`（WP_3 で実装）を使用
- [ ] AC5: WP_2 で追加した Domain Model テストスタブが **すべて GREEN でパス**する
- [ ] AC6: `deno task qa` 全件クリア
- **証明方法**: `deno task qa` 全件クリア

#### WP_5: スキルからの呼出し実装

- **目的**: 既存 4 スキルを Domain Model 経由のコードに書き換え、新規 7 スキルも Domain Model
  経由で作成する。
- **参照**: [github-operations-design.md](/.agents/management/design/github-operations-design.md) §
  4.3
- **Effort見積（介入回数）**: 1回
- [ ] AC1: 既存 4 スキル（`github-pbi-open`, `github-pbi-search`, `github-pbi-update`,
      `github-pbi-commit`）が Domain Model（`Issue` クラス）を使う形に書き換えられている
- [ ] AC2: 新規 7 スキルが Domain Model 経由で作成されている - WP系: `github-wp-create`,
      `github-wp-search`, `github-wp-update` - Sprint系: `github-sprint-init`,
      `github-sprint-review-plan`, `github-pbi-archive`, `github-sprint-velocity-record`
- [ ] AC3: スキル層 4 件のスモークテストが追加されている
- [ ] AC4: `--repo` 形式不正（`/` を含まない等）時に明確なエラーメッセージが出力される
- [ ] AC5: スキル層 11 件すべてで `deno check` 型整合性 OK
- [ ] AC6: `deno task qa` 全件クリア
- **証明方法**: `deno task qa` 全件クリア + スキル実行の動作確認

#### WP_6: 11 スキル配備 + SKILL.md（旧 WP_2' をリネーム）

- **Effort見積（介入回数）**: 1回
- [ ] AC1: 全 11 スキルを `.agents/skills/bundles/management-bundle/` に配置する
- [ ] AC2: 各スキルに SKILL.md（Quick-Start + 詳細手順）を整備する
- [ ] AC3: `deno task qa` が全テストパスする（回帰なし）
- **証明方法**: スキルファイル実在確認 + `deno task qa` パスログ

> **注**: 本 WP は旧 `WP_2'` をリネームしたもの。PO 介入 #7 により番号を整理。

## 将来のバックログ

### [TODO] [ManagementFoundation/ProjectGovernance]/GitHub-Operations-Robust-Layer

- **概要**: WP_2〜WP_5 で導入した Interface 階層の上に、`AuthenticatedGitHubOperations`
  クラスを追加。`gh auth switch`/login 誘導、per-skill JSON Schema 検証、 Projects V2 cross-repo
  check を提供。`AuthenticatedGitHubOperations extends
  GitHubOperations` として OCP/LSP
  準拠の追加。
- **参照**: [github-operations-design.md](/.agents/management/design/github-operations-design.md) §
  3
- **見積サイズ**: L
- **証明方法**: `AuthenticatedGitHubOperations` クラスが実装され、全テストが成功すること。

#### WP_1: `AuthenticatedGitHubOperations` 実装

- **Effort見積（介入回数）**: 2回
- [ ] `AuthenticatedGitHubOperations extends GitHubOperations` クラス追加
- [ ] `ensureAuth(context)` メソッド実装（`gh auth status` → `gh auth switch` → `gh auth login`
      誘導）
- [ ] 11 メソッドすべてに `ensureAuth` 呼び出しを override で追加
- [ ] `validatePayload(schema, payload)` メソッド実装（`@cfworker/json-schema` 利用）

#### WP_2: スキル層への適用

- **Effort見積（介入回数）**: 1回
- [ ] 既存スキル 4 件 + 新規スキル 7 件を `new AuthenticatedGitHubOperations()` 経由に変更
- [ ] per-skill JSON Schema 定義（例: `github-pbi-open-payload.schema.json`）
- [ ] stdin パース直後に schema 検証、不一致ならエラー

#### WP_3: Projects V2 cross-repo check

- **Effort見積（介入回数）**: 1回
- [ ] `AuthenticatedGitHubOperations.addToProject` で対象 Issue の `context.repo` 所属を検証
- [ ] クロス repo 紐付け試行時にエラーを返す

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Robust-Automation-Refactoring

- **概要**: `proposal_for_skill_writers.md` に基づき、既存の主要スクリプトのリファクタリング（stdin
  の衝突排除、優先度の明示など）を行う。
- **見積サイズ**: L
- **証明方法**: リファクタリング後の全テスト成功。

#### WP_1: stdin競合排除

- **Effort見積（介入回数）**: 2回
- [ ] stdin の競合リスクがあるスクリプトが別ストリーム等を利用するよう修正されている。

#### WP_2: 優先度明示

- **Effort見積（介入回数）**: 1回
- [ ] 制限（優先度）が明示されている。

#### WP_3: record_velocity.ts テーブル行挿入位置の修正

- **Effort見積（介入回数）**: 1回
- [ ] `updateBacklogFile()` が `product-backlog.md`
      の「スプリント実績推移」テーブルの正しい位置に行を挿入できること（ヘッダー行マッチ後のテーブル内追記）
- [ ] 結合テストまたは手動検証により、テーブル末尾ではなく適切な行の間に挿入されることを確認する
- [ ] `deno task qa` が全テストパスすること（回帰なし）

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Skill-Template-Governance

- **概要**: 全SKILL.mdのテンプレート構造を統一し、品質基準とガードレールを強化する。Out of
  Scopeセクション追加、Quick-Start統一、gitignore確認制約の追加を一括実施する。
- **見積サイズ**: M
- **証明方法**:
  全SKILL.mdにQSが存在しQS<詳細手順であることのテストパス、およびgitignore制約がルールに反映されていることの確認。

#### WP_1: session-planning Out of Scope セクション追加

- **Effort見積（介入回数）**: 1回
- [ ] `session-planning/assets/implementation_plan_template.md` に「## このスキルがやらないこと（Out
      of Scope）」セクションを追加する
- [ ] 既存の `session-planning` スキル説明に、本セクションの記入ガイドラインを追記する

#### WP_2: 既存計画のOut of Scope棚卸し

- **Effort見積（介入回数）**: 1回
- [ ] 既存の implementation_plan.md に Out of Scope
      セクションがなくとも問題ないことを確認する（後方互換性）
- [ ] `deno task qa` が全テストパスすることを確認する

#### WP_3: Quick-Start追加（references/有・QS欠落スキル）

- **Effort見積（介入回数）**: 2回
- [ ] 以下のスキルに Quick-Start セクションを追加する: - `ac-checkpoint-implementation`,
      `quality-verification`, `refactoring-loop`, `archive-backlog`, `define-acceptance-criteria`,
      `record-session-metrics`, `reconfirm-context`, `skill-optimizer`, `stateless-reset`,
      `attach-harness-to-project`, `check-harness-configs`, `manage-git-identity`,
      `publish-harness-rules`, `publish-harness-skills`, `setup-harness-env`

#### WP_4: 冗長QS修正と分割

- **Effort見積（介入回数）**: 1回
- [ ] `sprint-retrospective-kpt/SKILL.md` の Quick-Start を最短経路に削減する
- [ ] `evaluate-sprint-metrics/SKILL.md` の Quick-Start を最短経路に削減する
- [ ] `hybrid-triage-commit/SKILL.md` の「Quick-Start & モード別詳細手順」を Quick-Start
      と詳細手順に分割する

#### WP_5: QSフォーマット検証テスト追加

- **Effort見積（介入回数）**: 1回
- [ ] 全 SKILL.md に Quick-Start セクションが存在すること（references/
      がない単純スキルは除外）を検証するテストを作成する
- [ ] Quick-Start の行数が詳細手順の行数より少ないことを検証するテストを作成する
- [ ] `deno task qa` が全テストパスすることを確認する

#### WP_6: version-control-specialist gitignore確認制約追加

- **Effort見積（介入回数）**: 1回
- [ ] [`version-control-specialist.md`](/.agents/rules/version-control-specialist.md)
      の制約セクションに「コミット対象ファイルの最終決定前に必ず `.gitignore`
      を参照し、管理対象外（git ls-files
      で認識されない）ファイルが含まれていないか検証すること。追跡対象外ファイルほどリカバリーが困難なため、特に慎重に扱うこと」を追記する
- [ ] `deno task qa` がエラーなく通過すること

#### WP_7: session-planning SKILL.md git追跡確認ステップ追加

- **Effort見積（介入回数）**: 1回
- [ ] [`session-planning/SKILL.md`](/.agents/skills/bundles/management-bundle/session-planning/SKILL.md)
      の「4. 実装計画の作成」手順内に、「編集対象ファイルおよび生成される成果物が git
      管理対象か（`.gitignore`
      の対象外か）を確認し、管理対象外のファイルはコミット対象として列挙しないこと」を追加する
- [ ] `deno task qa` がエラーなく通過すること

#### WP_8: hybrid-triage-commit スキルの履歴保護トリガー追加

- **Effort見積（介入回数）**: 1回
- [ ] `hybrid-triage-commit/SKILL.md` の tags/trigger に `protect-history`,
      `preserve-atomic-commits` を追加し、アトミックコミットの履歴保護を明示的にトリガー可能にする

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Ai-Generated-Script-Audit-and-Testing

- **概要**: [P2/P3課題]
  これまでAI任せによって作られた、人間が挙動を把握しきれていないスクリプトやユーティリティコードに対して、境界値や異常系（ネットワークエラー、ファイルオープン失敗時の中断クリーンアップ等）を網羅するユニットテストを整備し、コードの挙動を人間が担保・理解できるようにする。
  併せて、Markdown設定ファイルのパース時にスキーマ構造をバリデーションする機能を実装し、設定エラーをランタイム前に検知する仕組みを構築する。
- **見積サイズ**: L
- **証明方法**: カバレッジ結果が80%以上であること。加えて `deno task validate-config` の実行成功。

#### WP_1: コアモジュールのテスト整備

- **Effort見積（介入回数）**: 3回
- [ ] `.agents/core/` の各モジュール（特に `command.ts`, `fs.ts`,
      `markdown.ts`）内の関数に対する網羅的なユニットテストファイルを作成する。
- [ ] `fs.ts` の `downloadFile`
      において、ダウンロード中に中断された場合に一時ファイルを安全にクリーンアップする処理のテストと実装を確認する。
- [ ] コアモジュールのユニットテスト全体のカバー率を 80%
      以上に引き上げ、カバレッジ結果を出力可能にする。

#### WP_2: バリデーションルール定義

- **Effort見積（介入回数）**: 1回
- [ ] `markdown.ts`
      または独立したバリデータモジュールに、パース結果のMarkdownオブジェクトに対して構造と記述形式を検証するバリデーションルールを定義する。
- [ ] 設定エラーを検知した際、詳細な原因箇所を示すログを出力してプロセスを安全に中断させる機能を実装する。

#### WP_3: 検証タスク作成

- **Effort見積（介入回数）**: 1回
- [ ] `deno task validate-config` タスクを追加し、事前に設定の妥当性を一括チェックできるようにする。

### [TODO] [NextGenAIIntegration/ParallelAgentOrchestration]/Orchestrator-Workers-Proto

- **概要**: Orchestrator-Workers パターン (`pm-planner`) の実装。Antigravity の Agent Manager
  のネイティブ機能を調査し、効率的な並列実行アーキテクチャを設計する。
- **見積サイズ**: XL
- **証明方法**: 調査報告書と設計ドキュメント。

#### WP_1: 技術調査

- **Effort見積（介入回数）**: 2回
- [ ] Antigravity の Agent Manager の並列実行・オーケストレーション機能の調査が完了している。

#### WP_2: 設計

- **Effort見積（介入回数）**: 2回
- [ ] ユーザー要求を XML 等のタスクリストに分割する Orchestrator プロンプトが設計されている。

### [TODO] [InfrastructureReliability/OnboardingVerification]/Publish-Global-Workflows

- **概要**: `publish-harness-skills`
  と同様に、ワークスペース内のワークフローをグローバルディレクトリへ同期・配布する機能を実装する。これにより、他プロジェクトや他環境でも共通のワークフロー（例：今回作成した
  `/kickoff` 等）を即座に利用可能にする。
- **見積サイズ**: M
- **証明方法**: 正常同期の検証（ユニット/インテグレーションテスト）。

#### WP_1: 技術調査

- **Effort見積（介入回数）**: 1回
- [ ] グローバルワークフローの配置場所、同期方法、および既存のスキル同期機構との統合可否の調査。

#### WP_2: ソースコード作成

- **Effort見積（介入回数）**: 2回
- [ ] ワークフローファイルをグローバルディレクトリへ安全にコピー/同期するスクリプトの実装。

#### WP_3: スキル作成

- **Effort見積（介入回数）**: 1回
- [ ] ユーザーが簡単に実行できる `publish-harness-workflows` スキルの作成。

#### WP_4: テスト検証

- **Effort見積（介入回数）**: 1回
- [ ] 正常に同期が行われ、他プロジェクトから参照可能になることの検証（ユニット/インテグレーションテスト）。

### [TODO] [InfrastructureReliability/HarnessMultiPlatform]/Support-Opencode-Platform

- **概要**: ハーネス配信パイプライン（`publish-rules` / `publish-skills`）を Antigravity 専任から
  Opencode 対応に拡張する。`--platform` フラグによる出力先・テンプレートの分岐、Opencode
  用グローバルプロンプト（`~/.config/opencode/AGENTS.md`）の生成、ターゲットプロジェクトへの
  `opencode.json` の自動生成、およびテンプレート内の Antigravity 固有参照の除去を行う。
- **見積サイズ**: M
- **証明方法**: `--platform opencode` 実行後のターゲットディレクトリ内容検証。

#### WP_1: publish-rules.ts への --platform フラグ追加

- **Effort見積（介入回数）**: 2回
- [ ] `publish-rules.ts` に `--platform` 引数（`antigravity` / `opencode`）を追加する。デフォルトは
      `antigravity` とし後方互換性を維持する。
- [ ] `syncGlobalPrompt()` 関数内でプラットフォーム分岐し、Opencode 時は
      `~/.config/opencode/AGENTS.md` を出力先とする。
- [ ] Opencode 用テンプレート（`OPENCODE_AGENTS.md.template`）を新規作成し、`GEMINI.md.template`
      内の Antigravity 固有参照（`task.md`, `implementation_plan.md` 等）を Opencode
      相当（`AGENTS.md`, `.session/` 等）に置き換える。

#### WP_2: opencode.json 自動生成

- **Effort見積（介入回数）**: 1回
- [ ] `--platform opencode` 時に、ターゲットプロジェクトに `opencode.json`
      を生成し、`.agents/rules/*.md` を `instructions` フィールドで参照する設定を書き込む。

#### WP_3: AGENTS.md.template 新規作成

- **Effort見積（介入回数）**: 1回
- [ ] `GEMINI.md.template` をベースに、Opencode 用の `AGENTS.md.template` を新規作成する
- [ ] Antigravity 固有のアーティファクト名（`task.md`, `implementation_plan.md` 等）を Opencode
      相当（`AGENTS.md`, `.session/` 等）に置き換える

#### WP_4: オンボーディングワークフローの分岐

- **Effort見積（介入回数）**: 1回
- [ ] `onboard-new-member.md`
      のステップ6（ルール・スキルの同期）に、ターゲットプラットフォーム（Antigravity /
      Opencode）の選択と、それに応じた `--platform` フラグの受け渡し手順を追記する。

#### WP_5: stateless-reset の Opencode 対応

- **Effort見積（介入回数）**: 1回
- [ ] `reset.ts` に `--platform` フラグを追加し、Opencode時は `~/.config/opencode/` 配下の session
      関連キャッシュを退避対象とする
- [ ] Antigravity 時は既存の `~/.gemini/antigravity/{brain,knowledge,conversations}`
      を退避、Opencode 時は `.session/` 配下のアーティファクトを退避する分岐ロジックを実装する
- [ ] `deno task qa` がエラーなく通過することを確認する

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Adapt-HITL-For-Opencode-Phase-Boundary

- **概要**: Opencode への移行に伴い、現在の「各ステップの都度確認（`<!-- STOP -->`
  方式）」から「フェーズ境界のみの確認」へHITL（Human In The Loop）の方式を変更する。Opencode の
  permission
  system（`allow/ask/deny`）を用いて信頼できるサブエージェントは自律実行させ、人間は意思決定と承認に集中できるワークフローへ移行する。
- **見積サイズ**: M
- **証明方法**:
  改訂後のワークフローで「都度停止」がなくなり、フェーズ単位の承認で動作することのデモ検証。

#### WP_0: PO教育と概念理解

- **Effort見積（介入回数）**: 1回
- [ ] Opencode の Agent / Subagent / Task tool
      の動作モデルを、実際のデモ（簡単なサブエージェントを作成して呼び出す）を通じて PO
      が体験し、理解する。
- [ ] Opencode の permission system の 3 値（allow / ask /
      deny）と、それが「どのツール操作を」「どのタイミングで」人間の承認を必要とするかの対応を PO
      が説明できるようになる。
- [ ] 現在の `<!-- STOP -->`
      方式から「フェーズ境界のみ確認」方式への移行で、人間の役割が「マイクロマネージャ」から「意思決定者」に変わることを
      PO が納得する。

#### WP_1: 全ワークフローの棚卸しとHITL境界設計

- **Effort見積（介入回数）**: 2回
- [ ] 既存の全ワークフロー（`onboard-new-member.md`, `kickoff.md`, `session-start.md` 等）の各
      `<!-- STOP -->`
      箇所を洗い出し、「これはフェーズ境界として残すべきものか、サブエージェントに委譲して良いものか」を分類する。
- [ ] 分類結果を基に、全ワークフローの「フェーズ境界」を定義した HITL
      設計書を作成する（どのサブエージェントがどの権限で自律実行し、どのタイミングで人間の承認を必要とするか）。

#### WP_2: ルールファイルのサブエージェント化

- **Effort見積（介入回数）**: 2回
- [ ] 各ルールファイル（`consultant.md`, `developer.md`, `tester.md` 等）を `.opencode/agents/*.md`
      形式のサブエージェント定義に変換する。各エージェントには適切な `description`, `permission`,
      `mode: subagent` を設定する。
- [ ] 変換後、`@consultant` 等のメンションで適切に呼び出せることを確認する。

#### WP_3: ワークフローの段階的移行

- **Effort見積（介入回数）**: 2回
- [ ] 1つのワークフロー（例: `onboard-new-member.md`）を選び、Opencode の Task tool + permission
      system を使った「フェーズ境界確認」方式に書き換える。
- [ ] 書き換えたワークフローで実際にオンボーディングを流し、意図通り動作すること、および「都度停止」がなくても品質が維持されることを
      PO と共に検証する。
- [ ] 検証結果を踏まえ、残りのワークフローにも同様の改訂を適用する計画を確定する。

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Validate-Metrics-Id-Format-In-Record-Script

- **概要**: `record-session-metrics` の `record.ts` において、`--epic` / `--feature` / `--pbi`
  に指定された値が実在するPBIのIDと一致しない場合に警告を出力するバリデーション機能を追加する。
  `product-backlog.md` および `product-backlog-archive.md` に定義されたPBI識別子との突合により、
  短縮コードや存在しないIDの混入を防止する。
- **見積サイズ**: S
- **証明方法**: 存在しないIDを指定した際に警告が表示されることの確認ログ。

#### WP_1: ID一覧の構築

- **Effort見積（介入回数）**: 1回
- [ ] `product-backlog.md` および `product-backlog-archive.md` から有効な
      `[EpicID/FeatureID]/PBIName` の一覧をパースするユーティリティ関数を作成する。

#### WP_2: バリデーションロジックの追加

- **Effort見積（介入回数）**: 1回
- [ ] `record.ts` のCLI実行時に、入力された `--epic` / `--feature` / `--pbi`
      が既存のID一覧と一致するか検証し、不一致の場合は警告メッセージ（WARNING）を標準エラー出力に表示する。
      バリデーションの失敗で処理を停止はせず、記録は継続する（後方互換性のため）。

### [TODO] [InfrastructureReliability/OnboardingVerification]/Define-Core-Distribution-Strategy

- **概要**: `publish-harness-skills` は `.agents/skills/bundles/`
  のみを同期し、`publish-harness-rules` は `.agents/rules/` のみを配布する。しかし
  `.agents/core/`（共通基盤スクリプト群）はどの配布機構の対象外であり、他プロジェクトにハーネス全体（rules +
  skills + core）を適用する目的が果たせない。core の配布方針を決定し、既存の publish
  スキル群に統合するか、新たな仕組みを導入する。
- **見積サイズ**: M
- **証明方法**: `publish-rules` または `publish-skills` の拡張により、対象プロジェクトに
  `.agents/core/` が同期され、hook 等の core 依存スクリプトが正常動作することの確認。

#### WP_1: core配布方針の選定

- **Effort見積（介入回数）**: 1回
- [ ] 以下の選択肢から方針を決定する:
  - A) `publish-harness-rules` に `.agents/core/` の同期機能を統合する
  - B) `publish-harness-skills` に `.agents/core/` の同期機能を統合する
  - C) 独立した `publish-harness-core` スキルを新設する
  - D) 全プロジェクトで `.agents/core/` を Git submodule として管理する

#### WP_2: 選定方針の実装

- **Effort見積（介入回数）**: 2回
- [ ] 選定された方針に基づき、配布スクリプトを実装・改修する。
- [ ] `deno task qa` がエラーなく通過することを確認する。

#### WP_3: 検証

- **Effort見積（介入回数）**: 1回
- [ ] 他プロジェクト（またはサンドボックス）に対してハーネス全体の適用を試行し、hook 等の core
      依存スクリプトが正常に動作することを実機検証する。

### [TODO] [RobustSkillArchitecture/SkillGovernance]/Refactor-Record-Velocity-To-Reuse-Core-Utilities

- **概要**: `record_velocity.ts` が現在自己完結型で実装されており、`core/constants.ts` の
  `WEIGHT_MAP` や `core/backlog-schema.ts` の Markdownパース関数（`extractPbiBlock`
  等）を利用していない。これらの共通ユーティリティを参照するようリファクタリングし、定義の重複と将来の修正漏れリスクを解消する。
- **見積サイズ**: S
- **証明方法**: リファクタリング後、`deno task qa` が全テストパスし、かつ `record_velocity.ts` の
  import に `.agents/core/` からの参照が含まれていることの確認。

#### WP_1: Core共通ユーティリティへの移行

- **Effort見積（介入回数）**: 1回
- [ ] `record_velocity.ts` 内の `WEIGHT_MAP` を `core/constants.ts` の定義に置き換える
- [ ] `extractPbiBlocksForSprint` / `extractSize` / `extractPbiId` のパース処理を
      `core/backlog-schema.ts` の既存関数で代替する
- [ ] `buildTableRow` / `updateBacklogFile` のテーブル操作を共通化可能な場合は Core に移行する
- [ ] `deno task qa` が全テストパスすることを確認する

#### WP_2: 事前チェック安全弁の追加

- **Effort見積（介入回数）**: 1回
- [ ] `record_velocity.ts` の実行前に `product-backlog-archive.md`
      に対象スプリントのPBIが存在することを検証するプリチェックを追加する
- [ ] 該当PBIが0件の場合、エラーにせずスキップして正常終了する
- [ ] `deno task qa` が全テストパスすることを確認する

### [TODO] [ManagementFoundation/ProjectGovernance]/GitHub-WP-Skills

- **概要**: WP操作スキル群（3スキル）と既存プロジェクト対応（競合検出・モード切替・harness
  attach統合）を実装する。WPの作成・更新・検索に加え、既存GitHubプロジェクトへのハーネス適用を安全に行う仕組みを含む。
- **見積サイズ**: M
- **証明方法**: 全スキルの単体テストがパスすること。gh
  CLIを用いたE2Eの動作確認が完了していること。`--mode=merge`
  で既存プロジェクトに適用可能であること。

#### WP_1: WP操作スキル実装

- **Effort見積（介入回数）**: 1回
- [ ] `github-wp-create` スキル（親PBIリンク必須、存在検証付き）を実装する
- [ ] `github-wp-update` スキル（WP個別ステータス更新）を実装する
- [ ] `github-wp-search` スキル（親PBIに紐づくWP一覧取得）を実装する

#### WP_2: 既存プロジェクト対応

- **Effort見積（介入回数）**: 2回
- [ ] 競合検出・警告機能（Issue Template/Labels/Projects V2の既存構造検出）を実装する
- [ ] `--mode=new/merge/replace` の3モード判定ロジックを実装する
- [ ] GitHub-PBI-Skills の全スキルに `labelPrefix` を透過的に渡す互換性レイヤーを実装する

#### WP_3: スキル配備とharness attach統合

- **Effort見積（介入回数）**: 1回
- [ ] 全スキルを `.agents/skills/bundles/management-bundle/` に配置する
- [ ] 各スキルに SKILL.md を記述し、Quick-Startと詳細手順を整備する
- [ ] `harness attach` コマンドにモード選択フローを統合する
- [ ] `deno task qa` が全テストパスすることを確認する

### [TODO] [ManagementFoundation/ProjectGovernance]/Workflow-Skill-Swap

- **概要**: 全ワークフロースキル（sprint-start, sprint-end, session-start,
  session-end）のバックエンドをローカルMarkdown操作からGitHub Issues/Projects操作に切り替える。
- **見積サイズ**: M
- **証明方法**: 切替後のワークフローで実際にPBI作成・更新・検索がGitHub上で行われることのE2E確認。

#### WP_1: `/sprint-start` ワークフローのGitHub対応

- **Effort見積（介入回数）**: 2回
- [ ] Phase 1 のバックログ検索・マイルストーン設定を `github-backlog-search` + `github-sprint-plan`
      に置き換える
- [ ] Phase 2 のWP作成・IDEA→TODO昇格を `github-wp-create` + `github-backlog-promote` に置き換える

#### WP_2: `/sprint-end` / `/session-start` / `/session-end` のGitHub対応

- **Effort見積（介入回数）**: 2回
- [ ] `/sprint-end` のアーカイブ・ベロシティ記録を `github-sprint-archive` +
      `github-velocity-record` に置き換える
- [ ] `/session-start` のPBI検索・ステータス変更を `github-backlog-search` + `github-backlog-update`
      に置き換える
- [ ] `/session-end` のWP・PBIステータス更新を `github-wp-update` + `github-backlog-update`
      に置き換える

#### WP_3: 後方互換性の担保

- **Effort見積（介入回数）**: 1回
- [ ] ローカルMarkdownモードとGitHubモードを切替可能にする設定（`.harnessrc` の `github.enabled`
      フラグ）を実装する
- [ ] 切替テストを行い、ローカルモードに戻しても既存の全テストがパスすることを確認する
