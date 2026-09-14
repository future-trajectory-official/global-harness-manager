# Deno テスト実行リファレンス

## 基本的なテスト実行

```bash
# 全テストを並列実行
deno test -A --parallel
```

## カバレッジ測定

```bash
# カバレッジデータを収集
deno test -A --parallel --coverage=cov_profile

# カバレッジレポートを表示
deno coverage cov_profile

# カバレッジデータをクリーンアップ
rm -rf cov_profile
```

## QAタスク（全検証一括）

```bash
deno task qa
deno task qa:cov  # カバレッジ付き
```

## 特定のテストのみ実行

```bash
# ファイル名でフィルタ
deno test -A --filter="skill_structure"

# 特定のテストファイルを直接指定
deno test -A .agents/skills/bundles/development-bundle/quality-verification/scripts/skill_structure_test.ts
```

## 結果の解釈

| 終了コード | 意味              | 対応                       |
| ---------- | ----------------- | -------------------------- |
| 0          | 全テスト成功      | 次の工程へ進む             |
| 非0        | 1件以上の失敗あり | エラー出力を確認し修正する |

## テストファイルの配置ルール

- 実装ファイルと同じディレクトリに `*_test.ts` として配置
- `@std/assert` をインポートして使用
- 各テストケースには JSDoc でユースケースと検証意図を記述
