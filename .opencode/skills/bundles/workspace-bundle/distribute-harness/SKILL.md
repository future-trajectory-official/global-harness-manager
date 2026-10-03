---
name: distribute-harness
description: .opencode配下のハーネス資源を全量配布する（COPY_DIRS 5dirs＋context 2件＋deno.json＋AGENTS.md、global-リネーム付き）。
tags:
  trigger:
    - distribute-harness
    - share-harness
    - onboarding-harness
  category: onboarding
  constraints: none
---

# distribute-harness

`.opencode/` 配下のハーネス資源を配布先ルート（既定 `~/.harness`）へ全量配布する。
構造保持コピー＋スキル `global-` リネーム＋参照書換を一括実行する。

## Quick-Start

```bash
SCRIPT=.opencode/skills/bundles/workspace-bundle/distribute-harness/scripts/distribute-harness.ts
deno run -A "$SCRIPT" --dry-run
deno run -A "$SCRIPT" --dest ~/.harness
```

> [!NOTE]
> `deno.json` の正はリポジトリ root 版であり、配布先では `<dest>/deno.json` と同一になる
> （`.opencode/deno.json` は配布しない）。詳細は
> [deno-json-authority.md](references/deno-json-authority.md) を参照。

## 位置づけ

- 全量配布（本スキル）: `.opencode/` 配下の資源全体を配布先へ一括複写し、スキル名へ `global-`
  接頭辞を付与して参照を書き換える。初回導入・全体再配布はこちらを使う。 実配布の後に配布先
  `<dest>/skills/bundles/workspace-bundle/` を削除する （全量配布＋配布後除外が正規手順）。

workspace-bundle のスキルは `.opencode/commands/project-setup.md`
で完結し、他リポジトリ側から呼ぶことを想定していない。
配布先に残すと不要スキルのグローバル化・誤実行・スキルリスト肥大を招くため、 配布後に除外する。

配布対象は [copy-plan.md](references/copy-plan.md)、リネーム規則は
[rename-rule.md](references/rename-rule.md)、deno.json の正本と制約は
[deno-json-authority.md](references/deno-json-authority.md) を参照。

## 前提条件

- CWD がリポジトリ root であること（実装は `.opencode` を CWD 基準の相対パスで解決する）。
- 配布元 `.opencode/` が存在すること。
- 本番配布の前に必ず `--dry-run` で計画を確認すること。
- 配布先の事前バックアップを確認すること。
- 配布先が dirty な git リポジトリでないこと（または `--force` 指定）。

## 全量配布手順

1. 配布先の安全性を確認する（`ensureDestSafe`。git dirty の場合は中断、`--force` で無視可）。
2. 配布計画を確認する（`--dry-run` で書込みなし。コピー 9 件の計画が出ることを確認する）。
3. リネーム計画を先に検証する（`buildRenameMap`。重複は fail-fast で中断するため、`--dry-run`
   で重複エラーが出た場合は配布元のスキル名を修正して再実行する）。
4. コピー計画を実行する（`executeCopyPlan`）。
5. スキルを `global-` リネームし（`applyRenameMap`）、frontmatter と参照を書き換える
   （`rewriteSkillFrontmatter`・`rewriteReferences`・`rewriteSkillImports`）。
6. 実配布の後に配布先 `<dest>/skills/bundles/workspace-bundle/` を削除する（既定 `<dest>` は
   `~/.harness`）。本体スクリプトは改修せず、手順として事後除外する。

```bash
rm -rf <dest>/skills/bundles/workspace-bundle
```

実行順序は `ensureDestSafe` → `--dry-run` 確認 → `buildRenameMap` 検証 → `executeCopyPlan` →
`applyRenameMap`・参照書換 → 配布後除外 （`<dest>/skills/bundles/workspace-bundle`
削除）の順とする。

## 合否基準

### `--dry-run` の期待出力

- コピー計画が 9 件であること（`buildCopyPlan` の出力。内訳は
  [copy-plan.md](references/copy-plan.md) の表のとおり）。
- `deno.json` の計画が 1 件含まれること（`<repoRoot>/deno.json` → `<dest>/deno.json`）。
- 除外物（`node_modules`・`deno.lock`・利用者編集 `context/product.md` 等）が 計画に含まれないこと。

### 完了後の照合

- `<dest>/skill-rename-map.json` に適用マップが登録されていること。
- 配布先各スキルの frontmatter `name:` がディレクトリ名（`global-<name>`）と一致すること。
- 配布先 `<dest>/deno.json` がリポジトリ root 版と同一内容であること。
- `<dest>/skills/bundles/workspace-bundle` が存在しないこと（配布後除外済みであること）。
- `<dest>/skills/bundles/` 配下に他 bundle（`management-bundle` 等）が残存していること。

## 配布後検証手順（配布先での確認。実装本体の改変なし）

```bash
# 1. `.opencode/` 参照の残存なし（ゼロ件であること）
rg '\.opencode/' "<dest>"
# 2. 未リネームのスキル呼出の残存なし（ゼロ件であること）
rg '\[skill:(?!global-)' "<dest>"
# 3. frontmatter name とディレクトリ名の照合（差分なしであること）
for f in "<dest>"/skills/bundles/*/*/SKILL.md; do
  dir=$(basename "$(dirname "$f")")
  name=$(sed -n 's/^name:[[:space:]]*//p' "$f" | head -n 1)
  [ "$dir" = "$name" ] || echo "MISMATCH: $f (dir=$dir name=$name)"
done
# 4. 利用者編集 context/product.md が上書きされていないこと（差分なしであること）
diff <backup>/context/product.md "<dest>/context/product.md"
# 5. workspace-bundle が除外され、他 bundle が残存していること
test ! -e "<dest>/skills/bundles/workspace-bundle" && echo "OK: workspace-bundle absent"
ls "<dest>/skills/bundles"
# 6. 退役スキル global-publish-harness-rules／global-publish-harness-skills が配布先に残留していないこと（残留時は手動削除）
```

配布仕様では利用者編集 `context/product.md` を配布しない（`.example` のみ配布する）ため、手順 4
では事前バックアップとの差分がないことをもって上書きなしと判定する。手順 5 では
`test ! -e "<dest>/skills/bundles/workspace-bundle"`
が成功（不存在）し、`ls "<dest>/skills/bundles"` に `management-bundle`
等が残存していることをもって除外成功と判定する。配布先での `deno task qa`
実行不能制約は既知の制約であり、接続検証は次工程に申し送る。 詳細は
[deno-json-authority.md](references/deno-json-authority.md) を参照。

## 証跡テンプレート

```text
- 配布先: <dest>
- workspace-bundle 不存在: OK / NG (`test ! -e <dest>/skills/bundles/workspace-bundle`)
- 他 bundle 残存: OK / NG (`ls <dest>/skills/bundles` に management-bundle 等あり)
- rename-map 登録: OK / NG (<dest>/skill-rename-map.json あり)
- frontmatter 照合: 差分なし / あり
- deno.json 同一: OK / NG
```
