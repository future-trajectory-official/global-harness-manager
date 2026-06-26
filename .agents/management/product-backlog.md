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
| Sprint 12  |     2     |      5       |     全乖離     | 0/2一致（Parallel-Run-and-Migration が M→XL に乖離、Sprint-12-Review-Verification が S→XS に乖離）                                                        |
| Sprint 13  |     2     |      7       |     全一致     | 全一致                                                                                                                                                    |
| Sprint 14  |     2     |      4       |     全一致     | 全一致                                                                                                                                                    |

### 分析と推奨

- Sprint 3 において上限6を計画通り完遂し、PO承認を得た実績が確認された。
- Sprint 2 は上限を1超過したものの、全PBIを完了しており、実質的なキャパシティは6〜7と推定される。
- 現時点では推奨上限を **6 に維持** する。将来の実績（Sprint
  4以降）により動的変動させる。<!-- 動的変動ルール: [backlog-guidelines.md](/guides/backlog-guidelines.md) 2.2.2 参照 -->

## プロダクトゴール

**現在のゴール**:
「AIとの協働ガバナンスをマイクロマネジメントから意思決定マネジメントへ進化させ、POの確認負荷を最小化しつつ品質と規律を維持する仕組みを確立する」。
**策定日**: 2026-06-05

### ゴール変更履歴

| 日付       | ゴール         | 結果   | 理由                                                                                                                        |
| ---------- | -------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| 2026-06-05 | 本ゴールを策定 | 開始前 | もう一台のPCでのAI稼働が実現し、Opencode併用で利用枠制限が解消。ローカルLLMの優先度低下に伴い、ガバナンスの進化へ方向転換。 |
| 2026-05-12 | 旧ゴールを終了 | 完了   | アーキテクチャの刷新が完了し、運用実証と機能拡張のフェーズに入ったため。                                                    |

## Sprint 15

**スプリントゴール**:
Domain層（ビジネスロジック層）の全UseCaseインターフェースと実装を確立し、3層アーキテクチャの中核を完成させる。

### [WIP] [ManagementFoundation/ProjectGovernance]/Build-Domain-Layer

- **概要**: 3層アーキテクチャの中核であるDomain層（ビジネスロジック層）を実装する。Architecture
  Design (L3) 第3章に基づき、全型定義（§3.4）、9
  UseCaseインターフェース（§3.2）、UseCase実装（バリデーション・計画生成）、およびPort定義（PlanGateway,
  ConfigGatewayのインターフェース）を外部依存ゼロのPure Logicとして実装する。
- **根拠**: Architecture Design (L3) §2.3 DIPに基づき、Domain層が最優先
- **見積サイズ**: L
- **証明方法**: 全UseCaseの単体テストが成功し、`deno task qa` がエラーなく通過すること。

#### WP_1: 共通型・基底型の実装

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `Identifier`, `SearchCondition`, `Plan`, `Step`, `ExecutionResult`
      等の基底型が実装されている
- [ ] AC2: `Size`, `SizeVariance`, `EffortRecord` 等の値オブジェクトが実装されている
- [ ] AC3: `DomainError`, `DomainErrorCode`, `ChangeReason` 等のエラー型が実装されている
- [ ] AC4: 全型が外部依存（GitHub API型等）に一切依存していない
- [ ] AC5:
      値オブジェクトが不変（readonly/immutable）であり、空文字・負数・null等の異常値に対するバリデーションと適切なDomainError送出が単体テストで確認されている
- [ ] AC6: 全型定義にJSDoc/TSDocコメントが付与され、各プロパティとその制約が明記されている
- [ ] AC7: 単体テストが作成されパスすること

#### WP_2: VisionUseCase / ProductGoalUseCase / SprintUseCase

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `VisionUseCase` インターフェースと実装が定義されている（establish, pivot, find）
- [ ] AC2: `ProductGoalUseCase` インターフェースと実装が定義されている（set, pivot, find）
- [ ] AC3: `SprintUseCase` インターフェースと実装が定義されている（start, end, setGoal, setDueDate,
      find）
- [ ] AC4: 各UseCaseは単一責任の原則（SRP）を満たし、1クラスが1つの関心事のみを扱う
- [ ] AC5: UseCase間の循環依存（eg. VisionUseCase → SprintUseCase → VisionUseCase）が存在しない
- [ ] AC6:
      全publicメソッドにTSDocコメントがあり、入力パラメータ・戻り値・スローするエラーの意味が説明されている
- [ ] AC7: 各UseCaseがバリデーションとPlan生成を正しく行う単体テストが作成されている
- [ ] AC8: 存在しないIDでの検索、空の結果セットなど異常系の単体テストが含まれている

#### WP_3: EpicUseCase / FeatureUseCase

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `EpicUseCase` インターフェースと実装が定義されている（define, revise, find, search）
- [ ] AC2: `FeatureUseCase` インターフェースと実装が定義されている（define, revise, assignToEpic,
      unassignFromEpic, find, search）
- [ ] AC3:
      EpicUseCaseとFeatureUseCaseの責務が明確に分離されており、FeatureUseCaseがEpicの生成・削除を行わない
- [ ] AC4: 全publicメソッドにTSDocコメントが付与されている
- [ ] AC5: 各UseCaseがバリデーションとPlan生成を正しく行う単体テストが作成されている
- [ ] AC6: 存在しないEpicへのFeature割り当てなど、依存関係違反のエッジケースがテストされている

#### WP_4: ProductBacklogItemUseCase

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `ProductBacklogItemUseCase` インターフェースと実装が定義されている（propose, revise,
      commit, start, complete, archive, defineAcceptanceCriteria, assignToFeature,
      unassignFromFeature, estimateSize, confirmSize, recordAnalysis, find, search）
- [ ] AC2: 状態遷移バリデーション（例:
      完了済みPBIの再着手禁止、未commit状態でのstart禁止など全禁止遷移の網羅）が実装されている
- [ ] AC3: commit時に子WPのスプリントも同時設定するロジックが実装されている
- [ ] AC4:
      状態遷移ロジックが一箇所に集約され（Stateパターンまたはテーブル駆動）、メソッド内のサイクロマティック複雑度が許容範囲内である
- [ ] AC5: PBI状態遷移図または遷移テーブルがTSDoc/コメントとして記述されている
- [ ] AC6: 全状態遷移の正常系・全禁止遷移の異常系の単体テストが作成されパスすること

#### WP_5: WorkPackageUseCase

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `WorkPackageUseCase` インターフェースと実装が定義されている（define, revise, start,
      complete, archive, assignToProductBacklogItem, unassignFromProductBacklogItem,
      estimateInitialEffort, estimatePlannedEffort, recordActualEffort, recordAnalysis,
      recordSessionMetrics, find, search）
- [ ] AC2: 全ての子WP完了を検出して親PBI昇格をPlanに含めるロジックが実装されている
- [ ] AC3: 親PBI昇格検出ロジックがWP_4の状態遷移と循環依存を起こしていない
- [ ] AC4: WP昇格ルール（全子WP完了→親PBIのcomplete）がコメントとして明記されている
- [ ] AC5: 単体テストが作成されパスすること
- [ ] AC6: 一部の子WPだけ完了した状態で親PBI昇格が発動しないことのテストが含まれている

#### WP_6: ReviewUseCase / RetrospectiveUseCase

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `ReviewUseCase` インターフェースと実装が定義されている（plan, revise, report, archive,
      find, search）
- [ ] AC2: `RetrospectiveUseCase` インターフェースと実装が定義されている（plan, execute, archive,
      find, search）
- [ ] AC3:
      ReviewUseCaseとRetrospectiveUseCaseが相互依存していない（独立した関心事として扱われている）
- [ ] AC4: 各メソッドのTSDocに典型的な使用例（@example）が含まれている
- [ ] AC5: 単体テストが作成されパスすること

#### WP_7: Port定義（PlanGateway / ConfigGateway）

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `PlanGateway` インターフェースが定義されている（execute: Plan → ExecutionResult）
- [ ] AC2: `ConfigGateway` インターフェースが定義されている（readConfig, writeConfig, listBoards,
      createBoard）
- [ ] AC3: 両インターフェースがGateway層の技術詳細（gh CLI等）に一切依存していない
- [ ] AC4: インターフェース分離の原則（ISP）を満たし、1インターフェースが過剰な責務を持たない
- [ ] AC5: 各メソッドの契約（事前条件・事後条件・例外）がTSDocとして文書化されている

### [TODO] [SprintReview]/Sprint-15-Review-Verification

- **概要**: Sprint 15 の全PBI（Build-Domain-Layer）の受入基準 (AC)
  が達成されていることを、サンドボックス環境上での実機デモおよびエビデンスに基づいて PO
  と共に客観的に検証・承認する。
- **見積サイズ**: M（半日〜1日規模の重要イベント）
- **証明方法**: 実機デモおよびテストログによる確認
- **関連実装計画**: なし（検証プロセスのみ）
- **関連ファイル**: [`sprint-review-15.md`](/.agents/management/sprint-review-15.md)
- **受入基準 (AC)**:
  - [ ] `develop-environment-setup` スキルにより、デモ用のサンドボックス環境が準備されていること。
  - [ ] `sprint-review-15.md` に定義された全 PBI に対する実機デモが、PO
        立ち合いのもとで完了していること。
  - [ ] 実機デモで確認できない項目（バックエンドロジック等）については、テストパスログまたは実行ログによる客観的証明が提示されていること。
  - [ ] ユーザー（PO）がその証明内容を確認し、レビューが正式に承認（合格）されること。
  - [ ] `sprint-review-15.md` に PO 承認の証跡が正しく記録されていること。

#### WP_1: 検証実施

- **Effort見積（介入回数）**: 1回
- [ ] AC1: サンドボックス環境が準備されている
- [ ] AC2: 全PBIの実機デモが完了している
- [ ] AC3: テストログによる客観的証明が提示されている
- [ ] AC4: POが証明内容を確認し承認する
- [ ] AC5: sprint-review-15.md に承認の証跡が記録されている

## 将来のバックログ

### [TODO] [ManagementFoundation/ProjectGovernance]/Build-Gateway-Layer

- **概要**: Domain層が定義したPort（PlanGateway, ConfigGateway）の具象実装を提供する。gh
  CLIアダプター、ファイルI/Oアダプターを実装し、Domain層の型とGitHub APIの型のマッピングを行う。
- **根拠**: Architecture Design (L3) §2.2 Gateway層の責務
- **見積サイズ**: L
- **証明方法**: 全Gateway実装の単体テストが成功し、`deno task qa` がエラーなく通過すること。

#### WP_1: PlanGateway gh CLI 実装

- **Effort見積（介入回数）**: 2回
- [ ] AC1: `PlanGateway` の `execute` がPlan内の各Step.operationを解釈し、適切なgh
      CLIコマンドにルーティングする
- [ ] AC2: `createItem`, `updateItem`, `closeItem`, `findItem`, `searchItems` の各Step操作がgh
      CLI経由で実行可能
- [ ] AC3: `createTimebox`, `updateTimebox`, `closeTimebox` の各Step操作がgh CLI経由で実行可能
- [ ] AC4: ネットワークエラーを `StepResult.error` として返すハンドリングが実装されている
- [ ] AC5: 単体テストが作成されパスすること

#### WP_2: ConfigGateway 実装

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `readConfig` / `writeConfig` が `.harnessrc` の読み書きをファイルI/O経由で実装している
- [ ] AC2: `listBoards` / `createBoard` がgh CLI経由でProject V2ボードを操作する
- [ ] AC3: 単体テストが作成されパスすること

#### WP_3: 型マッピングと認証制御

- **Effort見積（介入回数）**: 1回
- [ ] AC1: Domain層の型 → gh CLI引数へのマッピング関数が実装されている
- [ ] AC2: gh CLIからの出力 → Domain層の型へのパース関数が実装されている
- [ ] AC3: 認証状態の確認（`gh auth status`）と未認証時のエラー報告が実装されている
- [ ] AC4: 単体テストが作成されパスすること

### [TODO] [ManagementFoundation/ProjectGovernance]/Build-Skill-Layer

- **概要**: 各スキル（pbi-open, wp-create,
  pbi-update等）の薄いインターフェース層を実装する。Skill層はワークフローからの入力（stdin
  JSON）をパースし、Domain層のUseCaseを呼び出し、結果を整形する。dry-runフラグの解釈と分岐制御も担当する。
- **根拠**: Architecture Design (L3) §2.2 Skill層の責務
- **見積サイズ**: L
- **証明方法**: 全スキルの単体テストが成功し、`deno task qa` がエラーなく通過すること。

#### WP_1: PBI/WP操作スキル群

- **Effort見積（介入回数）**: 2回
- [ ] AC1: `pbi-open` スキルがstdin JSONをパースし、`ProductBacklogItemUseCase.propose` を呼び出す
- [ ] AC2: `pbi-update` スキルがstdin JSONをパースし、`ProductBacklogItemUseCase.revise` を呼び出す
- [ ] AC3: `pbi-archive` スキルが `ProductBacklogItemUseCase.archive` を呼び出す
- [ ] AC4: `wp-create` スキルが `WorkPackageUseCase.define` を呼び出す
- [ ] AC5: `wp-update` スキルが `WorkPackageUseCase.revise` を呼び出す
- [ ] AC6: `wp-complete` スキルが `WorkPackageUseCase.complete` を呼び出す
- [ ] AC7: 全スキルがdry-runモードに対応し、`Plan` の内容表示のみで終了する
- [ ] AC8: 単体テストが作成されパスすること

#### WP_2: Sprint管理スキル群

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `sprint-start` スキルが `SprintUseCase.start` を呼び出す
- [ ] AC2: `sprint-end` スキルが `SprintUseCase.end` を呼び出す
- [ ] AC3: 各スキルがdry-runモードに対応している
- [ ] AC4: 単体テストが作成されパスすること

#### WP_3: Review/Retrospectiveスキル群

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `review-issue` スキルが `ReviewUseCase.plan` を呼び出す
- [ ] AC2: 初期実装ではdry-run対応とPlan表示まで
- [ ] AC3: `reflection-issue` スキルが `RetrospectiveUseCase.plan` を呼び出す
- [ ] AC4: 単体テストが作成されパスすること

### [TODO] [ManagementFoundation/ProjectGovernance]/Implement-Dynamic-Project-Resolution

- **概要**: `.harnessrc` にProject番号をベタ書きするのをやめ、`gh project list`
  等で動的にProjectを作成・解決する仕組みに変更する。`setup-github-projects`
  スキルに「作成時に自動的にIDを `.harnessrc`
  に書き込む」ロジックを追加する。これにより、番号管理の不整合（`.harnessrc.example`
  と実環境の乖離）は根本的に解決する。
- **根拠**: GLOBAL-2, GLOBAL-3
- **見積サイズ**: M
- **証明方法**: 新規リポジトリで `setup-github-projects`
  を実行した際、手動で番号を編集することなくProjectが作成・解決されることの確認。

#### WP_1: Project ID動的解決の基盤実装

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `gh project list` の出力からプロジェクト名をキーにIDを解決する関数が実装されている
- [ ] AC2: 該当プロジェクトが存在しない場合は新規作成し、そのIDを返すフォールバックロジックがある
- [ ] AC3: 解決したIDを `.harnessrc` に自動書き込みする機能がある
- [ ] AC4: `deno task qa` が全テストパスすること

#### WP_2: setup-github-projects への統合

- **Effort見積（介入回数）**: 1回
- [ ] AC1: `setup-github-projects` スキル実行時にWP_1の動的解決を呼び出す
- [ ] AC2: `.harnessrc.example` のProject番号を動的解決を前提とした記述（例: `"auto"`）に変更する
- [ ] AC3: 後方互換性のため、静的な数値設定でも動作する
- [ ] AC4: `deno task qa` が全テストパスすること

### [TODO] [ManagementFoundation/ProjectGovernance]/Enhance-Archive-Migration-Tooling

- **概要**:
  アーカイブ移行ツールの機能拡張。現状は一括処理のみで「このPBIだけ移行したい」という一件単位の移行に対応していない。また大量データ移行時にGitHub
  APIのレート制限を考慮しておらず、Project V2フィールド設定が中途完了するリスクがある。
- **根拠**: GLOBAL-5, GLOBAL-6
- **見積サイズ**: S
- **証明方法**:
  一件移行モードで特定PBIのみ移行できること、大量移行時にレート制限を考慮した安全な実行ができることの確認。

#### WP_1: 一件単位移行機能

- **Effort見積（介入回数）**: 1回
- [ ] AC1: PBI ID（またはIssue番号）を指定して一件のみ移行するモードが実装されている
- [ ] AC2: 一件移行時も全フィールド（Status, size, effort等）が正しく設定される
- [ ] AC3: `deno task qa` が全テストパスすること

#### WP_2: レート制限対策

- **Effort見積（介入回数）**: 1回
- [ ] AC1: GitHub APIのレート制限を事前確認し、必要に応じてバッチサイズを調整する
- [ ] AC2: レート制限到達時は一時停止（`Retry-After` ヘッダー準拠）して再開する
- [ ] AC3: 大量移行の中途完了状態が検出可能で、再実行時に差分のみ処理する
- [ ] AC4: `deno task qa` が全テストパスすること

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

#### WP_3: QS統一・最適化

- **Effort見積（介入回数）**: 2回
- [ ] 以下のスキルに Quick-Start セクションを追加する: - `ac-checkpoint-implementation`,
      `quality-verification`, `refactoring-loop`, `archive-backlog`, `define-acceptance-criteria`,
      `record-session-metrics`, `reconfirm-context`, `skill-optimizer`, `stateless-reset`,
      `attach-harness-to-project`, `check-harness-configs`, `manage-git-identity`,
      `publish-harness-rules`, `publish-harness-skills`, `setup-harness-env`
- [ ] `sprint-retrospective-kpt/SKILL.md` の Quick-Start を最短経路に削減する
- [ ] `evaluate-sprint-metrics/SKILL.md` の Quick-Start を最短経路に削減する
- [ ] `hybrid-triage-commit/SKILL.md` の「Quick-Start & モード別詳細手順」を Quick-Start
      と詳細手順に分割する

#### WP_4: QSフォーマット検証テスト追加

- **Effort見積（介入回数）**: 1回
- [ ] 全 SKILL.md に Quick-Start セクションが存在すること（references/
      がない単純スキルは除外）を検証するテストを作成する
- [ ] Quick-Start の行数が詳細手順の行数より少ないことを検証するテストを作成する
- [ ] `deno task qa` が全テストパスすることを確認する

#### WP_5: gitignore安全弁の整備

- **Effort見積（介入回数）**: 1回
- [ ] [`version-control-specialist.md`](/.agents/rules/version-control-specialist.md)
      の制約セクションに「コミット対象ファイルの最終決定前に必ず `.gitignore`
      を参照し、管理対象外（git ls-files
      で認識されない）ファイルが含まれていないか検証すること。追跡対象外ファイルほどリカバリーが困難なため、特に慎重に扱うこと」を追記する
- [ ] [`session-planning/SKILL.md`](/.agents/skills/bundles/management-bundle/session-planning/SKILL.md)
      の「4. 実装計画の作成」手順内に、「編集対象ファイルおよび生成される成果物が git
      管理対象か（`.gitignore`
      の対象外か）を確認し、管理対象外のファイルはコミット対象として列挙しないこと」を追加する
- [ ] `deno task qa` がエラーなく通過すること

#### WP_6: hybrid-triage-commit スキルの履歴保護トリガー追加

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

<!-- 削除・統合済みPBI: GitHub-WP-Skills(Sprint12で実装済), Workflow-Skill-Swap→CSL WP_1/4, Variance-Analysis→CSL WP_5, Review-Reflection-Boards→CSL WP_3 -->

### [TODO] [ProcessGovernance/WorkPackage]/Standardize-E2E-Verification-Step

- **概要**: E2E 検証（実APIを叩く対話的確認）の標準的な実施手順を `task-template.md`
  に組み込み、各セッションで一貫した扱いを可能にする。現状は使い捨てスクリプトやアドホックな手順で行われており、属人性が高い。
- **見積サイズ**: S
- **証明方法**: `task-template.md` に E2E 検証ステップがスキップ可能な Phase
  として定義され、全ワークフローから参照可能であること。
- **背景**:
  - E2E 検証（実際の GitHub API 経由での Issue
    作成・確認）は環境依存が大きく、自動テストスイートに含めるのは不適切。
  - 一方で、セッション内で PO と AI が対話的に確認する E2E
    は品質保証に有効であり、属人化させず標準手順として定着させる必要がある。

#### WP_1: task-template.md への E2E Phase 追加

- **Effort見積（介入回数）**: 1回
- [ ] `task-template.md` の GUARD ブロックに E2E 検証用のフェーズ（例:
      `Phase 3: 対話的 E2E 検証`）を追加し、`GUARD:REQUIRED_TASKS` に `対話的E2E検証`
      キーワードを登録する
- [ ] E2E 検証 Phase は「スキップ可能（PO 判断）」である旨を注釈として明記する
- [ ] `validate-task.ts` が E2E Phase の有無を強制しないよう、`optional`
      フラグまたは後方互換ロジックを追加する

#### WP_2: ワークフローガイドへの反映

- **Effort見積（介入回数）**: 1回
- [ ] `session-start` または `session-planning` の成果物ガイドに、E2E 検証 Phase の有無を PO
      と合意する手順を追記する
