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
`VISION.md.example`（`.agents/management/VISION.md.example`）を参考に、以下の要素で構成されます。

| 要素             | 説明                                                                       | 必須             |
| ---------------- | -------------------------------------------------------------------------- | ---------------- |
| `title`          | ビジョンの短い名前。GitHub Issue のタイトルになる。                        | 必須             |
| `scope`          | GitHub 上の owner/repository。Issue 作成先。`{ owner, repository }` 形式。 | 必須             |
| `targetAudience` | 誰のためのプロダクトか。具体的なペルソナを含める。                         | 必須             |
| `value`          | ユーザーが得られる体験を具体的な動詞で記述。                               | 必須             |
| `differentiator` | 競合や代替手段では満たせない独自の価値。                                   | 必須             |
| `outcomes`       | プロダクトが普及したときの変化。`{ title, description }` の配列。          | 任意（空でも可） |

### dry-run モード

`--dry-run`（または `-d`）フラグを指定すると、Plan の内容（summary と各 Step の
operation/params）を表示して終了します。実際の GitHub API は呼び出されません。

### 実行される操作

`establish_vision.ts` は以下の 3 つの Step を順次実行します：

1. **searchItems**: 既存の Vision Issue の有無を確認
2. **createItem**: `type:Vision` ラベル付きで GitHub Issue を作成（Body には変更履歴テーブルを記載）
3. **addComment**: バージョン管理されたビジョン本文（Statement + Outcomes）をコメントとして追加

### 出力形式

成功時には `ExecutionResult`（各 Step の実行結果）が JSON で標準出力に出力されます。 各 StepResult
には `operation`、`success`、`itemId` 等が含まれます。
