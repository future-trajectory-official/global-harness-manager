# deno.json 正本と配布時の書換え

## 正本はリポジトリ root 版

- 配布する `deno.json` はリポジトリ root 版（単一の正）である （実装冒頭の JsDoc・`buildCopyPlan` の
  `deno.json` エントリ参照）。
- 配布時は `<repoRoot>/deno.json` を `<dest>/deno.json` へコピーした上で、 dest 用に tasks
  を書き換える（`rewriteDenoJsonTasks`）。
  - `core/` 系参照（`.opencode/core/`）→ dest 相対（`core/`）。
  - skills 系参照（`.opencode/skills/bundles/<bundle>/<name>/`）→ 配布名基準の
    `skills/bundles/<bundle>/global-<name>/`。
  - 書換えは冪等であり、JSONC のコメント・整形を温存する。
- `import map` の `@std/*` はパス非依存のため書換え対象外である。

## 除外設定の動作

- root `deno.json` の `exclude` は `.opencode/node_modules` のみ。
- `fmt.exclude` は `.opencode/agents` と `.opencode/commands`（YAML frontmatter 保持のため）。
- 配布計画自体が include 方式のため、`node_modules`・`deno.lock`・`coverage` 等は
  計画に含まれず配布先へ到達しない（[copy-plan.md](copy-plan.md) 参照）。

## 配布先での検証

- 配布先 `<dest>/deno.json` は root 版と同一内容ではなく、dest 用に tasks を書き換えた内容になる。
- 配布物の正しさは配布前の repo 側 `deno task qa`
  と書換え処理の単体テスト（`distribute-harness_test.ts` の `rewriteDenoJsonTasks`
  系8件。core参照のdest相対化・skills参照のglobal-化・未知パスの素通り・再適用の冪等・JSONC温存を含む）で保証する。配布先は決定的コピーのため、配布後の
  qa 実行は行わない。
- 配布時の確認は `--dry-run` のコピー計画確認と再配布ログの `Rewrote deno.json tasks: <path>`
  で行う。
