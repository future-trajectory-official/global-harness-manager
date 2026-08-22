# define-work-package リファレンス

## 業務概要

スプリントに確定したPBIに対して、開発単位であるWork Package（WP）を作成し、初期見積りを記録する。
各WPは親PBIのsub-issueとしてSprint Boardに追加される。

## 識別子（identifier）の指定方法

各操作の入力で使用する `id` と `code` は以下の意味を持つ。

| キー   | 意味                               | 例                         |
| ------ | ---------------------------------- | -------------------------- |
| `id`   | GitHub node-id（グローバル識別子） | `I_kwDOR5-zI88AAAABMQS-Ag` |
| `code` | リポジトリ内識別子（Issue番号等）  | `660`                      |

- `code` には **Issue番号** を指定する。既存項目の操作は `code` を主キーとして実行される。
  Gateway層が `code` から node-id を内部解決して ProjectV2 フィールド等の操作を行う。
- `id` には **node-id** を指定してもよい。作成操作（`define_wp.ts`）の戻り値 `nodeId`
  から取得できる。 ただし `id` を渡しても `code`
  からの内部解決ステップは省かれない（パフォーマンスやAPI制限に
  問題が出るまで実装変更は行わない方針）。
- **node-id を取得していない場合**: `code`（Issue番号）だけで実行可能。`id` には仮の値（例:
  `"unknown"`）を指定してよい（保険的用法）。ワークフロー手順どおりに進めば、 作成時に node-id
  を取得済みであることが前提。

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

| パラメータ  | 型                        | 必須 | 説明                                                |
| ----------- | ------------------------- | ---- | --------------------------------------------------- |
| `wpTitle`   | `string`                  | 必須 | WPのタイトル                                        |
| `parentPbi` | `{title, id, code}`       | 必須 | 親PBIの識別子。`id` は node-id、`code` は Issue番号 |
| `acItems`   | `[{number, description}]` | 必須 | ACリスト（最低1件）。各ACに番号と説明を指定         |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"wpTitle":"Implement login UI","parentPbi":{"title":"Login feature","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/define_wp.ts --dry-run

# 本実行
echo '{"wpTitle":"Implement login UI","parentPbi":{"title":"Login feature","id":"I_kwDOR5-zI88AAAABMOdNyg","code":"655"},"acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/define_wp.ts
```

---

## estimate_wp_initial_effort.ts — 初期見積り

WPの計画前effort見積り（initialEstimate）を記録する。

### 入力パラメータ

| パラメータ        | 型                  | 必須 | 説明                                                                                                              |
| ----------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `identifier`      | `{title, id, code}` | 必須 | WPの識別子。`id` は node-id、`code` は Issue番号。node-id 未取得時は `code` のみで解決可能（`id` には仮値を指定） |
| `initialEstimate` | `number`            | 必須 | 0以上の見積り値（介入回数）                                                                                       |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Implement login UI","id":"I_kwDOR5-zI88AAAABMQS-Ag","code":"660"},"initialEstimate":5}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/estimate_wp_initial_effort.ts --dry-run

# 本実行
echo '{"identifier":{"title":"Implement login UI","id":"I_kwDOR5-zI88AAAABMQS-Ag","code":"660"},"initialEstimate":5}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/estimate_wp_initial_effort.ts
```

---

## commit_wp.ts — WPコミット

WPのステータスを Idea→Todo に進行し、スプリントに確定する。

### 入力パラメータ

| パラメータ     | 型                  | 必須 | 説明                                                                                                              |
| -------------- | ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `identifier`   | `{title, id, code}` | 必須 | WPの識別子。`id` は node-id、`code` は Issue番号。node-id 未取得時は `code` のみで解決可能（`id` には仮値を指定） |
| `sprintNumber` | `number`            | 必須 | 確定先スプリント番号                                                                                              |

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Implement login UI","id":"I_kwDOR5-zI88AAAABMQS-Ag","code":"660"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/commit_wp.ts --dry-run

# 本実行
echo '{"identifier":{"title":"Implement login UI","id":"I_kwDOR5-zI88AAAABMQS-Ag","code":"660"},"sprintNumber":19}' | deno run -A .agents/skills/bundles/management-bundle/define-work-package/scripts/commit_wp.ts
```
