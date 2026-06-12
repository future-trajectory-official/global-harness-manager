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
  "customFields": { ... },
  "harness-type": { ... }
}
```

| プロパティ      | 型     | 必須 | 説明                                     |
| --------------- | ------ | ---- | ---------------------------------------- |
| `version`       | string | ✅   | スキーマバージョン。現在は `"1"` のみ。  |
| `issueTemplate` | object | ❌   | Issueテンプレートファイルのパス。        |
| `projects`      | object | ✅   | GitHub Projects V2 のボード番号。        |
| `milestone`     | object | ❌   | マイルストーン命名規則。                 |
| `customFields`  | object | ✅   | GitHubカスタムフィールド名のマッピング。 |
| `harness-type`  | object | ✅   | PBI種別の選択肢定義。                    |

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
  "type": "harness-type",
  "size": "harness-size",
  "status": "harness-status",
  "sequence": "harness-sequence",
  "effort": "harness-effort"
}
```

| プロパティ | 型     | 必須 | 説明                                                      |
| ---------- | ------ | ---- | --------------------------------------------------------- |
| `type`     | string | ✅   | PBI種別フィールド名。デフォルト: `"harness-type"`         |
| `size`     | string | ✅   | PBIサイズフィールド名。デフォルト: `"harness-size"`       |
| `status`   | string | ✅   | PBIステータスフィールド名。デフォルト: `"harness-status"` |
| `sequence` | string | ✅   | 優先順序フィールド名。デフォルト: `"harness-sequence"`    |
| `effort`   | string | ✅   | WP介入回数フィールド名。デフォルト: `"harness-effort"`    |

### 各フィールドの値と意味

| フィールド         | GitHub上の型  | 設定値の例                                             |
| ------------------ | ------------- | ------------------------------------------------------ |
| `harness-type`     | SINGLE_SELECT | `Epic`, `Feature`, `PBI`, `WP`, `Review`, `Reflection` |
| `harness-size`     | SINGLE_SELECT | `XS`, `S`, `M`, `L`, `XL`                              |
| `harness-status`   | SINGLE_SELECT | `IDEA`, `TODO`, `WIP`, `DONE`                          |
| `harness-sequence` | NUMBER        | `1.0`, `2.0`, `3.0` （Weightはsizeから導出）           |
| `harness-effort`   | NUMBER        | `1`, `2`, `3` （WP専用、人間の介入回数）               |

---

## `harness-type`

PBI種別フィールドの選択肢を定義します。

```json
"harness-type": {
  "options": ["Epic", "Feature", "PBI", "WP", "Review", "Reflection"]
}
```

| プロパティ | 型              | 必須 | 説明                                   |
| ---------- | --------------- | ---- | -------------------------------------- |
| `options`  | array of string | ✅   | PBI種別の選択肢リスト。現在は6種固定。 |

### 各選択肢の意味

| 値           | 階層    | 説明                                                  |
| ------------ | ------- | ----------------------------------------------------- |
| `Epic`       | 第1階層 | 長期的な大きな機能領域またはテーマ。                  |
| `Feature`    | 第2階層 | Epic を構成する機能グループ。                         |
| `PBI`        | 第3階層 | 最小管理単位のプロダクトバックログアイテム。          |
| `WP`         | 第4階層 | PBI 配下の作業パッケージ。1セッションで完了する単位。 |
| `Review`     | -       | スプリントレビュー専用PBI（実装を伴わない検証）。     |
| `Reflection` | -       | 振り返り・KPT専用PBI。                                |
