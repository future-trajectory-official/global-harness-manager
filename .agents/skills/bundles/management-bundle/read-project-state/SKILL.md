---
name: read-project-state
description: プロジェクトの状態（PBI/WP/Epic/Feature等の一覧検索・詳細閲覧）を読み取る。
tags:
  trigger:
    - read-project-state
    - project-state
    - read-pbi
    - read-wp
  category: management
---

# read-project-state

POの問いかけに対して、プロダクトバックログの情報（エンティティ一覧・詳細）を GitHub Issue
から読み取り、一貫した形式で提示します。**読取専用**であり、状態の変更は行いません。

## 重要

- **読取専用**: 本スキルは情報の参照のみ。ステータス変更・編集・コメント投稿は一切行わない
- **入力JSONの組み立て**: 実行前に必ず
  [input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
  を参照してから組み立てる（AIの省略癖による壊れたJSON入力を防ぐ）
- **3層構造維持**: 直接 `gh` コマンドを呼ばず、`scripts/read_project_state.ts` を介して skill →
  domain → gateway の層を経由する

## 対話手順（3点提示方式）

POへの問いかけが曖昧な場合は、**必ず以下の3点を尋ねて**から実行する。

> **1:<何を>**（例: PBI / WP / Epic / Feature / Sprint / Review） **2:<探す|調べる>**
> **3:<どんな条件で>**（例: #42 / ステータス: Todo / キーワード: auth）

- 「**探す**」→ 一覧検索 `search`
- 「**調べる**」→ 詳細閲覧 `find`
- 回答から `entityType` / `operation` / `params` を一意に決定する
- **単一インスタンスEntity**（Vision / ProductGoal / Sprint）は search が対象外であることを
  案内し、find を案内する
- 例:「現在のPBIを教えて」→ 1:PBI / 2:探す / 3:状態が進行中のもの
- 例:「#42のWPのACを見せて」→ 1:WP / 2:調べる / 3:#42

## 手順

### 1. 操作の決定（3点提示方式）

- POに「1:<何を> 2:<探す|調べる> 3:<どんな条件で>」の3点を尋ねる
- 問いかけから `entityType` / `operation` / `params` を決定する
- パターン別の変換規則は
  [input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
  を参照

### 2. 実行

```bash
deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
```

- 標準入力に `<JSON>`（入力スキーマ形式）を渡す
- 入力JSONは必ず
  [input-schema.md](/.agents/skills/bundles/management-bundle/read-project-state/references/input-schema.md)
  のスキーマ・実行例を参照して組み立てる
- `entityType` は下記 EntityType 一覧から選ぶ

### 3. 結果の提示（チャット表示形式）

#### 一覧表示（search）の表示形式

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

#### 詳細表示（find）の表示形式

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

### 4. エラー時の表示

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

- **search 対象外**（単一インスタンス）: Vision / ProductGoal / Sprint
- **未実装**（Gateway 未登録）: Retrospective
- **検索・閲覧とも不可**: Scope
