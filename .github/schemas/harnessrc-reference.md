# `.harnessrc` 設定リファレンス

本ドキュメントは `.harnessrc` の全設定項目を解説します。 `.harnessrc`
は各プロジェクトのローカル設定ファイルであり、Git管理対象外です。 クローン後は
`.github/schemas/harnessrc.example` をコピーして作成してください。

```bash
cp .github/schemas/harnessrc.example .github/schemas/.harnessrc
```

---

## トップレベル構造

```json
{
  "version": "1",
  "issueTemplate": { ... },
  "projects": { ... },
  "milestone": { ... },
  "customFields": { ... }
}
```

| プロパティ      | 型     | 必須 | 説明                                     |
| --------------- | ------ | ---- | ---------------------------------------- |
| `version`       | string | ✅   | スキーマバージョン。現在は `"1"` のみ。  |
| `issueTemplate` | object | ❌   | Issueテンプレートファイルのパス。        |
| `projects`      | object | ✅   | GitHub Projects V2 のボード番号。        |
| `milestone`     | object | ❌   | マイルストーン命名規則。                 |
| `customFields`  | object | ✅   | GitHubカスタムフィールド名のマッピング。 |

---

## `issueTemplate`

Issue 作成時に使用するテンプレートファイルのパスを指定します。

```json
"issueTemplate": {
  "path": ".github/ISSUE_TEMPLATE/pbi.md"
}
```

| プロパティ | 型     | 必須 | 説明                               |
| ---------- | ------ | ---- | ---------------------------------- |
| `path`     | string | ✅   | テンプレートファイルへの相対パス。 |

---

## `projects`

GitHub Projects V2 のボード番号を指定します。 番号は Projects 画面の
URL（`https://github.com/orgs/ORG/projects/N`）の `N` の値です。

```json
"projects": {
  "productBacklog": 8,
  "sprintBoard": 9
}
```

| プロパティ       | 型     | 必須 | 説明                                       |
| ---------------- | ------ | ---- | ------------------------------------------ |
| `productBacklog` | number | ✅   | Product Backlog ボードのプロジェクト番号。 |
| `sprintBoard`    | number | ✅   | Sprint Board のプロジェクト番号。          |

---

## `milestone`

マイルストーンの命名テンプレートを指定します。 `{number}` はスプリント番号に置き換えられます。

```json
"milestone": {
  "template": "Sprint {number}"
}
```

| プロパティ | 型     | 必須 | 説明                                                                       |
| ---------- | ------ | ---- | -------------------------------------------------------------------------- |
| `template` | string | ✅   | マイルストーン名のテンプレート（例：`"Sprint {number}"` → `"Sprint 9"`）。 |

---

## `customFields`

GitHub Projects V2 で使用するカスタムフィールド名のマッピングを指定します。
ここで指定したフィールド名が、GitHub 上のカスタムフィールド名と一致する必要があります。

```json
"customFields": {
  "size": "harness-size-estimate",
  "sizeActual": "harness-size-actual",
  "sequence": "harness-sequence",
  "effortInitial": "harness-effort-initial",
  "effortPlaned": "harness-effort-planed",
  "effortActual": "harness-effort-actual",
  "varianceText": "harness-variance-text"
}
```

| プロパティ      | 型     | 必須 | 説明                                                                   |
| --------------- | ------ | ---- | ---------------------------------------------------------------------- |
| `size`          | string | ✅   | PBIサイズ見積フィールド名。デフォルト: `"harness-size-estimate"`       |
| `sizeActual`    | string | ✅   | PBI実績サイズフィールド名。デフォルト: `"harness-size-actual"`         |
| `sequence`      | string | ✅   | 表示順序フィールド名。デフォルト: `"harness-sequence"`                 |
| `effortInitial` | string | ✅   | 計画前見積（initial estimate）フィールド名。`"harness-effort-initial"` |
| `effortPlaned`  | string | ✅   | 計画後見積（planned estimate）フィールド名。`"harness-effort-planed"`  |
| `effortActual`  | string | ✅   | 完了時実績（actual effort）フィールド名。`"harness-effort-actual"`     |
| `varianceText`  | string | ✅   | 予実差分析テキストフィールド名。`"harness-variance-text"`              |

### 各フィールドの値と意味

| フィールド               | GitHub上の型  | 設定値の例                                         |
| ------------------------ | ------------- | -------------------------------------------------- |
| `harness-size-estimate`  | SINGLE_SELECT | `XS`, `S`, `M`, `L`, `XL`                          |
| `harness-size-actual`    | SINGLE_SELECT | `XS`, `S`, `M`, `L`, `XL`                          |
| `harness-sequence`       | NUMBER        | `1`, `2`, `3` （表示順）                           |
| `harness-effort-initial` | NUMBER        | `3` （計画前見積の合計介入回数）                   |
| `harness-effort-planed`  | NUMBER        | `2` （計画後見積の合計介入回数）                   |
| `harness-effort-actual`  | NUMBER        | `1` （完了時実績の合計介入回数）                   |
| `harness-variance-text`  | TEXT          | `"スコープ拡大により乖離。当初想定より複雑だった"` |

---

## PBI種別（Issue labels）

PBIの種別は Project V2 カスタムフィールドではなく、**Issue labels（`type:*`）** で管理します。

| ラベル            | 階層    | 説明                                                  |
| ----------------- | ------- | ----------------------------------------------------- |
| `type:Epic`       | 第1階層 | 長期的な大きな機能領域またはテーマ。                  |
| `type:Feature`    | 第2階層 | Epic を構成する機能グループ。                         |
| `type:PBI`        | 第3階層 | 最小管理単位のプロダクトバックログアイテム。          |
| `type:WP`         | 第4階層 | PBI 配下の作業パッケージ。1セッションで完了する単位。 |
| `type:Review`     | -       | スプリントレビュー専用PBI（実装を伴わない検証）。     |
| `type:Reflection` | -       | 振り返り・KPT専用PBI。                                |
