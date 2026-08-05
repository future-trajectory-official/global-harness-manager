---
name: record-work-package-kpt
description: セッション完了時にKPT＋Adviseを生成し、バックログに記録する。
tags:
  - trigger: record-work-package-kpt
  - trigger: record-wp-kpt
  - trigger: record-kpt
  - category: management
---

# record-work-package-kpt

セッション完了時にKPT(Keep/Problem/Try)＋Adviseを生成し、バックログに記録する。

介入事実をインプットに、POとの対話を通じて「SO WHAT: それをどう活かすか」を定義する。

## Quick-Start

> [!IMPORTANT] 各ステップの責任者 各ステップの見出しに **責任者** を明記する。
>
> - `[責任者: AI]`: AIが自律実行する（確認不要）
> - `[責任者: PO]`: POが実行する
> - `[責任者: 共同]`: AIが案を提示し、**POの確定を経てから**次のステップへ進む
>   共同ステップでは、POの確定なしに記録・実行を行ってはならない。

### Step 1: インプットの収集 [責任者: AI]

介入履歴（フェーズ・種別・傾向分析）を参照する。 介入なしの場合も、協働パターンからKPTは生成できる。

### Step 2: KPTの生成 [責任者: AI]

介入の事実に基づき、[references/kpt-guide.md](/.agents/skills/bundles/management-bundle/record-work-package-kpt/references/kpt-guide.md)のガイドラインに従って各項目を生成する。
**各項目は必ず1,024バイト以内に要約すること**（Projects
V2のTEXT上限は1,024バイト。UTF-8の日本語は約340文字が上限）。詳細は
[references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-kpt/references/reference.md)
を参照。

### Step 3: KPTの提示と対話 [責任者: 共同]

KPT案をPOに提示し、以下の確認を行う。

- 各項目に違和感がないか
- POの実感と合っているか
- 追加・修正したい点はあるか

**POの確定を経るまで Step 4 へ進んではならない。**

### Step 4: KPTの記録 [責任者: AI]

合意した内容を記録する。

```bash
echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-kpt/scripts/record_kpt.ts
```

入力パラメータは
[references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-kpt/references/reference.md)
を参照すること。

### Step 5: 結果報告 [責任者: AI]

KPT記録の完了をPOに報告する。
