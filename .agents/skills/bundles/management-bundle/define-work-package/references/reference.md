# define-work-package リファレンス

## 業務概要

スプリントに確定したPBIに対して、開発単位であるWork Package（WP）を作成し、初期見積りを記録する。
各WPは親PBIのsub-issueとしてSprint Boardに追加される。

## 操作一覧

| 操作       | スクリプト                      | ユースケース                          |
| ---------- | ------------------------------- | ------------------------------------- |
| WP作成     | `define_wp.ts`                  | 親PBIに紐付くWPを作成＋AC設定         |
| 初期見積り | `estimate_wp_initial_effort.ts` | WPに計画前effort見積りを記録          |
| WPコミット | `commit_wp.ts`                  | WPをIdea→Todoに進行しスプリントへ確定 |

---

## define_wp.ts — WP作成

親PBIのsub-issueとしてWPを作成し、Sprint Boardに追加する。AC（受入基準）も同時に設定する。

### 入力パラメータ

| パラメータ  | 型                        | 必須 | 説明                                        |
| ----------- | ------------------------- | ---- | ------------------------------------------- |
| `wpTitle`   | `string`                  | 必須 | WPのタイトル                                |
| `parentPbi` | `{title, id, code}`       | 必須 | 親PBIの識別子。`id` は必須（Issue番号）     |
| `acItems`   | `[{number, description}]` | 必須 | ACリスト（最低1件）。各ACに番号と説明を指定 |

### 実行例

```bash
# dry-run
echo '{"wpTitle":"Implement login UI","parentPbi":{"title":"Login feature","id":"42","code":"42"},"acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/define_wp.ts --dry-run

# 本実行
echo '{"wpTitle":"Implement login UI","parentPbi":{"title":"Login feature","id":"42","code":"42"},"acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/define_wp.ts
```

---

## estimate_wp_initial_effort.ts — 初期見積り

WPの計画前effort見積り（initialEstimate）を記録する。

### 入力パラメータ

| パラメータ        | 型                  | 必須 | 説明                      |
| ----------------- | ------------------- | ---- | ------------------------- |
| `identifier`      | `{title, id, code}` | 必須 | WPの識別子。`id` は必須   |
| `initialEstimate` | `number`            | 必須 | 0以上の見積り値（人日等） |

### 実行例

```bash
# dry-run
echo '{"identifier":{"title":"Implement login UI","id":"42","code":"42"},"initialEstimate":5}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/estimate_wp_initial_effort.ts --dry-run

# 本実行
echo '{"identifier":{"title":"Implement login UI","id":"42","code":"42"},"initialEstimate":5}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/estimate_wp_initial_effort.ts
```

---

## commit_wp.ts — WPコミット

WPのステータスを Idea→Todo に進行し、スプリントに確定する。

### 入力パラメータ

| パラメータ     | 型                  | 必須 | 説明                    |
| -------------- | ------------------- | ---- | ----------------------- |
| `identifier`   | `{title, id, code}` | 必須 | WPの識別子。`id` は必須 |
| `sprintNumber` | `number`            | 必須 | 確定先スプリント番号    |

### 実行例

```bash
# dry-run
echo '{"identifier":{"title":"Implement login UI","id":"42","code":"42"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/commit_wp.ts --dry-run

# 本実行
echo '{"identifier":{"title":"Implement login UI","id":"42","code":"42"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/commit_wp.ts
```
