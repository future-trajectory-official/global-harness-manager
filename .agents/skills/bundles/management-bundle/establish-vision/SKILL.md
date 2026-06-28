---
name: establish-vision
description: プロダクトビジョンを構造化し、GitHub Issue として作成する。ビジョンの各要素（対象ユーザー・提供価値・差別化要因・アウトカム）を定義し、バージョン管理された Issue として確立する。
tags:
  - trigger: establish-vision, create-vision, define-vision
  - category: management
---

# establish-vision

## Quick Start

```bash
# 1. スコープを設定し、ビジョン情報を JSON で標準入力から渡す
echo '{
  "title": "My Project Vision",
  "scope": { "owner": "my-org", "repository": "my-repo" },
  "targetAudience": "AIを活用した開発初心者",
  "value": "クローンするだけで環境が整う",
  "differentiator": "教育的協働で成長させる",
  "outcomes": [
    { "title": "Zero-setup", "description": "即座に開発開始" },
    { "title": "Growth", "description": "使うほどスキル向上" }
  ]
}' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/establish_vision.ts
# 出力: GitHub Issue 作成結果（作成された Issue の番号等）

# 2. dry-run モード: 実行せず Plan を確認する
echo '{"title":"My Project Vision","scope":{"owner":"my-org","repository":"my-repo"},"targetAudience":"AI開発初心者","value":"即座に開始","differentiator":"教育的協働","outcomes":[{"title":"Zero-setup","description":"即座に開発開始"}]}' | deno run -A .agents/skills/bundles/management-bundle/establish-vision/establish_vision.ts --dry-run
# 出力: Plan の内容（実行される Step 一覧）
```

**注意**: 各フィールドの意味と設計意図は、以下の「Reference」セクションを先に読んでください。

---

## Reference

### ビジョンとは何か

プロダクトビジョンは、プロジェクトの長期的な存在意義と方向性を定義する「North Star」です。
`VISION.md.example`（`.agents/management/VISION.md.example`）を参考に、ビジョンの各要素（対象ユーザー・提供価値・差別化要因・アウトカム）を定義します。

### 詳細リファレンス

入力 JSON の完全なスキーマ定義、実行される操作、出力形式については以下を参照してください：

- [input-schema.md](/.agents/skills/bundles/management-bundle/establish-vision/references/input-schema.md)

### dry-run モード

`--dry-run`（または `-d`）フラグを指定すると、Plan の内容（summary と各 Step の
operation/params）を表示して終了します。実際の GitHub API は呼び出されません。
