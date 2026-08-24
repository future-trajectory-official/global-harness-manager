# archive-product-backlog-items リファレンス

## 業務概要

スプリント終了時に、完了済みのWPとPBIをGitHub上でクローズ（archive）する。 **アーカイブ順序は WP →
PBI**（子先にクローズ）。

## archive_wp.ts — WPのクローズ

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明                         |
| ------------ | ----------------- | ---- | ---------------------------- |
| `identifier` | `{title,id,code}` | 必須 | WPの識別子（code=Issue番号） |

### 出力

`ExecutionResult` をJSONで出力する。`archive` の成功によりWP Issueが `closed` になる。

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Skill scripts","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"}}' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts --dry-run

# 実実行
echo '{"identifier":{"title":"Skill scripts","id":"I_kwDOR5-zI88AAAABKcLX9A","code":"612"}}' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_wp.ts
```

## archive_pbi.ts — PBIのクローズ

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明                          |
| ------------ | ----------------- | ---- | ----------------------------- |
| `identifier` | `{title,id,code}` | 必須 | PBIの識別子（code=Issue番号） |

### 出力

`ExecutionResult` をJSONで出力する。`archive` の成功によりPBI Issueが `closed` になる。

### 実行例

```bash
# dry-run（id に node-id、code に Issue番号を指定）
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"I_kwDOR5-zI88AAAABKcLZJA","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_pbi.ts --dry-run

# 実実行
echo '{"identifier":{"title":"Sprint-End-Persistence","id":"I_kwDOR5-zI88AAAABKcLZJA","code":"614"}}' | deno run -A .agents/skills/bundles/management-bundle/archive-product-backlog-items/scripts/archive_pbi.ts
```

## 利用する既存UseCase

| スクリプト       | UseCase                             | 備考                   |
| ---------------- | ----------------------------------- | ---------------------- |
| `archive_wp.ts`  | `workPackageUseCase.archive`        | WP Issue を closed に  |
| `archive_pbi.ts` | `productBacklogItemUseCase.archive` | PBI Issue を closed に |

## アーキテクチャ上の責務

- スクリプトは「stdin パース・UseCase呼び出し・結果表示」の3役割のみを担当する
- GitHub 操作は既存 UseCase（`archive`）のみを経由し、Gateway の既存 `archive` ハンドラーが
  closeItem を再利用する
- ローカルファイル（[product-backlog.md](/.agents/management/product-backlog.md) /
  [product-backlog-archive.md](/.agents/management/product-backlog-archive.md)）には一切書き込まない
