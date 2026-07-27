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

1. **インプットの収集**: 介入履歴（フェーズ・種別・傾向分析）を参照する。
   介入なしの場合も、協働パターンからKPTは生成できる。

2. **KPTの生成**:
   介入の事実に基づき、[references/kpt-guide.md](/.agents/skills/bundles/management-bundle/record-work-package-kpt/references/kpt-guide.md)のガイドラインに従って各項目を生成する。

3. **KPTの提示と対話**: KPT案をPOに提示し、以下の確認を行う。
   - 各項目に違和感がないか
   - POの実感と合っているか
   - 追加・修正したい点はあるか

4. **KPTの記録**: 合意した内容を記録する。
   ```bash
   echo '<JSON>' | deno run -A .agents/skills/bundles/management-bundle/record-work-package-kpt/scripts/record_kpt.ts
   ```
   入力パラメータは
   [references/reference.md](/.agents/skills/bundles/management-bundle/record-work-package-kpt/references/reference.md)
   を参照すること。

5. **結果報告**: KPT記録の完了をPOに報告する。
