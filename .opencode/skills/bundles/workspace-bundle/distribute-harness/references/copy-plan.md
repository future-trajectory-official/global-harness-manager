# 配布対象・除外対象一覧

`distribute-harness.ts` の `buildCopyPlan` に対応する計画定義。方針は include 方式（`buildCopyPlan`
の JsDoc 参照）：コピー対象を明示列挙し、除外対象は計画に含めない。事後削除は行わない。

## コピー対象（7エントリ）

| # | src                                   | dest               | kind | 根拠                           |
| - | ------------------------------------- | ------------------ | ---- | ------------------------------ |
| 1 | `.opencode/skills`                    | `<dest>/skills`    | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 2 | `.opencode/core`                      | `<dest>/core`      | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 3 | `.opencode/agents`                    | `<dest>/agents`    | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 4 | `.opencode/commands`                  | `<dest>/commands`  | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 5 | `.opencode/guides`                    | `<dest>/guides`    | dir  | `buildCopyPlan`（`COPY_DIRS`） |
| 6 | `<repoRoot>/deno.json`                | `<dest>/deno.json` | file | `buildCopyPlan`                |
| 7 | `<repoRoot>/config/AGENTS.md.example` | `<dest>/AGENTS.md` | file | `buildCopyPlan`                |

旧 #6（`context/management.md`）・旧 #7（`context/product.md.example`）は WP
#791・B案で配布廃止のため削除。 復活時は本表と `buildCopyPlan` を同時に戻すこと。

`COPY_DIRS` 定義：`["skills", "core", "agents", "commands", "guides"]`。 `context/` は配布対象外。
グローバル配置（本repo `.github/context/` → `~/.harness/context/` への
management.md＋product.md.example
の2件コピー）は配布コピーとは別枠の手順（SKILL.md「グローバル配置手順」参照）で行う。 `deno.json`
はリポジトリ root 版が単一の正である。 `AGENTS.md` は `config/AGENTS.md.example`
をリネームして配布する。

`skills/` 配下のテスト補助ファイル（`*_test.ts` 等）もディレクトリ単位コピーのため
配布される。これは全量配布の意図通りである。

## 除外対象（計画に含めない）

`buildCopyPlan` の JsDoc の列挙に対応：

- `node_modules/`・`deno.lock`・`package*.json`
- `.local/`・`.session/`・`coverage/`・`cov_profile/`・`.log`・`tmp/`
- `config/` 実体（`AGENTS.md.example` 以外は配布しない）
- `opencode.json`・`opencode.jsonc`
- `context/` 全件（WP #791・B案で配布廃止。`management.md`・`product.md.example`・利用者編集
  `product.md` を含む）

## 実行順序

`main`：`ensureDestSafe` → `collectSkills` → `buildRenameMap`（重複は fail-fast）→ `executeCopyPlan`
→ `applyRenameMap` → `writeRenameMap` → `rewriteSkillFrontmatter` → `rewriteReferences` →
`rewriteSkillImports`。グローバル配置（本repo `.github/context/` → `<dest>/context/`
への2件コピー）は配布コピーとは別枠の手順として SKILL.md 手順7で実施する。
