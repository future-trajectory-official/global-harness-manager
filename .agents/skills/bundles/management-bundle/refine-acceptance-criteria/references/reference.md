# refine-acceptance-criteria リファレンス

## 業務概要

開発完了の検証条件として、PBI配下の全WPに対して受入基準（Acceptance Criteria）を一括定義・更新する。
各WPのACは開発の完了条件として機能する。

## 操作一覧

| 操作       | スクリプト                         | ユースケース                    |
| ---------- | ---------------------------------- | ------------------------------- |
| AC一括定義 | `define_wp_acceptance_criteria.ts` | PBI配下の全WPへACを一括書き込み |

---

## define_wp_acceptance_criteria.ts — AC一括定義

PBI配下の全WPに対してAC（Acceptance Criteria）を一括書き込みする。各WPに複数のACを設定可能。

### 入力パラメータ

| パラメータ      | 型                        | 必須 | 説明                       |
| --------------- | ------------------------- | ---- | -------------------------- |
| `pbiIdentifier` | `{title, id, code}`       | 必須 | 親PBIの識別子。`id` は必須 |
| `wps`           | `[{title, acItems}]`      | 必須 | WPリスト（最低1件）        |
| `wps[].title`   | `string`                  | 必須 | WPのタイトル               |
| `wps[].acItems` | `[{number, description}]` | 必須 | ACリスト（最低1件）        |

### 実行例

```bash
# dry-run
echo '{"pbiIdentifier":{"title":"Login feature","id":"42","code":"42"},"wps":[{"title":"Login UI","acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]},{"title":"Backend API","acItems":[{"number":"1","description":"POST /auth/login returns 200"}]}]}' | deno run -A .agents/skills/bundles/management-bundle/refine-acceptance-criteria/scripts/define_wp_acceptance_criteria.ts --dry-run

# 本実行
echo '{"pbiIdentifier":{"title":"Login feature","id":"42","code":"42"},"wps":[{"title":"Login UI","acItems":[{"number":"1","description":"Login form renders correctly"},{"number":"2","description":"Error messages are displayed"}]},{"title":"Backend API","acItems":[{"number":"1","description":"POST /auth/login returns 200"}]}]}' | deno run -A .agents/skills/bundles/management-bundle/refine-acceptance-criteria/scripts/define_wp_acceptance_criteria.ts
```
