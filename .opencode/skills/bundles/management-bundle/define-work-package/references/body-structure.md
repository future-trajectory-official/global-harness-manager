# WP Body 推奨構造

Work Package（WP）の Issue 本文（Body）に、受入基準（AC）とその達成エビデンスを 1
か所で対応づけて記述するための推奨構造を定義する。

> **位置づけ**
>
> - WP の状態・effort・順序の正は Project V2 の構造化フィールドであり、Body
>   は人間可読の補助表現である。
> - ただし AC の完了判定（`complete-work-package`）は Body の AC
>   行を読むため、本ドキュメントの書式を守ること。

## 推奨構造

```markdown
## Acceptance Criteria

- [ ] AC1: <AC の概要（検証可能な完了条件）>
  - エビデンス: <検証手段と結果（実行コマンド・出力の要点・確認日）>
- [ ] AC2: <AC の概要（検証可能な完了条件）>
  - エビデンス: <検証手段と結果（実行コマンド・出力の要点・確認日）>
```

AC の概要だけを並べず、**各 AC の直下にエビデンスをネストする**。これにより、
「何を満たす約束をしたか」と「どう満たしたか」が同じ行のまとまりで読める。

## 生成と更新の責務

| タイミング | 実行者                  | Body への操作                                                                       |
| ---------- | ----------------------- | ----------------------------------------------------------------------------------- |
| WP 作成    | `define_wp.ts`          | 見出し・AC 行・エビデンス行（`- エビデンス: （未記入）`）をプレースホルダとして生成 |
| 実装中     | セッション（AI）        | エビデンスのプレースホルダを実値で置換する                                          |
| WP 完了    | `complete-work-package` | 対象 AC 行のチェックを `[x]` へ更新する                                             |
| WP 改訂    | `revise`                | **本文を全置換**するため、エビデンス行は再記入が必要                                |

> **実装状況**: 現行の `formatWpBody()` は AC 行のみを生成する。エビデンス行のプレースホルダ生成は
> WP #881 で実装する目標仕様であり、それまでの間はセッションがエビデンス行を追記する。

## 記述規則

- **見出し**: `## Acceptance Criteria` を推奨する。AC 行の判定は見出しに依存しないが、
  生成器の出力に揃えるため固定する。
- **AC 行**: `- [ ] AC{n}: {概要}` を推奨する。受理される書式の正は
  [complete-work-package のリファレンス](/.opencode/skills/bundles/management-bundle/complete-work-package/references/reference.md#ac行の書式)
  を参照すること。番号省略（`AC: {概要}`）も受理される（`management.md` §5.1 の形式）。
- **不受理の書式**: `AC-1:`（ハイフン区切り）や `AC 1:`（空白区切り）は AC 行として判定されない。AC
  行が 0 件になると完了処理が失敗するため使わないこと。
- **エビデンス行**: AC 行の直下に**空白 2 文字でインデント**し、`- エビデンス:` で始める。
- **採番への影響**: AC 行の判定は行頭の空白を許容する。エビデンス行や入れ子リストに `- [ ]` /
  `- [x]` と `AC{n}:` を併記してはならない（AC 行として数えられ、完了処理の対象になる）。
- **再現可能性**: エビデンスは第三者が追試できる粒度で書く。実行コマンド、期待結果、
  確認日、出力の要点を含める。「確認済み」「対応した」だけの記述にしない。
- **AC との対応**: 1 AC につき 1 エビデンス行を基本とする。複数行に分ける場合も、対象 AC
  行の直後にまとめてネストする。
- **チェックの更新**: 完了時に手動で `[x]` にせず、`complete-work-package` に更新させる。

## 記述例

```markdown
## Acceptance Criteria

- [ ] AC1: 新規 WP の本文が AC＋エビデンス形式で生成される
  - エビデンス: `deno task test` の該当テストが green（2026-11-07、`define_wp_test.ts`）
- [ ] AC2: `deno task qa` が全通過する
  - エビデンス: `deno task qa` → exit 0、全件 passed（2026-11-07）
```

## 関連

- WP 作成・見積り・確定の入力仕様:
  [reference.md](/.opencode/skills/bundles/management-bundle/define-work-package/references/reference.md)
- AC 行の受理書式と ✅化の挙動:
  [complete-work-package のリファレンス](/.opencode/skills/bundles/management-bundle/complete-work-package/references/reference.md#ac行の書式)
