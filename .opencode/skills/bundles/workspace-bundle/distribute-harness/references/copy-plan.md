# 配布対象・除外対象一覧

`distribute-harness.ts` の `buildCopyPlan` に対応する計画定義。方針は include 方式（`buildCopyPlan`
の JsDoc 参照）：コピー対象を明示列挙し、除外対象は計画に含めない。事後削除は行わない。

## コピー対象（9エントリ）

| # | src                                    | dest                                | kind | 根拠                           |
| - | -------------------------------------- | ----------------------------------- | ---- | ------------------------------ |
| 1 | `.opencode/skills`                     | `<dest>/skills`                     | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 2 | `.opencode/core`                       | `<dest>/core`                       | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 3 | `.opencode/agents`                     | `<dest>/agents`                     | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 4 | `.opencode/commands`                   | `<dest>/commands`                   | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 5 | `.opencode/guides`                     | `<dest>/guides`                     | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 6 | `.opencode/context/management.md`      | `<dest>/context/management.md`      | file | `buildCopyPlan`                |
| 7 | `.opencode/context/product.md.example` | `<dest>/context/product.md.example` | file | `buildCopyPlan`                |
| 8 | `<repoRoot>/deno.json`                 | `<dest>/deno.json`                  | file | `buildCopyPlan`                |
| 9 | `<repoRoot>/config/AGENTS.md.example`  | `<dest>/AGENTS.md`                  | file | `buildCopyPlan`                |

`COPY_DIRS` 定義：`["skills", "core", "agents", "commands", "guides"]`。 `context/` は丸ごとではなく
2 ファイルのみ明示コピーする。 `deno.json` はリポジトリ root 版が単一の正である。 `AGENTS.md` は
`config/AGENTS.md.example` をリネームして配布する。

`skills/` 配下のテスト補助ファイル（`*_test.ts` 等）もディレクトリ単位コピーのため
配布される。これは全量配布の意図通りである。

## 除外対象（計画に含めない）

`buildCopyPlan` の JsDoc の列挙に対応：

- `node_modules/`・`deno.lock`・`package*.json`
- `.local/`・`.session/`・`coverage/`・`cov_profile/`・`.log`・`tmp/`
- `config/` 実体（`AGENTS.md.example` 以外は配布しない）
- `opencode.json`・`opencode.jsonc`
- 利用者編集 `context/product.md`（`.example` のみ配布）

## 実行順序

`main`：`ensureDestSafe` → `collectSkills` → `buildRenameMap`（重複は fail-fast）→ `executeCopyPlan`
→ `applyRenameMap` → `writeRenameMap` → `rewriteSkillFrontmatter` → `rewriteReferences` →
`rewriteSkillImports`。
