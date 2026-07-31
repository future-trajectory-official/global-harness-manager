# record-work-package-kpt リファレンス

## 業務概要

セッション完了時にKPT(Keep/Problem/Try)＋AdviseをバックログWPに記録する。

## record_kpt.ts — KPT記録

POと合意したKPT内容をWPに記録する。

### 入力パラメータ

| パラメータ   | 型                | 必須 | 説明                       |
| ------------ | ----------------- | ---- | -------------------------- |
| `identifier` | `{title,id,code}` | 必須 | WPの識別子                 |
| `keep`       | `string`          | 必須 | 今回うまくいったこと       |
| `problem`    | `string`          | 必須 | 課題・問題点               |
| `try`        | `string`          | 必須 | 次回試すこと               |
| `advise`     | `string`          | 任意 | AIからPOへのフィードバック |

> [!IMPORTANT] **各項目は1,024バイト以内に収めること。** Projects
> V2のTEXTフィールド上限は1,024バイト（文字数ではない）。
> UTF-8では日本語は1文字=3バイトのため、**日本語は約340文字が上限**となる。 超過するとGitHub側で
> `GraphQL: Column value must be a valid value for text column` エラーとなり、記録が失敗する。
> KPT生成時に各項目を必ず要約し、この上限を守ること。

### 実行例

```bash
echo '{
  "identifier": {"title":"Session-Lifecycle-Persistence","id":"42","code":"42"},
  "keep": "計画段階で十分な対話ができ、認識齟齬が少なかった",
  "problem": "AIが既存コード構造を十分に把握しておらず、アプローチの再検討が発生した",
  "try": "作業着手前に AI が該当コードの構造を読み、POに要約してから実装に入る",
  "advise": "POの設計判断が一貫しており、修正の方向性に迷うことがなかった"
}' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-kpt/scripts/record_kpt.ts
```
