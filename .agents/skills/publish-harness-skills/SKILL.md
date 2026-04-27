---
name: publish-harness-skills
description: ワークスペース内のスキルをグローバルディレクトリへ同期・公開します。
---

# publish-harness-skills

プロジェクトの `.agents/skills/` 配下にあるローカルスキルを、指定されたグローバルディレクトリへ安全に同期します。

## 主な機能
- `config/publish-targets.md` に基づく選択的同期。
- `rsync` による差分更新と、`.gitignore` に基づく不要ファイルの見逃し。

## 使用方法
1. `config/publish-targets.md` を編集（`## ` でスキルを指定）。
2. スクリプトを実行。
```bash
deno run -A .agents/skills/publish-harness-skills/scripts/publish-skills.ts
```

> [!TIP]
> 設定ファイルの書き方は [target-config-format.md](references/target-config-format.md) を、同期ロジックの詳細は [sync-logic.md](references/sync-logic.md) を参照してください。
## 前提条件
- `config/global-skills-path.txt` が正しく設定されていること。
