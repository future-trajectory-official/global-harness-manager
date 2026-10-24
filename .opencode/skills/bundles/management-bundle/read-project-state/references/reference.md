# read-project-state リファレンス

## 対話手順（3点提示方式）

POへの問いかけが曖昧な場合は、**必ず以下の3点を尋ねて**から実行する。

> **1:<何を>**（例: PBI / WP / Epic / Feature / Sprint / Review） **2:<探す|調べる>**
> **3:<どんな条件で>**（例: #42 / ステータス: Todo / キーワード: auth）

- 「**探す**」→ 一覧検索 `search`
- 「**調べる**」→ 詳細閲覧 `find`
- 回答から `entityType` / `operation` / `params` を一意に決定する
- **単一インスタンスEntity**（Vision / ProductGoal）は search が対象外であることを 案内し、find
  を案内する
- Sprint は search が利用可能（state 指定でスプリント一覧を取得。次スプリント番号の把握に使用）
- 例:「現在のPBIを教えて」→ 1:PBI / 2:探す / 3:状態が進行中のもの
- 例:「#42のWPのACを見せて」→ 1:WP / 2:調べる / 3:#42

## 結果の提示（チャット表示形式）

### 一覧表示（search）の表示形式

検索結果は以下の形式で提示する。

```
■ <EntityType> 一覧（<件数>件）
#<number> | <title> | <状態> | <labels>
#<number> | <title> | <状態> | <labels>
...
```

- `number`: Issue番号
- `title`: タイトル
- `状態`: Project V2 Status（Todo / In Progress / Done）。**Status が未設定の場合は Idea（発案）**
  として提示する。Issue 単体の場合は Issue state（open / closed）
- `labels`: ラベル一覧

> **Idea（Status 未設定）の扱い**: Project V2 の Status には `Idea` 選択肢が無い。Status
> が未設定（null）の PBI / WP を管理概念の `Idea`（発案）として扱う。Idea を検索する場合は
> `params.status` に `"__none__"` を指定する（空文字では条件が付かない）。

### 詳細表示（find）の表示形式

閲覧結果は以下の形式で提示する。

```
■ <EntityType> #<number> | <title> | <状態>
<body 本文>
AC（受入基準）:
<AC 本文>
Labels: <labels>
```

- `title`: タイトル
- `状態`: Project V2 Status（Todo / In Progress / Done）または Issue state。**Status が未設定の
  場合は Idea（発案）** として提示する
- `body`: Issue 本文（説明）
- `AC 本文`: body 内の受入基準
- `labels`: ラベル一覧

### 出力に含まれる構造化情報（find）

`find` の `output` には表示用の本文に加え、以下の構造化情報が含まれる。

| キー                    | 内容                                                                 | 用途                                                                               |
| ----------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `issueState`            | Issue の状態（`OPEN` / `CLOSED`）                                    | アーカイブ済み判定。**ProjectV2 の Status（Todo / In Progress / Done）とは別概念** |
| `projectItems[].fields` | 所属ボードの ProjectV2 カスタムフィールド（`harness-*` と `Status`） | effort / size / KPT / メトリクスの参照。**`Status` 未設定は Idea（発案）**         |
| `milestone`             | 所属スプリント（Milestone）                                          | スプリント絞り込み                                                                 |
| `parent` / `children`   | 親Issue / 子Issue                                                    | 親子関係の確認                                                                     |

> `search` は一覧（番号・タイトル・ラベル）のみを返し、`issueState` や `fields` は含まない。
> 状態やフィールド値が必要な場合は `find` を用いること。

## エラー時の表示

| 状況                              | 表示                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| search 対象外 Entity              | `search is not supported for <Entity>: single-instance by business rule. Use find instead.` |
| 検索0件                           | `該当する<EntityType>が見つかりませんでした`                                                |
| code不明（find で itemId 未指定） | `INVALID_INPUT: find for <Entity> requires itemId (Issue number)`                           |
| 不明な EntityType / operation     | `INVALID_INPUT: ...`                                                                        |

- エラー時は `success: false` とエラーメッセージを提示し、必要に応じて対話手順をやり直す

## EntityType 一覧

下表は
[input-schema.md](/.opencode/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
の「EntityType 一覧と対応操作」を**正**とする（二重管理を避けるため、詳細な対応表は input-schema.md
側に集約）。個別の対応関係・params キー・実行例は必ず input-schema.md を参照する。

要点のみ:

- **search 対象外**（単一インスタンス）: Vision / ProductGoal
- **Sprint search**: state 指定（open / closed / all）でスプリント一覧を解決できる
- **検索・閲覧とも不可**: Scope
