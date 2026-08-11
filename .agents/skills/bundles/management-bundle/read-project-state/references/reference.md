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
- `状態`: ステータス（Todo / In Progress / Done）または Issue state（open / closed）
- `labels`: ラベル一覧

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
- `状態`: ステータスまたは Issue state
- `body`: Issue 本文（説明）
- `AC 本文`: body 内の受入基準
- `labels`: ラベル一覧

## エラー時の表示

| 状況                              | 表示                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| search 対象外 Entity              | `search is not supported for <Entity>: single-instance by business rule. Use find instead.` |
| Retrospective 未実装              | `Retrospective: not yet implemented in gateway layer`                                       |
| 検索0件                           | `該当する<EntityType>が見つかりませんでした`                                                |
| code不明（find で itemId 未指定） | `INVALID_INPUT: find for <Entity> requires itemId (Issue number)`                           |
| 不明な EntityType / operation     | `INVALID_INPUT: ...`                                                                        |

- エラー時は `success: false` とエラーメッセージを提示し、必要に応じて対話手順をやり直す

## EntityType 一覧

下表は
[input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
の「EntityType 一覧と対応操作」を**正**とする（二重管理を避けるため、詳細な対応表は input-schema.md
側に集約）。個別の対応関係・params キー・実行例は必ず input-schema.md を参照する。

要点のみ:

- **search 対象外**（単一インスタンス）: Vision / ProductGoal
- **Sprint search**: state 指定（open / closed / all）でスプリント一覧を解決できる
- **未実装**（Gateway 未登録）: Retrospective
- **検索・閲覧とも不可**: Scope
