---
name: tdd-implementation
description: エージェントにテスト駆動開発（TDD）の能力を付与し、品質の高いコード実装をガイドするスキル
tags:
  trigger:
    - new-feature
    - bug-fix
    - implementation-guide
  category: development
  constraints: requires-test-runner
---

# tdd-implementation

このスキルは、Antigravity
がテスト駆動開発（TDD）のサイクルを確実に実行し、仕様を満たしつつ品質が担保されたコードを生成するための能力を定義します。

## 前提条件

- プロジェクト内にテストランナー（`deno test`, `pytest` 等）がセットアップされていること。
- 実装対象の要件（仕様）が明確になっていること。

## 実行手順

1. **環境判定とリファレンスのロード**
   - プロジェクト構成（`deno.json`, `requirements.txt`
     等）を確認し、適切な言語リファレンスを読み込んでください。
     - Deno/TypeScript: [deno-ts.md](./references/deno-ts.md)
     - Python: [python.md](./references/python.md)

2. **RED: 失敗するテストの作成**
   - 指定された仕様に基づき、**最初にテストコードだけ**を記述してください。
   - `deno test`
     等を実行し、テストが期待通り失敗（RED）することを確認してユーザーに報告してください。

3. **GREEN: 実装と成功の確認**
   - テストを通過させるための**最小限のプロダクトコード**を実装してください。
   - 再度テストを実行し、成功（GREEN）することを確認してユーザーに報告してください。

4. **品質チェック (DoDの検証)**
   - 各言語のリファレンスに従い、静的解析やフォーマットチェックを実行してください。
     - Deno: `deno lint`, `deno fmt --check`, `deno check`
   - 全てのチェックを通過したら、進捗を報告してください。

## 注意事項

- **スキップの禁止**: テスト作成前にプロダクトコードを書くことは TDD ではありません。
- **証拠の提示**: 各ステップでのコマンド実行結果を必ずユーザーに提示してください。
- **コミットについて**:
  このスキル内ではコミットを行いません。全ての作業が完了した後、上位のタスク管理（ワークフロー）の指示に従ってください。
