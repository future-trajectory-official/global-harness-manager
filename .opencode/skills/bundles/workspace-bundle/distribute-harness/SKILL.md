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
deno run -A .opencode/skills/bundles/workspace-bundle/publish-harness-skills/scripts/distribute-harness.ts --dry-run
deno run -A .opencode/skills/bundles/workspace-bundle/publish-harness-skills/scripts/distribute-harness.ts --dest ~/.harness
```

> [!NOTE]
> `deno.json` の正はリポジトリ root 版であり、配布先では `dest/deno.json` と同一になる
> （`.opencode/deno.json` は配布しない）。詳細は
> [deno-json-authority.md](/.opencode/skills/bundles/workspace-bundle/distribute-harness/references/deno-json-authority.md)
> を参照。

> [!NOTE]
> ラップ対象スクリプトの現パスは
> `.opencode/skills/bundles/workspace-bundle/publish-harness-skills/scripts/distribute-harness.ts`
> である。WP#778 で `distribute-harness/scripts/` へ移設予定のため、本SKILL.md内の
> 実行コマンドは移設後に更新すること（申送り事項）。

## 全量配布手順

1. 配布計画を確認する（`--dry-run` で書込みなし）。
2. リネーム計画を先に検証する（重複は fail-fast で中断）。
3. コピー計画を実行する（COPY_DIRS 5dirs＋context 2件＋deno.json＋AGENTS.md）。
4. スキルを `global-` リネームし、frontmatter と参照を書き換える。
5. 配布先の安全性を確認する（git dirty の場合は中断、`--force` で無視可）。

> [!TIP]
> 詳細は Sidecar Reference を参照： 配布対象は
> [copy-plan.md](/.opencode/skills/bundles/workspace-bundle/distribute-harness/references/copy-plan.md)、
> リネーム規則は
> [rename-rule.md](/.opencode/skills/bundles/workspace-bundle/distribute-harness/references/rename-rule.md)、
> deno.json の正本と制約は
> [deno-json-authority.md](/.opencode/skills/bundles/workspace-bundle/distribute-harness/references/deno-json-authority.md)
> を参照してください。

## 前提条件

- 配布元 `.opencode/` が存在すること。
- 配布先が dirty な git リポジトリでないこと（または `--force` 指定）。
