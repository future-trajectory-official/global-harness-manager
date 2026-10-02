# deno.json 正本と配布制約

## 正本はリポジトリ root 版

- 配布する `deno.json` はリポジトリ root 版（単一の正）である （実装冒頭の JsDoc・`buildCopyPlan` の
  `deno.json` エントリ参照）。
- 実装は `<repoRoot>/deno.json` → `<dest>/deno.json` の file コピーである。
- root 版 tasks（`setup-hooks`・`validate-task`・`phase-gate`・`validate:jsdoc` 等）は
  `.opencode/...` を参照するため、フラットな配布先 `~/.harness/` では実行不能になる。`import map` の
  `@std/*` はパス非依存のため core 相対 import は解決される。

## 除外設定の動作

- root `deno.json` の `exclude` は `.opencode/node_modules` のみ。
- `fmt.exclude` は `.opencode/agents` と `.opencode/commands`（YAML frontmatter 保持のため）。
- 配布計画自体が include 方式のため、`node_modules`・`deno.lock`・`coverage` 等は
  計画に含まれず配布先へ到達しない（[copy-plan.md](copy-plan.md) 参照）。

## 接続検証への申送り

- 配布先での `deno task qa` 制約（上記パス参照の実行不能）は接続検証で顕在化する
  既知の制約であり、本配布の範囲外とする。
- 本スキルの配布検証は `--dry-run` のコピー計画確認までとし、配布先での qa 実行は
  次工程の接続検証に申し送る。
