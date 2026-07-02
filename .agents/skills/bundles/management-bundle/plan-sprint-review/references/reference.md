# plan-sprint-review リファレンス

## スプリントレビュー検証計画とは

スプリントレビューは、POが**スプリントゴールに対する各PBIのAC達成状況を確認・承認する**場である。
本スキルはその準備として、「何を（PBI/WP/AC）」「どのように（検証方法）」「どうなったら合格か（判定基準）」を
❔ **未確認**の状態で列挙した**検証台帳**を作成する。

この検証台帳をもとに、後続の `execute-sprint-review`
スキルが実際の検証を実行し、各ACの合否を記録する。

### このスキルがやること

- スプリント内の全PBI/WP/ACを ❔ 未確認で列挙する
- 各ACに検証方法（どのワークフローを実行し、何を確認するか）を紐付ける
- 検証台帳を永続化し、レビュー実施時の判断基準とする

### このスキルがやらないこと

- 各ACの合否判定の実行と記録（`execute-sprint-review`）
- レビューの完了処理（`archive-sprint-review`）

## 入力 JSON の形式

```json
{
  "sprintNumber": 17,
  "pbis": [
    {
      "number": 1,
      "title": "[Sprint17/ReviewSkills]/Create-sprint-review-skill-set",
      "wps": [
        {
          "number": 1,
          "title": "Gatewayアダプター拡張",
          "acs": [
            {
              "number": "1",
              "description": "ReviewUseCase.planを呼び出しReview Issueを作成するPlanを生成する",
              "verificationPlan": "sprint-startワークフローPhase 2を実行し、plan-reviewスキルが正しく呼ばれReview Issueが作成されることを確認する"
            },
            {
              "number": "2",
              "description": "dry-runモードがPlanをJSONで出力しgh CLI操作を行わない",
              "verificationPlan": "plan-review --dry-run を実行しPlan表示後にGatewayを呼ばず終了することを確認する"
            }
          ]
        }
      ]
    }
  ]
}
```

### 各フィールドの説明

| フィールム               | 必須 | 説明                                                        |
| ------------------------ | ---- | ----------------------------------------------------------- |
| `sprintNumber`           | 必須 | レビュー対象のスプリント番号                                |
| `pbis`                   | 必須 | レビュー対象のPBI一覧                                       |
| `pbis[].number`          | 必須 | PBI番号（バックログ上の識別子）                             |
| `pbis[].title`           | 必須 | PBIタイトル                                                 |
| `pbis[].wps`             | 必須 | 当該PBIに属するWP一覧                                       |
| `wps[].number`           | 必須 | WP番号                                                      |
| `wps[].title`            | 必須 | WPタイトル                                                  |
| `wps[].acs`              | 必須 | 当該WPに属するAC一覧                                        |
| `acs[].number`           | 必須 | AC番号                                                      |
| `acs[].description`      | 必須 | ACの内容                                                    |
| `acs[].verificationPlan` | 任意 | 「どのワークフロー/スキルを使って」「何を確認するか」を記述 |

## 実行例

```bash
# Sprint 17 の検証計画を立案（dry-run）
echo '{"sprintNumber": 17, "pbis": [{"number": 1, "title": "PBI例", "wps": [{"number": 1, "title": "WP例", "acs": [{"number": "1", "description": "AC例", "verificationPlan": "dry-runで確認"}]}]}]}' | deno run -A .agents/skills/bundles/management-bundle/plan-sprint-review/scripts/plan_sprint_review.ts --dry-run
```

## 生成される検証台帳の内容

作成されるIssueには以下の情報が記録される：

- **スプリント番号**: 対象スプリント
- **凡例**: 各ACの判定結果の見方（❔未確認 / ✅合格 / ⚠️条件付き / ❌不合格 / ➖論理削除）
- **PBI/WP/ACの一覧**: 全ACが ❔ 未確認で列挙される
- **検証方法**: 各ACに紐付く検証手順

```
## Sprint Review

- **Sprint**: Sprint 17

## 凡例

- ❔ 未確認（初期状態）
- ✅ 合格
- ⚠️ 条件付き合格
- ❌ 不合格
- ➖ 論理削除

## 計画時確認項目

### 📦 PBI: [1] PBIタイトル

#### WP_1: WPタイトル

- ❔ AC_1: ACの説明
  - **検証方法**: 検証手順の説明
- ❔ AC_2: ACの説明
```

## エラーハンドリング

- `sprintNumber` が指定されていない、または不正 → エラーで処理中断
- `pbIs` が空または不正 → エラーで処理中断
- システム的な接続障害 → エラーが報告され処理中断
