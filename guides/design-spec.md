# 設計仕様 (Design Specification)

本ドキュメントは、L1（運用ガイド、`/guides/operations-guide.md`）で提唱した**3階層スコープモデル**を、GitHub上で実現するための設計仕様です。
属性定義、操作インターフェース、表現分離、一覧表示を精密に定義することで、人間とAIが確実に実装・運用できるようにします。

---

## 第1章: 設計の前提と目的

### 1.1. L1（運用ガイド）との関係

L1（`/guides/operations-guide.md`）は、本プロジェクトの管理哲学である3階層スコープモデルの各概念と、その運用フレームワークを解説しています。
L2（本ドキュメント）は、L1の概念フレームワークを「実装可能な設計書」に変換します。L1で定義されたすべての概念と、それらの操作・状態遷移・品質ガードレールに対して、属性・インターフェース・表現分離の精密な定義を与えます。

### 1.2. L2 の設計アプローチ

本設計仕様は、目的ベースの段階的詳細化アプローチを採ります。

```
第2章: 人間/AI責務分離 → なぜ構造化が必要か
    ↓
第3章: どのような発行物（概念）があるか → GitHub上でどう表現するか → 必要な属性
    ↓
第4章: それらをどのように操作するか（業務IF）
    ↓
第5章: それをGitHub上でどう最小カスタムで実現するか
    ↓
第6章: どの情報をボードで可視化し、どの情報を代替手段で管理するか
```

---

## 第2章: 人間とAIの責務分離から見た構造化の必要性

### 2.1. プロジェクト管理における責務の分離

本プロジェクトでは、人間とAIに以下の役割を明確に分離します。

| 主体           | 責務                                                                                                               | 具体例                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| **人間（PO）** | 「何をすべきか」の意思決定                                                                                         | 優先順位の決定、ACの承認、完了の判断                                             |
| **AI**         | 「どのように実装するか」の実行と構造化データの管理、および人間の意思決定に必要な情報を理解しやすい形で提供すること | 情報の記録・更新・一覧表示、状態遷移の実行、ダッシュボード形式での状況サマリ提示 |

この分離により、人間は管理の細部に煩わされることなく、本質的な意思決定に集中できます。
管理技術が低い新人でも、AIに対して「スプリントを開始して」「このセッションを計画して」と指示するだけで、プロセスが自動的に進行します。

### 2.2. 平文管理の限界

AI協働開発において、人間とAIの主たる接点は**チャットウィンドウやAI統合IDE**です。GitHubの画面を人間が直接見るのは補助的な手段に過ぎません。理想的には、ユーザーがGitHubを開かずとも、AIとの対話だけで管理状況を完全に理解できる状態を目指します。

しかし、構造化データだけで情報を管理すると、GitHubで確認したくなったときに人間には解読不能になります。そこで以下の二層構造を採用します。

| 層                  | 役割                       | 主体         | 説明                                                                                            |
| ------------------- | -------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| **主（Primary）**   | 構造化データによる情報保存 | AI           | Projects V2カスタムフィールドに格納。AIが読み書きし、チャット上で人間に理解しやすい形で提供する |
| **従（Secondary）** | 人間向け表示項目           | Issue Body等 | GitHubを直接確認したくなった場合に備えた補助的な人間可読表現。完全性は保証しない                |

この設計において、人間にとっての**主要な情報インターフェースはAIを介したチャット上での提示**であり、Issue
Body上のMarkdownはあくまで補助的です。

平文（Markdownの自由記述）のみで管理しようとすると、以下の問題が発生します。

- 「ステータス」という文字列をgrepしても、対象のPBIがIdea / Todo / InProgress /
  Doneのいずれか判別できない
- 作業の進捗を集計しようとすると、各Issueの本文を解析するプログラムが必要になり、メンテナンスコストが高騰する
- 人間がフォーマットを統一しないとAIが誤認するが、フォーマット統一を人間に強制すると責務分離の原則に反する

さらに、プロセス改善のためのエビデンス情報を収集・分析するには、これらの情報が構造化されたフィールドに格納されている必要があります。平文では集計クエリや経時比較が事実上不可能であり、「データに基づくプロセス改善」という本プロジェクトのビジョン（教育的協働、予実差の議論）を実現できません。

### 2.3. 構造化の要件

上記を踏まえ、本設計では以下の要件を課します。

1. **機械可読な属性**:
   進捗状態、サイズ見積、実績などの定量情報は、AIが確実に読み書きできる構造化フィールドに格納する
2. **Type分類**: 「PBI」「WP」「Review」など、異なる種類の発行物を明確に区別するための分類子を持つ
3. **表現の二重化と同期**:
   人間向けの説明とAI向けの構造化データは同じ意味情報を表現し、一方が更新されたら他方も更新される同期ルールを持つ
4. **最小カスタム**:
   プラットフォーム（GitHub）が提供するデフォルト機能を最大限活用し、カスタムフィールドは真に不足するものだけに限定する

---

## 第3章: 発行物の設計

### 3.1. 3階層スコープモデルの全概念

本章では、第2章の要件を満たすために必要な発行物を設計します。まず、3階層スコープモデルに存在する**すべての概念**を列挙します。次の3.2節で各概念の要件と属性を定義し、3.3節でGitHub上の表現方法を検討します。

3階層スコープモデルには以下の9つの概念が存在します（L1運用ガイドより）。

| 階層           | 概念          | 説明                                      | 具象化タイミング                                   | 変更頻度               | 管理者         |
| -------------- | ------------- | ----------------------------------------- | -------------------------------------------------- | ---------------------- | -------------- |
| プロジェクト層 | Vision        | プロジェクトが中長期的に目指す理念        | プロジェクト開始時                                 | 四半期に一度程度       | PO             |
| プロジェクト層 | Product Goal  | 現在取り組むべき具体的な到達目標          | プロジェクト開始時またはピボット時                 | 数スプリントに一度     | PO             |
| プロジェクト層 | Epic          | 複数PBIを束ねる大規模機能領域             | 必要に応じて                                       | 低                     | PO / Tech Lead |
| プロジェクト層 | Feature       | Epicに属する機能単位                      | 必要に応じて                                       | 低                     | PO / Tech Lead |
| スプリント層   | Sprint Goal   | 各スプリントで達成すべき短期的な目標      | 各スプリント開始時                                 | スプリント単位         | PO             |
| スプリント層   | PBI           | Sprint Goalを達成するための価値の最小単位 | バックログリファインメント時またはスプリント計画時 | スプリント単位         | PO             |
| スプリント層   | Review        | スプリントレビューの枠組み                | スプリント開始時                                   | スプリント終了時に更新 | PO             |
| スプリント層   | Retrospective | スプリント振り返りの枠組み                | スプリント開始時                                   | スプリント終了時に記入 | チーム全体     |
| セッション層   | WP            | PBIを分解した最小の実装単位               | スプリント計画時またはセッション開始時             | セッション単位         | AI（人間承認） |

### 3.2. 各概念に必要な要件と属性

各概念がドメイン上で「何を保持・表現しなければならないか」を、実装手段（GitHub）とは独立に定義します。ここに列挙する属性は各Typeが持つべき完全な一覧であり、値の設定タイミングはTypeの状態（4章の操作インターフェース参照）に依存します。未設定時はNULLまたは空です。

#### Vision

プロジェクトが中長期的に目指す理念。全判断基準の根幹。変更は稀。本文はバージョン管理のためCommentに格納し、Bodyには変更履歴を記録する。

- **要件**: プロジェクトの理念を、複数の観点から構造化して記述する。変更履歴の追跡が可能であること
- **必要な属性**:
  - タイトル
  - 本文（バージョン管理されたステートメント。対象ユーザー、提供する価値、差別化要因、アウトカムを含む）
  - 変更履歴

#### Product Goal

ビジョン達成に向けて現在取り組むべき具体的な到達目標。数スプリントに一度更新される。本文はバージョン管理のためCommentに格納し、Bodyには変更履歴を記録する。

- **要件**: 現在のゴール文の明示と、過去のゴール変更の履歴追跡
- **必要な属性**:
  - タイトル
  - 本文（バージョン管理されたゴール文）
  - 変更履歴

#### Sprint Goal

各スプリントで達成すべき短期的な目標。Product Goalから導かれる。

- **要件**: スプリントの目的を表現する。期限は任意（品質やスコープを優先する場合は設定しなくてよい）
- **必要な属性**:
  - タイトル
  - 説明文
  - 開始日
  - 期限（任意）

#### Epic

同じビジネス概念やユーザーゴールに属するPBI群を束ねる論理的なグループ。必須ではない。

- **導入するケース**:
  複数のPBIが「認証」「課金」「通知」といった同一の意味領域に属し、それらを横断的に俯瞰・管理したい場合
- **導入しないケース**:
  PBIが互いに独立した意味領域に属しており、フラットに管理しても俯瞰性が損なわれない場合。あるいはプロジェクトが小さく全PBIを一覧できる場合
- **Epicに属さない例**:
  「パスワード変更（認証）」と「データ履歴管理（監査）」のように、意味領域が異なるPBI同士は同じEpicにしない
- **必要な属性**:
  - タイトル
  - 本文（概要、スコープ、完了定義）
  - 子Featureへの参照

#### Feature

Epic内のPBIをさらに意味的にグループ化する単位。Epicが存在する場合にのみ存在しうる。必須ではない。

- **導入するケース**: Epicが大きくなり、その中でさらに意味的なサブ領域（例:
  Epic「認証」の中の「パスワード管理」と「多要素認証」）を区別したい場合
- **導入しないケース**: Epicが小さく、PBIを直下に持っても俯瞰性が十分な場合
- **Epicとの違い**:
  Featureは同一Epic内での意味的なサブカテゴリ。Epicを越えてFeatureが存在することはない
- **必要な属性**:
  - タイトル
  - 本文（概要、スコープ）
  - 親Epicへの参照
  - 子PBIへの参照

#### PBI

Featureに属する価値の最小単位。完了条件（AC）が定義され、複数のWPに分解される。Featureが存在しない場合はPBI単体で管理する。

- **要件**:
  進捗状態の管理、サイズの見積と実績の記録、スプリントへの所属、親Feature（存在する場合）による分類
- **必要な属性**:
  - タイトル
  - 本文（概要、備考）
  - 状態（Idea / Todo / InProgress / Done）
  - サイズ見積（XS / S / M / L / XL）
  - サイズ実績（XS / S / M / L / XL）
  - 所属スプリント
  - 親Featureへの参照（Featureが存在する場合）
  - 子WPへの参照

#### WP

PBIを分解した最小の実装単位。1セッションで1つのWPを完了させることを原則とする。

- **要件**: 親PBIへの所属、effortの計画と実績の記録、乖離理由の記録、実行順序の管理
- **必要な属性**:
  - タイトル
  - 本文（AC達成エビデンス）
  - 親PBIへの参照
  - effort初期見積（整数）
  - effort計画値（整数）
  - effort実績（整数）
  - 乖離理由（テキスト）
  - 順序（数値）
  - 状態（Todo / InProgress / Done）

#### Review

スプリント終了時にSprint
Goalに対する達成状況を検証・承認するための概念。スプリントごとに1つ。エビデンス置場として機能し、結果は全てBodyのMarkdownで管理する。

- **要件**: レビュー結果の詳細記録
- **必要な属性**:
  - タイトル
  - 本文（レビュー結果の詳細。人間向けの自由記述）
  - 所属スプリント
  - 変更履歴

#### Retrospective

スプリント終了後にプロセスや協働の質を振り返るための概念。スプリントごとに1つ。

- **要件**: effort集計、予実差分析、スプリントメトリクスの構造化記録
- **必要な属性**:
  - タイトル
  - 本文（振り返り詳細。Keep / Problem / Try / Advise）
  - 所属スプリント
  - スプリントKPT（Keep / Problem / Try / Advise）
  - スプリントメトリクス（Goal Achievement Rate / Estimation Accuracy / Quality Integrity /
    Collaboration & Process Discipline / Velocity）

### 3.3. GitHub上の実現方法

3.2節の要件を満たすため、各概念をGitHubのどの仕組み（Issue / Milestone / Projects
V2）で実現するかを決定します。選定理由は「デフォルトIssueで対応できること」と「不足しているため追加の仕組みが必要なこと」を区別して示します。

| 概念          | 必要な要件                                                        | GitHub上の表現                               | 選定理由                                                                                                                                                                                                                                                     |
| ------------- | ----------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vision        | 理念の永続保存。変更時はバージョン追跡                            | Issue + Comments                             | IssueのTitle+Body+Labelで静的な情報保持は十分。変更時はComment追記で版管理できる                                                                                                                                                                             |
| Product Goal  | ゴール文の保持と変更履歴                                          | Issue + Comments                             | Title+Body+Labelで保持。変更履歴はCommentの時系列で自動管理。Bodyに変遷一覧を集約                                                                                                                                                                            |
| Sprint Goal   | タイムボックス＋名称＋説明＋全スプリント成果物との紐付け          | **Milestone**                                | Milestoneがタイムボックス（期限）を標準提供。descriptionにGoalを記載。IssueにMilestoneを設定するだけで全成果物（PBI/WP/Review/Retrospective）が自動紐付け。Issue単体ではスプリント成果物の横断的なグルーピングができない                                     |
| Epic          | 名称＋説明＋子Featureの束ねる親子関係                             | Issue + sub-issues                           | Title+Body+Labelで十分。sub-issuesで子Featureを束ねられる。Projects V2は不要                                                                                                                                                                                 |
| Feature       | 名称＋説明＋親Epic＋子PBIの双方向親子関係                         | Issue + sub-issues + `--parent`              | Title+Body+Labelで十分。親Epicは`--parent`、子PBIはsub-issuesで紐付け。Projects V2は不要                                                                                                                                                                     |
| PBI           | 名称＋説明＋状態管理＋サイズ記録＋スプリント所属＋親Feature＋子WP | Issue + Milestone + Projects V2 + sub-issues | Title+Body+Label+Comment+Milestone+sub-issuesで基本情報はカバーできるが、**状態とサイズを構造化フィールドで管理できない**。Projects V2のStatus（Todo/InProgress/Done）で状態を、カスタムフィールド（`harness-size-*`）でサイズを構造化保存する               |
| WP            | 名称＋成果物＋親PBI＋effort＋乖離理由＋順序                       | Issue + Projects V2 + sub-issues + Comments  | Title+Body+Label+sub-issues+Commentsで基本情報はカバーできるが、**effort値と乖離理由と順序を構造化フィールドで管理できない**。Projects V2のカスタムフィールド（`harness-effort-summary` / `harness-variance-review-*` / `harness-sequence`）で構造化保存する |
| Review        | 名称＋達成度＋PBIサマリ＋承認状態                                 | Issue + Comments                             | Title+Body+Label+Commentで基本情報はカバーできる。カスタムフィールド不要（レビュー結果はBodyのMarkdownで管理）                                                                                                                                               |
| Retrospective | 名称＋KPT項目＋スプリントメトリクス                               | Issue + Projects V2 + Comments               | Title+Body+Label+Commentで基本情報はカバーできるが、**KPTとメトリクスを構造化フィールドで管理できない**。カスタムフィールド（`harness-keep-problem-try` / `harness-metrics`）で構造化保存する                                                                |

### 3.4. 概念間の階層関係

各概念は以下の階層構造を持ちます。上位層が下位層の方向性を定義し、下位層は上位層の存在理由を具体化します。

#### 目的の階層

```
Vision → Product Goal → Sprint Goal → PBI → WP
```

上位の概念が下位の概念の「存在理由（Why）」を定義します。

| 関係                       | 意味                                      |
| -------------------------- | ----------------------------------------- |
| Vision → Product Goal      | Visionを達成するための具体的な到達目標    |
| Product Goal → Sprint Goal | Product Goalに貢献する短期的な目標        |
| Sprint Goal → PBI          | Sprint Goalを達成するための価値の最小単位 |
| PBI → WP                   | PBIのACを実現するためのワークパッケージ   |

#### 分類の階層

```
Epic → Feature → PBI
```

プロジェクトの規模が大きくなった場合に、PBIを意味的にグループ化するための階層です。Epicは必ずFeatureを介してPBIを保有し、Epicが直接PBIを持つことはありません。

#### 参照ルール

- PBIは目的の階層と分類の階層の両方に同時に属する
- WPは必ず1つの親PBIを持つ（親なしのWPは存在しない）
- ReviewとRetrospectiveはスプリントに1つだけ存在する（複数作成しない）
- EpicとFeatureは任意（必須ではない）

#### 階層の深さの判断指針

分類の階層（Epic > Feature > PBI）はプロジェクトの規模や管理ニーズに応じて取捨選択する。

| 階層構成             | 適した状況                                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| PBIのみ              | プロジェクトが小さく全PBIをフラットに一覧できる。PBI同士が独立した意味領域に属しており横断的な俯瞰が不要                    |
| Feature > PBI        | 複数PBIを意味的にグループ化したいが、Epicを立てるほど大きくない。将来的な分析（機能数・ユーザー価値の集計等）に備えたい場合 |
| Epic > Feature > PBI | プロジェクトが大規模で、Epic単位・Feature単位の両方の粒度での分析や俯瞰が必要                                               |

どの階層を選んでも、下位層の概念（PBIやWP）の定義は変わらない。EpicやFeatureは管理上の補助線であり、実装の単位ではない。

### 3.5. Typeの区別と属性定義

3.3節で、Vision / Goal / Epic / Feature / PBI / WP / Review / Retrospective
の8種類の概念をIssueとして表現することを決定しました。しかし、これらはすべて同じ「Issue」という仕組みを共有します。異なる概念を同じIssueとして管理するには、**どの概念のIssueかを区別するための属性**
が必要です。この区別にはラベルを用います。

**ラベルとは**: GitHub Issues
が標準で提供する分類タグ。Issueに自由に付与でき、検索やフィルタリングに利用できる。本設計ではTypeの識別に
`type:*` ラベルを使用する。

**Type一覧**:

| Type          | ラベル               | 説明               |
| ------------- | -------------------- | ------------------ |
| Vision        | `type:Vision`        | プロジェクトの理念 |
| Goal          | `type:Goal`          | プロダクトゴール   |
| Epic          | `type:Epic`          | 大規模機能領域     |
| Feature       | `type:Feature`       | Epic内の機能単位   |
| PBI           | `type:PBI`           | 価値の最小単位     |
| WP            | `type:WP`            | 作業管理の最小単位 |
| Review        | `type:Review`        | スプリントレビュー |
| Retrospective | `type:Retrospective` | スプリント振り返り |

**ラベルの制約**:

- `type:*` ラベルは**排他選択**とする。1つのIssueに同時に設定できる `type:*` ラベルは1つのみ（例:
  `type:PBI` と `type:WP` を同時に設定してはならない）
- 排他制御は運用ルールとして徹底し、AIの操作時に検証する

各Typeの詳細な属性一覧と、それらをIssueのどの機能（Title, Body, Label等）・Projects
V2のどのフィールドにマッピングするかは、**第5章（5.2節 Type別
属性×実装マトリクス）**で一括定義する。

---

## 第4章: 操作インターフェース設計

### 4.1. 設計思想

操作名は **業務用語**
で統一します。POや新人でも直感的に理解できるようにするためです。各概念に最適な操作名を、その概念の性質に合わせて個別に定義します。

### 4.2. 概念別操作一覧

各概念が公開する操作と、その操作による副作用（変化する属性）を定義します。

#### Vision

| 操作             | 入力                                         | 副作用（変化する属性）                                                           | 出力 |
| ---------------- | -------------------------------------------- | -------------------------------------------------------------------------------- | ---- |
| **掲げる**       | ビジョンステートメント, ターゲットアウトカム | Visionが作成される、初版の内容が記録される、変更履歴の最初のエントリが作成される | —    |
| **方針転換する** | ビジョンステートメント, ターゲットアウトカム | 変更履歴に新しいエントリが追加される、新しいバージョンの内容が記録される         | —    |

#### Product Goal

| 操作             | 入力     | 副作用（変化する属性）                                           | 出力 |
| ---------------- | -------- | ---------------------------------------------------------------- | ---- |
| **設定する**     | ゴール文 | Goalが作成される、変更履歴の最初のエントリが作成される           | —    |
| **方針転換する** | ゴール文 | 変更履歴に新しいエントリが追加される、新しいゴール文が記録される | —    |

#### Sprint

| 操作               | 入力                        | 副作用（変化する属性）                                                  | 出力 |
| ------------------ | --------------------------- | ----------------------------------------------------------------------- | ---- |
| **開始する**       | スプリント名                | Sprintが作成される。以降、PBI/WP/Review/Retrospectiveが紐付け可能になる | —    |
| **目標を設定する** | スプリント名, Sprint Goal文 | Sprint Goalが設定・更新される（冪等）                                   | —    |
| **期限を設定する** | スプリント名, 期限日        | 期限が設定・更新される（冪等）                                          | —    |
| **終了する**       | スプリント名                | Sprintがクローズされる                                                  | —    |

（削除が必要な場合は、AIが直接CLI操作を行う。本インターフェースの対象外）

#### Epic

| 操作           | 入力                   | 副作用（変化する属性）     | 出力     |
| -------------- | ---------------------- | -------------------------- | -------- |
| **定義する**   | タイトル, 本文         | Epicが作成される           | —        |
| **再定義する** | 識別子, タイトル, 本文 | タイトル, 本文が更新される | —        |
| **一覧する**   | 条件(任意)             | —                          | Epic一覧 |
| **特定する**   | 識別子                 | —                          | 該当Epic |

#### Feature

| 操作               | 入力                         | 副作用（変化する属性）            | 出力                  |
| ------------------ | ---------------------------- | --------------------------------- | --------------------- |
| **定義する**       | タイトル, 本文, 親Epic(任意) | Featureが作成される               | —                     |
| **再定義する**     | 識別子, タイトル, 本文       | タイトル, 本文が更新される        | —                     |
| **所属する**       | 識別子, 親Epic               | Featureが指定されたEpicに所属する | —                     |
| **所属を解除する** | 識別子                       | FeatureのEpic所属が解除される     | —                     |
| **一覧する**       | 親Epic(任意), 条件(任意)     | —                                 | 条件に合うFeature一覧 |
| **特定する**       | 識別子                       | —                                 | 該当Feature           |

#### PBI

| 操作               | 入力                                                                                  | 副作用（変化する属性）                                           | 出力              |
| ------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------- |
| **発案する**       | タイトル, 本文, 親Feature(任意)                                                       | PBIが作成される、状態がIdeaになる                                | —                 |
| **コミットする**   | スプリント                                                                            | PBIがスプリントに割り当てられる、状態がIdeaからTodoに遷移する    | —                 |
| **着手する**       | —                                                                                     | 状態がTodoからInProgressに遷移する                               | —                 |
| **完了する**       | —                                                                                     | 状態がInProgressからDoneに遷移する                               | —                 |
| **サイズ見積する** | 見積サイズ                                                                            | サイズ見積が設定される                                           | —                 |
| **サイズ確定する** | 実感サイズ                                                                            | サイズ実績が設定される                                           | —                 |
| **再定義する**     | 識別子, タイトル(任意), 本文(任意)                                                    | 各属性が更新される                                               | —                 |
| **探す**           | 親Feature(任意), スプリント(任意), アーカイブ含む(任意), 状態(任意), キーワード(任意) | —                                                                | 条件に合うPBI一覧 |
| **保管する**       | —                                                                                     | PBIのIssueがクローズされる（Done後、スプリント終了時の一括操作） | —                 |

#### WP

| 操作           | 入力                                                                  | 副作用（変化する属性）                                                                | 出力             |
| -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| **定義する**   | 親PBI, スプリント, タイトル, 本文, 計画前見積effort                   | WPが作成される、状態がTodoになる                                                      | —                |
| **着手する**   | 計画後見積effort                                                      | 状態がTodoからInProgressに遷移する、計画後見積effortが記録される                      | —                |
| **完了する**   | 完了時実績effort, 乖離理由, セッションKPT, セッションメトリクス       | 状態がInProgressからDoneに遷移する、実績effortと乖離理由とKPTとメトリクスが記録される | —                |
| **再定義する** | 識別子, タイトル(任意), 本文(任意)                                    | 各属性が更新される                                                                    | —                |
| **探す**       | 親PBI(任意), スプリント(任意), アーカイブ含む(任意), キーワード(任意) | —                                                                                     | 条件に合うWP一覧 |
| **特定する**   | 識別子                                                                | —                                                                                     | 該当WP           |
| **保管する**   | —                                                                     | WPのIssueがクローズされる（Done後、スプリント終了時の一括操作）                       | —                |

#### Review

| 操作         | 入力                                               | 副作用（変化する属性）                            | 出力       |
| ------------ | -------------------------------------------------- | ------------------------------------------------- | ---------- |
| **計画する** | スプリント, 概要, 検証項目                         | Review Issueが作成される                          | —          |
| **報告する** | スプリント, 判定結果, 検証項目実績, 添付資料(任意) | レビュー結果が記録される                          | —          |
| **確認する** | スプリント                                         | —                                                 | 該当Review |
| **保管する** | —                                                  | ReviewのIssueがクローズされる（スプリント終了時） | —          |

#### Retrospective

| 操作         | 入力                                             | 副作用（変化する属性）                                   | 出力 |
| ------------ | ------------------------------------------------ | -------------------------------------------------------- | ---- |
| **計画する** | スプリント                                       | Retrospective Issueが作成される                          | —    |
| **実施する** | Keep, Problem, Try, Advise, スプリントメトリクス | 振り返り内容が記録される                                 | —    |
| **保管する** | —                                                | RetrospectiveのIssueがクローズされる（スプリント終了時） | —    |

### 4.3. 状態と許容される遷移

各Typeの状態遷移は以下のルールに従います。状態名はL1（運用ガイド）の定義に準拠します。

#### PBI

```
Idea(発案) → Todo(コミット) → InProgress(着手) → Done(完了)
```

| 遷移              | トリガー操作 | 備考                                 |
| ----------------- | ------------ | ------------------------------------ |
| Idea → Todo       | コミットする | スプリント計画時                     |
| Todo → InProgress | 着手する     | 最初のWPが着手された時（自動）       |
| InProgress → Done | 完了する     | 全WP完了時（自動昇格）またはPO承認時 |

#### WP

```
Todo(定義) → InProgress(着手) → Done(完了)
```

| 遷移              | トリガー操作 | 備考                 |
| ----------------- | ------------ | -------------------- |
| Todo → InProgress | 着手する     | セッション計画承認時 |
| InProgress → Done | 完了する     | PO承認時             |

---

## 第5章: Issue + Projects V2 による最小カスタム実現方法

### 5.1. 本設計におけるGitHub機能の活用方法

本設計は GitHub Issues / Milestones / Projects V2 を実装基盤として選択します。

#### Issue の標準属性の利用方法

| 機能         | 本プロジェクトでの用途                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title        | 各発行物の名称                                                                                                                                                                                                |
| Body         | 人間向けの詳細説明。構造化せずMarkdownで自由記述                                                                                                                                                              |
| Labels       | Typeの識別（`type:*`）に限定                                                                                                                                                                                  |
| Milestone    | 発行物とスプリントの紐付け                                                                                                                                                                                    |
| Comments     | 追記型の情報（変更履歴のバージョン管理、乖離理由の詳細、議論ログ）。人間向け自由記述に加え、Projects V2カスタムフィールドを増やさずに済ませたい補足的な構造化データ（パース可能なJSON等）の格納にも使用できる |
| Parent issue | 子発行物が親発行物を参照する属性。1つの子は1つの親のみ持つ                                                                                                                                                    |
| Sub-issues   | 親発行物が子発行物を列挙する属性。1つの親は複数の子を持てる                                                                                                                                                   |

#### Milestone の標準属性の利用方法

| 機能        | 本プロジェクトでの用途 |
| ----------- | ---------------------- |
| Title       | スプリント名           |
| Description | Sprint Goalの記載      |
| Due date    | スプリントの期限       |

#### Projects V2 の標準フィールドの利用方法

Projects
V2はIssueをカードとして追加し、フィルター条件やグループ化条件を設定することで目的に応じた一覧を作成できるボード機構である。

Projects
V2はIssueの標準属性と同様の標準フィールドを持つため、それらの値は対応するIssueから継承することで2重管理を防ぐ。

一方でIssueに存在しないStatus（Todo / InProgress / Done /
未設定）という標準フィールドを持つため、PBIやWPの進捗管理に使用する。

これらの標準フィールドだけでは不足するエビデンスの記録やプロセス改善のための分析用の構造化属性を格納するため、Projects
V2のカスタムフィールドを追加する。本プロジェクトのカスタムフィールドには、標準フィールドと区別するために
`harness-` プレフィックスを付与する。詳細な定義は第5.3節、各ボードの設計は第6章で行う。

### 5.2. Type別 属性×実装マトリクス

各Typeの必須属性が、Issueのどの機能 / Projects
V2のどのフィールドにマッピングされるかを定義します。Sprint
GoalはMilestoneで実装するため本節の対象外です（属性は5.1のMilestone標準属性を参照）。

凡例:

- **Body**: Issue Body (Markdown)
- **Comment**: Issue Comment (Markdown/HTMLコメント)
- **Label**: Issue Labels
- **Milestone**: Issue Milestone
- **Sub-issue**: 子Issue（sub-issues）。親が子を列挙する
- **Parent**: 親Issue（parent issue）。子が親を参照する
- **V2:Status**: Projects V2 Status (SingleSelect)
- **V2:Custom**: Projects V2 カスタムフィールド（`harness-*`）
- **Pull Requests**: IssueにリンクされたPull Request（読み取り専用）。変更内容の証跡として利用する
- **—**: 使用しない

#### Vision

| 属性     | Issue   | Projects V2 |
| -------- | ------- | ----------- |
| タイトル | Title   | —           |
| 変更履歴 | Body    | —           |
| 本文     | Comment | —           |

<details>
<summary>Body推奨構造</summary>

```markdown
## History

| 日付 | バージョン | 概要 | 変更理由 |
| ---- | ---------- | ---- | -------- |
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
# Version: [バージョン番号]

## Statement

### Target

[対象ユーザーの説明]

### Value

[提供する価値]

### Differentiator

[差別化要因]

## Outcome

- [アウトカム1]
- [アウトカム2]
```

</details>

#### Product Goal

| 属性     | Issue   | Projects V2 |
| -------- | ------- | ----------- |
| タイトル | Title   | —           |
| 変更履歴 | Body    | —           |
| 本文     | Comment | —           |

<details>
<summary>Body推奨構造</summary>

```markdown
## History

| 日付 | バージョン | 概要 | 変更理由 |
| ---- | ---------- | ---- | -------- |
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
# Version: [バージョン番号]

## Goal

[Goal内容]
```

</details>

#### Epic

| 属性                | Issue     | Projects V2 |
| ------------------- | --------- | ----------- |
| タイトル            | Title     | Title       |
| 本文                | Body      | —           |
| 種別（`type:Epic`） | Label     | Labels      |
| 子Feature           | Sub-issue | —           |

#### Feature

| 属性                   | Issue     | Projects V2 |
| ---------------------- | --------- | ----------- |
| タイトル               | Title     | Title       |
| 本文                   | Body      | —           |
| 種別（`type:Feature`） | Label     | Labels      |
| 親Epic                 | Parent    | —           |
| 子PBI                  | Sub-issue | —           |

#### PBI

| 属性               | Issue     | Projects V2                                                        |
| ------------------ | --------- | ------------------------------------------------------------------ |
| タイトル           | Title     | Title                                                              |
| 本文               | Body      | —                                                                  |
| 種別（`type:PBI`） | Label     | Labels                                                             |
| スプリント         | Milestone | Milestone                                                          |
| 親Feature          | Parent    | —                                                                  |
| 子WP               | Sub-issue | —                                                                  |
| 備忘録             | Comment   | -                                                                  |
| 見積サイズ         | —         | **V2:Custom**: `harness-size-estimate` (SingleSelect: XS/S/M/L/XL) |
| 実感サイズ         | —         | **V2:Custom**: `harness-size-actual` (SingleSelect: XS/S/M/L/XL)   |
| effort集計値       | —         | **V2:Custom**: `harness-effort-summary` (Text / JSON)              |
| サイズ乖離総評     | —         | **V2:Custom**: `harness-variance-review-size` (Text)               |
| 計画乖離レビュー   | —         | **V2:Custom**: `harness-variance-review-planning` (Text)           |
| 実行レビュー       | —         | **V2:Custom**: `harness-variance-review-execution` (Text)          |
| 改善提案           | —         | **V2:Custom**: `harness-improvement-suggestions` (Text)            |
| 状態               | —         | V2:Status (NULL/Todo/InProgress/Done)                              |

<details>
<summary>Body推奨構造</summary>

```markdown
## Summary

[概要]

## Artifacts

- [成果物分類1]
  - [成果物1-1概要]
  - [成果物1-2概要]
- [成果物分類2]
  - [成果物2-1概要]
  - [成果物2-2概要]

## Proof Method

[検証方法の説明]
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
## History

| # | 変更前 | 変更後 | 変更理由 |
| - | ------ | ------ | -------- |
```

</details>

<details>
<summary>個別カスタムフィールド一覧</summary>

PBIの予実差分析は単一JSONから個別カスタムフィールドに分割され、1,024文字制限を回避している。

| フィールド名                        | 型   | 内容                                                                                    |
| ----------------------------------- | ---- | --------------------------------------------------------------------------------------- |
| `harness-effort-summary`            | Text | 子WPのeffort集計値JSON（`{"initial_estimate": N, "planned_estimate": N, "actual": N}`） |
| `harness-variance-review-size`      | Text | サイズ乖離総評（`confirmSize`時に記録）                                                 |
| `harness-variance-review-planning`  | Text | 計画乖離レビュー（AI分析テキスト）                                                      |
| `harness-variance-review-execution` | Text | 実行レビュー（AI分析テキスト）                                                          |
| `harness-improvement-suggestions`   | Text | 改善提案（AI分析テキスト）                                                              |

AIは `analyzeEffort`
で子WPのeffortデータを取得・集計し、その結果をもとに定性分析テキストを生成する。 生成されたJSONを
`recordAnalysis` ハンドラーに渡すことで、各フィールドに個別に書き込まれる。

```json
// recordAnalysis に渡すAI生成JSONの構造
{
  "wp_effort_summary": {
    "initial_estimate": <Σ>,
    "planned_estimate": <Σ>,
    "actual": <Σ>
  },
  "planning_variance_review": "<計画乖離レビュー>",
  "execution_variance_review": "<実行レビュー>",
  "improvement_suggestions": "<改善提案>"
}
```

</details>

#### WP

| 属性                     | Issue         | Projects V2                                               |
| ------------------------ | ------------- | --------------------------------------------------------- |
| タイトル                 | Title         | Title                                                     |
| 本文                     | Body          | —                                                         |
| 種別（`type:WP`）        | Label         | Labels                                                    |
| スプリント               | Milestone     | Milestone                                                 |
| 親PBI                    | Parent        | Parent issue                                              |
| 変更内容                 | Pull Requests | Pull Request                                              |
| 備忘録                   | Comment       | -                                                         |
| effort集計値             | —             | **V2:Custom**: `harness-effort-summary` (Text / JSON)     |
| 計画乖離レビュー         | —             | **V2:Custom**: `harness-variance-review-planning` (Text)  |
| 実行レビュー             | —             | **V2:Custom**: `harness-variance-review-execution` (Text) |
| 改善提案                 | —             | **V2:Custom**: `harness-improvement-suggestions` (Text)   |
| セッションメトリクス     | -             | **V2:Custom**: `harness-metrics` (Text / JSON)            |
| セッションKPT（Keep）    | -             | **V2:Custom**: `harness-kpt-keep` (Text)                  |
| セッションKPT（Problem） | -             | **V2:Custom**: `harness-kpt-problem` (Text)               |
| セッションKPT（Try）     | -             | **V2:Custom**: `harness-kpt-try` (Text)                   |
| セッションKPT（Advise）  | -             | **V2:Custom**: `harness-kpt-advise` (Text)                |
| 順序                     | —             | **V2:Custom**: `harness-sequence` (Number / decimal)      |
| 状態                     | —             | V2:Status (NULL/Todo/InProgress/Done)                     |

<details>
<summary>Body推奨構造</summary>

```markdown
## AC

- [ ] AC1: [概要]
  - [エビデンス]
- [ ] AC2: [概要]
  - [エビデンス]
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
## History

| # | 変更前 | 変更後 | 変更理由 |
| - | ------ | ------ | -------- |
```

</details>

PBIと同様、予実分析は個別カスタムフィールドに分割されている。`harness-effort-summary`
にJSON形式でeffort集計値を格納し、分析テキストは各テキストフィールドに個別に保存する。

<details>
<summary>harness-metrics推奨構造 (session)</summary>

```json
{
  "intent_alignment_rate": <1-5>,
  "constraint_adherence_score": <1-5>,
  "context_extraction_quality": <1-5>,
  "work_size_stability": <1-5>,
  "comment": "<改善ポイント>"
}
```

</details>

<details>
<summary>セッションKPT推奨構造</summary>

KPTは4つのTEXTフィールド（`harness-kpt-keep` / `harness-kpt-problem` / `harness-kpt-try` /
`harness-kpt-advise`）に分割して保存する。各フィールドの上限は 1,024文字（Projects
V2のTEXTフィールド制限）であり、4分割により全文保存が可能。

| フィールド名          | 内容                                 |
| --------------------- | ------------------------------------ |
| `harness-kpt-keep`    | Keep文章（うまくいったこと）         |
| `harness-kpt-problem` | Problem文章（課題・問題点）          |
| `harness-kpt-try`     | Try文章（次回試すこと）              |
| `harness-kpt-advise`  | AIからユーザーへのアドバイス（任意） |

</details>

#### Review

| 属性                  | Issue     | Projects V2 |
| --------------------- | --------- | ----------- |
| タイトル              | Title     | Title       |
| レビュー内容          | Body      | —           |
| 変更履歴              | Comment   | —           |
| 種別（`type:Review`） | Label     | Labels      |
| スプリント            | Milestone | Milestone   |

<details>
<summary>Body推奨構造</summary>

```markdown
## 凡例

- ❔ 未確認（初期状態。レビュー時に全ACを確認し、結果に応じて下記のいずれかに上書きする）
- ✅ 合格
- ⚠️ 条件付き合格
- ❌ 不合格
- ➖ 論理削除（スプリント中の仕様変更等により確認対象外となったもの）

## 実施環境

[実施環境]

## 総合判定

[合格/条件付き合格/不合格]

## 判定理由

[POからのフィードバック]

## 計画時確認項目

<!--スプリント開始時に計画されたPBIとWPのレビューポイントを列挙する-->

### PBI [PBI番号]

#### WP [WP番号] : [WPタイトル]

- ✅ AC_1: [内容]
- ❌ AC_2: [内容] — [不合格理由]
- ➖ AC_3: [内容] — [論理削除理由]
- ⚠️ AC_4: [内容] — [条件付き理由]

#### WP [WP番号] : [WPタイトル]

- ✅ AC_1: [内容]
- ❔ AC_2: [内容]（未確認）

## 計画後確認項目

<!--スプリント実施中に追加・変更されたレビューポイントを列挙する-->

### PBI [PBI番号]

#### WP [WP番号] : [WPタイトル]

- ✅ AC_a: [内容]
- ❌ AC_b: [内容] — [不合格理由]
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
## History

| # | 変更前 | 変更後 | 変更理由 |
| - | ------ | ------ | -------- |
```

</details>

#### Retrospective

| 属性                         | Issue     | Projects V2                                           |
| ---------------------------- | --------- | ----------------------------------------------------- |
| タイトル                     | Title     | Title                                                 |
| スプリントKPT                | Body      | **V2:Custom**: `harness-keep-problem-try` (Text/JSON) |
| スプリントメトリクス         | Comment   | **V2:Custom**: `harness-metrics` (Text / JSON)        |
| 種別（`type:Retrospective`） | Label     | Labels                                                |
| スプリント                   | Milestone | Milestone                                             |

<details>
<summary>Body推奨構造</summary>

```markdown
## スプリントふりかえり

### Keep

[Keep文章]

### Problem

[Problem文章]

### Try

[Try文章]

### Advise

[人間とAIの双方に向けた成長のためのアドバイス]
```

</details>

<details>
<summary>Comment推奨構造</summary>

```markdown
## スプリントメトリクス

### Goal Achievement Rate (ゴール達成率)

[1-5の数値] : [概要]

### Estimation Accuracy (見積もり精度)

[1-5の数値] : [概要]

### Quality Integrity (品質健全性)

[1-5の数値] : [概要]

### Collaboration & Process Discipline (協働品質とプロセス規律)

[1-5の数値] : [概要]

### Velocity (規模消化力)

[ΣPBI(実感サイズ*ウェイト換算値)] : [概要]
```

</details>

<details>
<summary>harness-keep-problem-try 推奨構造</summary>

```json
{
  "keep": "<Keep文章>",
  "problem": "<Problem文章>",
  "try": "<Try文章>",
  "advise": "<AIから人間への共進化アドバイス>"
}
```

</details>

<details>
<summary>harness-metrics推奨構造 (sprint)</summary>

```json
{
  "goal_achievement_rate": {"score": <1-5>, "note": "<概要>"},
  "estimation_accuracy": {"score": <1-5>, "note": "<概要>"},
  "quality_integrity": {"score": <1-5>, "note": "<概要>"},
  "collaboration_discipline": {"score": <1-5>, "note": "<概要>"},
  "velocity": {"value": <ΣPBI(実感サイズ*ウェイト)>, "note": "<概要>"}
}
```

</details>

### 5.3. カスタムフィールド一覧

すべてのカスタムフィールドには `harness-` プレフィックスを付与します。

#### Product Backlog Board

| フィールド名                        | 型                         | 説明                   |
| ----------------------------------- | -------------------------- | ---------------------- |
| `harness-size-estimate`             | SingleSelect (XS/S/M/L/XL) | PBIのサイズ見積        |
| `harness-size-actual`               | SingleSelect (XS/S/M/L/XL) | PBIのサイズ実績        |
| `harness-effort-summary`            | Text / JSON                | PBIの子WP effort集計値 |
| `harness-variance-review-size`      | Text                       | サイズ乖離総評         |
| `harness-variance-review-planning`  | Text                       | 計画乖離レビュー       |
| `harness-variance-review-execution` | Text                       | 実行レビュー           |
| `harness-improvement-suggestions`   | Text                       | 改善提案               |

#### Sprint Board

| フィールド名                        | 型               | 説明                                          |
| ----------------------------------- | ---------------- | --------------------------------------------- |
| `harness-effort-summary`            | Text / JSON      | WPのeffort集計値                              |
| `harness-variance-review-planning`  | Text             | 計画乖離レビュー                              |
| `harness-variance-review-execution` | Text             | 実行レビュー                                  |
| `harness-improvement-suggestions`   | Text             | 改善提案                                      |
| `harness-metrics`                   | Text / JSON      | セッションメトリクス（AI協働品質4指標のJSON） |
| `harness-kpt-keep`                  | Text             | セッションKPTのKeep（上限1,024文字）          |
| `harness-kpt-problem`               | Text             | セッションKPTのProblem（上限1,024文字）       |
| `harness-kpt-try`                   | Text             | セッションKPTのTry（上限1,024文字）           |
| `harness-kpt-advise`                | Text             | セッションKPTのAdvise（上限1,024文字、任意）  |
| `harness-sequence`                  | Number (decimal) | WPの実行順序（小数可）                        |

#### Review Board

カスタムフィールド不要。レビュー結果はBodyのMarkdownで管理する。

#### Retrospective Board

| フィールド名               | 型          | 説明                                                                              |
| -------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `harness-keep-problem-try` | Text / JSON | スプリントKPT（JSON文字列、WPのセッションKPT（`harness-kpt-*`）とは別フィールド） |
| `harness-metrics`          | Text / JSON | スプリントメトリクス（metrics-guide.mdの4指標 + VelocityをJSONで格納）            |

### 5.4. 表現の分離と主従関係

#### 基本原則

情報の保存と提示は、主（Primary）と従（Secondary）の二層構造で管理します。

- **主**: Projects V2 カスタムフィールド（`harness-*`）—
  AIが確実に読み書きできる構造化データ。AIはこのデータを解釈し、チャット上で人間に理解しやすい形式（ダッシュボード、進捗サマリ等）で提供する。
- **従**: Issue Body / Comments の Markdown —
  GitHubを直接確認したい場合に備えた補助的な人間可読表現。完全性は保証せず、あくまで参照用。

| 情報     | AI向け表現（主）                                  | 人間向け表現（従）             | 信頼できる情報源  |
| -------- | ------------------------------------------------- | ------------------------------ | ----------------- |
| タイトル | Projects V2 Title                                 | Issue Title                    | Issue（自動同期） |
| KPT      | Projects V2 `harness-kpt-keep/problem/try/advise` | Issue Body（ベストエフォート） | Projects V2       |

#### 同期ルール

1. **自動同期（Issue → Projects V2）**: Title, Assignees, Labels, Milestone は GitHub が自動同期する
2. **従表現はベストエフォート**: 人間向けのIssue
   Body更新はAIがベストエフォートで行う。更新に失敗しても主要データはProjects
   V2に残るため、情報が失われることはない
3. **信頼できる情報源の優先**:
   上記表の「信頼できる情報源」に記載された側が正とみなす。不一致が生じた場合は信頼できる情報源を優先して修復する
4. **人間による直接編集の禁止（カスタムフィールド）**: `harness-*`
   カスタムフィールドはAIのみが更新する。人間が直接編集すると同期が破綻する可能性があるため、編集はAI経由で行う

---

## 第6章: ボード設計と運用ルール

### 6.1. ボード管理の判断基準

各Typeをボード（Projects V2 Board）で管理すべきか、Issue単体＋ラベルで十分かを判断します。

| 判断基準                   | 説明                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| 一覧性の必要性             | 多数のインスタンスを横断的にフィルタ・ソートして確認する必要があるか |
| 状態管理の必要性           | ワークフローに沿った状態遷移を可視化・管理する必要があるか           |
| カスタムフィールドの必要性 | 標準フィールド以外の属性（effort, size等）を管理する必要があるか     |

### 6.2. Type別 判断結果

| Type          | ボード要否   | 理由                                                         | 所属ボード              |
| ------------- | ------------ | ------------------------------------------------------------ | ----------------------- |
| Vision        | 不要         | 単一インスタンス。検索＋ラベルフィルタで十分                 | —                       |
| Product Goal  | 不要         | 単一インスタンス。検索＋ラベルフィルタで十分                 | —                       |
| Epic          | 不要（任意） | 数が少なく、検索＋ラベルフィルタで十分。ボード管理してもよい | Product Backlog（任意） |
| Feature       | 不要（任意） | Epicに同じ                                                   | Product Backlog（任意） |
| PBI           | **必要**     | 多数のPBIを状態管理・フィルタする必要がある                  | Product Backlog Board   |
| WP            | **必要**     | スプリント中の進捗を細かく管理する必要がある                 | Sprint Board            |
| Review        | 不要         | エビデンス置場。スプリント1件のみでIssue単体検索で十分       | —                       |
| Retrospective | **必要**     | KPT項目とメトリクスの管理。スプリント横断分析の基盤          | Retrospective Board     |

### 6.3. ボード間のデータ関係

```
Product Backlog Board   ───   PBI
                              │ 親子関係（自動）
Sprint Board            ───   WP（Parent列で親PBIを参照）
Retrospective Board        ───   Retrospective Issue
```

| ルール                                                  | 説明                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Product Backlog Board には **PBIのみ** 追加する         | Epic/Featureは親子関係で自動的に紐付くため追加不要。Review/Retrospectiveは別途検索で十分 |
| Sprint Board には **WPのみ** 追加する                   | PBI自体は追加しない。親PBIはWPのParent列に自動表示される（Issueの親子関係より）          |
| 1つのPBIは複数のスプリントにまたがらない                | PBIは1つのMilestoneにのみ所属する                                                        |
| Review Issue はIssue単体＋ラベル検索で管理する          | スプリントごとに1つ。ボード追加不要                                                      |
| Retrospective Board にはRetrospective Issueのみ追加する | スプリントごとに1つのRetrospective Issue                                                 |
| Issueのクローズ = アーカイブ                            | スプリントレビュー＋PO承認後に行う。クローズしてもProjects V2の履歴は残る                |

### 6.4. ボード不要Typeの代替手段

ボードで管理しないType（Vision, Goal, Epic, Feature）は、以下の代替手段で管理します。

| Type         | 代替手段                                                          |
| ------------ | ----------------------------------------------------------------- |
| Vision       | Issue単体 + ラベル `type:Vision`                                  |
| Product Goal | Issue単体 + ラベル `type:Goal`                                    |
| Epic         | Issue単体 + ラベル `type:Epic`、子Feature/PBIはSub-issuesで参照   |
| Feature      | Issue単体 + ラベル `type:Feature`、親Epic/子PBIはSub-issuesで参照 |

これにより、ボードの数を必要最小限に抑えつつ、すべてのTypeを検索可能にします。

### 6.5. Projects V2 Board のセットアップ

各 Board の作成・カスタムフィールド定義・`.harnessrc` へのID登録の詳細手順は
L3（アーキテクチャ設計）で定義します。

### 6.6. 長期運用時のボードメンテナンス

スプリントが進むにつれて各ボードにDoneのアイテムが蓄積されます。以下のルールで運用します。

| ルール             | 説明                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| アクティブのみ表示 | 各ボードのビューフィルタで、進行中のスプリント＋最大2スプリント分のみ可視化する                          |
| フィルタ設定       | 各ボードのビュー（View）を「アクティブ」用と「アーカイブ済み」用に分け、デフォルトをアクティブ表示にする |
