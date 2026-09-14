# Deno 静的解析リファレンス

## リンター

```bash
# プロジェクト全体のリンターを実行
deno lint

# 特定のディレクトリを対象
deno lint .agents/skills/
```

## 型チェック

```bash
# 全TypeScriptファイルの型チェック
deno check **/*.ts

# 特定のファイルをチェック
deno check .agents/skills/bundles/development-bundle/quality-verification/**/*.ts
```

## フォーマットチェック

```bash
# フォーマットの整合性を確認（修正は行わない）
deno fmt --check

# 実際にフォーマットを適用
deno fmt
```

## QAタスクによる一括実行

```bash
deno task qa
```

`qa` は
`deno fmt --check && deno lint && deno check **/*.ts && deno task validate:jsdoc && deno task test`
を順次実行する。

## 結果の解釈

| ツール             | 終了コード 0 | 終了コード 非0                   |
| ------------------ | ------------ | -------------------------------- |
| `deno lint`        | 警告なし     | コード規約違反あり               |
| `deno check`       | 型エラーなし | 型の不整合またはコンパイルエラー |
| `deno fmt --check` | 書式統一済み | フォーマット未適用のファイルあり |

## よくある警告と対応

| 警告パターン                  | 意味              | 対応                                        |
| ----------------------------- | ----------------- | ------------------------------------------- |
| `no-unused-vars`              | 未使用の変数      | 変数を削除するか `_` プレフィックスを付ける |
| `no-explicit-any`             | `any` 型の使用    | 適切な型に置き換える                        |
| `single-variable-declaration` | 複数変数の1行宣言 | 1行1変数に分割する                          |
