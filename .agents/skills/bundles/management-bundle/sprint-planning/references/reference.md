# sprint-planning リファレンス

## 業務概要

プロダクトバックログリファインメントで確定したPBIをスプリントにコミットする。 PBIのステータスを
Idea→Todo に進行し、スプリントバックログとして確定する。

## 操作一覧

| 操作        | スクリプト      | ユースケース              |
| ----------- | --------------- | ------------------------- |
| PBIコミット | `commit_pbi.ts` | PBIをスプリントに確定する |

---

## commit_pbi.ts — PBIコミット

PBIのステータスを Idea→Todo に進行し、指定スプリントに確定する。

### 入力パラメータ

| パラメータ     | 型                  | 必須 | 説明                     |
| -------------- | ------------------- | ---- | ------------------------ |
| `identifier`   | `{title, id, code}` | 必須 | PBIの識別子。`id` は必須 |
| `sprintNumber` | `number`            | 必須 | 確定先スプリント番号     |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Implement login","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/sprint-planning/scripts/commit_pbi.ts --dry-run

# 本実行
echo '{"identifier":{"title":"Implement login","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/sprint-planning/scripts/commit_pbi.ts
```
