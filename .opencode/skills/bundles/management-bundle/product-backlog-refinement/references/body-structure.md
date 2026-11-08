# PBI Body 推奨構造

Product Backlog Item（PBI）の Issue 本文（Body）に、概要・成果物・証明方法を
記述するための推奨構造を定義する。

> **位置づけ**
>
> - PBI の状態・サイズ・effort 集計・乖離分析の正は Project V2 の構造化フィールドであり、Body
>   は人間可読の補助表現である。
> - 本文は `propose_pbi.ts` / `update_pbi.ts`
>   が入力値から生成する。手書きする場合も同じ形に揃えること。

## 推奨構造

```markdown
## Summary

<概要: 背景・課題・達成したい状態>

## Artifacts

### <成果物分類 1>

- <成果物 1-1 の概要>
- <成果物 1-2 の概要>

### <成果物分類 2>

- <成果物 2-1 の概要>

## Proof Method

<検証方法: 子 WP の AC を何で確かめるか>
```

## 生成と更新の責務

| タイミング | 実行者           | Body への操作                                                           |
| ---------- | ---------------- | ----------------------------------------------------------------------- |
| PBI 発案   | `propose_pbi.ts` | 新規 Issue を作成する（`summary` / `artifacts` / `proofMethod`）        |
| PBI 更新   | `update_pbi.ts`  | **本文を全置換**する。未指定の `artifacts` / `proofMethod` は削除される |

> **注意**: `update_pbi.ts` は更新操作（`revise`）であり、`propose_pbi.ts` のような
> 新規作成は行わない。既存 PBI の分類＋項目の 2 階層を保ったまま更新する手段は
> 現行スクリプトには無い（`update_pbi.ts` の `artifacts` は分類名のみを出力する）。

### 入力と Body の対応

| Body セクション   | 入力キー                        | 型                                               | 必須 |
| ----------------- | ------------------------------- | ------------------------------------------------ | ---- |
| `## Summary`      | `summary`                       | `string`                                         | 必須 |
| `## Artifacts`    | `artifacts`（`propose_pbi.ts`） | `{categories: [{name, items: [{description}]}]}` | 任意 |
| `## Artifacts`    | `artifacts`（`update_pbi.ts`）  | `string[]`（各文字列が分類名になる）             | 任意 |
| `## Proof Method` | `proofMethod`                   | `string`                                         | 任意 |

`update_pbi.ts` は Body のキーに加えて `identifier` と `reason` が必須である。入力の詳細は
[reference.md](/.opencode/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md)
を参照すること。

## 記述規則

- **見出しと順序**: `## Summary` → `## Artifacts` → `## Proof Method` の順に固定する。
- **セクションの省略**: `propose_pbi.ts` は未指定のセクションを出力しない。一方 `update_pbi.ts`
  は本文を全置換するため、未指定のセクションは「省略」ではなく **削除**される。既存内容を残す場合は
  `artifacts` / `proofMethod` を必ず再指定する。
- **Summary**: 背景 → 課題 → 達成したい状態が読み取れるように書く。1〜3 段落を目安とする。
- **Artifacts**: 分類（`### <分類名>`）→ 項目（`- <概要>`）の 2 階層で書く。
  分類名は成果物の種類（例: 実装 / 文書 / テスト）とし、項目は「何を作るか」を 1 行で示す。
  分類は入れ子リストではなく見出しで表す（現行実装の出力に合わせる）。
- **Proof Method**: 完了を何で確かめるかを検証可能な形で書く。対象は**子 WP の AC** であり、例:
  「`deno task qa` が全通過」「新規 WP の本文が AC＋エビデンス形式であること」。子 WP
  が複数ある場合は、どの AC をどの手段で確かめるかが追えるようにする。
- **Body は補助表現**: サイズ・状態・effort の判断は Project V2 フィールドを正とし、Body
  に重複して構造化データを持たせない。

## 記述例

```markdown
## Summary

WP 本文の生成テンプレートを AC＋エビデンス形式に統一し、子 WP の完了時に「何をどう確かめたか」を
本文から読み取れるようにする（Sprint 30 以前の既存 WP の是正は対象外）。

## Artifacts

### 実装

- WP 本文生成テンプレートの変更とテスト更新

### 文書

- Body 推奨構造をスキル references に再配置

## Proof Method

新規作成した WP の本文が AC＋エビデンス形式であること。`deno task qa` の全通過。
```

## 関連

- PBI 発案・更新の入力仕様:
  [reference.md](/.opencode/skills/bundles/management-bundle/product-backlog-refinement/references/reference.md)
- PBI の深掘り手順:
  [pbi-deep-dive.md](/.opencode/skills/bundles/management-bundle/product-backlog-refinement/references/pbi-deep-dive.md)
