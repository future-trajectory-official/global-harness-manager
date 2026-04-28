---
name: publish-harness-rules
description: ワークスペース内のルールを定義に基づき、指定の他プロジェクトへ同期・コピーします。
---

# publish-harness-rules

管理されている共有ルール（`.agents/rules/*.md`）を、ターゲットプロジェクトへと安全に同期します。

## 機能

- `config/publish-rules-targets.md` に基づく複数プロジェクトへの一括配信。
- 配布先でのディレクトリ自動生成と Git 保護設定。

## 実行方法

1. `config/publish-rules-targets.md` を編集。
2. スクリプトを実行。

```bash
deno run -A .agents/skills/publish-harness-rules/scripts/publish-rules.ts
```

> [!TIP]
> 設定ファイルの書き方は [target-config-format.md](references/target-config-format.md)
> を、Git保護の仕組みは [gitignore-protection.md](references/gitignore-protection.md)
> を参照してください。

## 前提要件

- `.agents/rules/` に配信対象のファイルが存在すること。
