# 配布対象・除外対象一覧

`distribute-harness.ts` の `buildCopyPlan`（L61-93）に対応する計画定義。 方針は include
方式（L52-56）：コピー対象を明示列挙し、除外対象は計画に含めない。 事後削除は行わない。

## コピー対象（9エントリ）

| # | src                                    | dest                                | kind | 根拠行                    |
| - | -------------------------------------- | ----------------------------------- | ---- | ------------------------- |
| 1 | `.opencode/skills`                     | `<dest>/skills`                     | dir  | L63-69（`COPY_DIRS` L26） |
| 2 | `.opencode/core`                       | `<dest>/core`                       | dir  | L63-69（`COPY_DIRS` L26） |
| 3 | `.opencode/agents`                     | `<dest>/agents`                     | dir  | L63-69（`COPY_DIRS` L26） |
| 4 | `.opencode/commands`                   | `<dest>/commands`                   | dir  | L63-69（`COPY_DIRS` L26） |
| 5 | `.opencode/guides`                     | `<dest>/guides`                     | dir  | L63-69（`COPY_DIRS` L26） |
| 6 | `.opencode/context/management.md`      | `<dest>/context/management.md`      | file | L71-75                    |
| 7 | `.opencode/context/product.md.example` | `<dest>/context/product.md.example` | file | L76-80                    |
| 8 | `<repoRoot>/deno.json`                 | `<dest>/deno.json`                  | file | L81-86                    |
| 9 | `<repoRoot>/config/AGENTS.md.example`  | `<dest>/AGENTS.md`                  | file | L87-91                    |

`COPY_DIRS` 定義（L26）：`["skills", "core", "agents", "commands", "guides"]`。 `context/`
は丸ごとではなく 2 ファイルのみ明示コピー（L70 コメント）。 `deno.json` はリポジトリ root
版が単一の正（L16-20、L81-86）。 `AGENTS.md` は `config/AGENTS.md.example`
をリネームして配布（L87-91）。

## 除外対象（計画に含めない）

L52-56 の列挙に対応：

- `node_modules/`・`deno.lock`・`package*.json`
- `.local/`・`.session/`・`coverage/`・`cov_profile/`・`.log`・`/tmp/`
- `/config/` 実体（`AGENTS.md.example` 以外は配布しない）
- `/opencode.json`・`/opencode.jsonc`
- 利用者編集 `context/product.md`（`.example` のみ配布）

## 実行順序

`main`（L414-461）：`collectSkills`（L440）→ `buildRenameMap`（L441、重複は fail-fast）→
`executeCopyPlan`（L444）→ `applyRenameMap`（L447）→ `writeRenameMap`（L448）→
`rewriteSkillFrontmatter`（L453）→ `rewriteReferences`（L454）→ `rewriteSkillImports`（L455）。
