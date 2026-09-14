# begin-sprint リファレンス

## 業務概要

新しいスプリントの枠組みを作成し、ゴールを設定する。

- Phase 1: スプリント番号を確定し、スプリントの枠組みを作成する
- Phase 2: 作成したスプリントにゴールを設定する

## Phase 1: スプリント番号の確定

スプリント番号は、`read-project-state` スキルで現在のスプリント状況を確認して確定する。
ローカルファイルの推測ではなく、GitHub 上の実体（スプリント一覧）を参照すること。

### read-project-state への入力JSON

```json
{
  "entityType": "Sprint",
  "operation": "search",
  "params": { "state": "<状態>" }
}
```

`params.state` には以下のいずれかを指定する。

| 状態     | 指定値   | 用途                             |
| -------- | -------- | -------------------------------- |
| 進行中   | `open`   | 進行中のスプリント一覧を確認する |
| 完了済み | `closed` | 完了済みスプリント一覧を確認する |
| すべて   | `all`    | 全スプリントを確認する           |

### 実行例

```bash
# 進行中のスプリントを確認する
echo '{"entityType":"Sprint","operation":"search","params":{"state":"open"}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts

# 完了済みスプリントの一覧を確認する
echo '{"entityType":"Sprint","operation":"search","params":{"state":"closed"}}' | deno run -A .agents/skills/bundles/management-bundle/read-project-state/scripts/read_project_state.ts
```

### 確定の考え方

- 完了済み一覧の最上位が最新の完了済みスプリント。その次の番号を次のスプリント番号とする。
- 進行中スプリントが存在する場合は、そちらを優先してPOに確認する。
- 確定した番号をPOに提示し、承認を得る。

## Phase 1: begin_sprint.ts への入力JSON

```json
{
  "sprintNumber": <スプリント番号>
}
```

## Phase 2: begin_sprint.ts への入力JSON

```json
{
  "sprintNumber": <スプリント番号>,
  "goal": "<スプリントゴール文>"
}
```

## スクリプト呼出パターン

```bash
# dry-run: 実行Planを確認する
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts --dry-run

# 実実行
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/begin-sprint/scripts/begin_sprint.ts
```
