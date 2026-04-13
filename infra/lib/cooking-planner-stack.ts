import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export type Stage = 'dev' | 'prod';

export interface CookingPlannerStackProps extends cdk.StackProps {
  /** デプロイ対象の環境。"dev" または "prod" */
  stage: Stage;
}

/**
 * CookingPlanner のベーススタック。
 *
 * DynamoDB テーブル（Recipes / RecipeIngredients / Menus）を定義します。
 * 後続の Issue で Lambda / API Gateway / Cognito / S3+CloudFront
 * などのリソースをここに追加していきます。
 *
 * @see docs/03-domain-and-data-model.md
 * @see docs/05-architecture-notes.md
 * @see infra/CDK_INTEGRATION.md
 */
export class CookingPlannerStack extends cdk.Stack {
  /** デプロイ対象の環境名 ("dev" / "prod") */
  public readonly stage: Stage;

  /**
   * Recipes テーブル。
   * 後続 Issue で Lambda 環境変数 RECIPES_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §3
   */
  public readonly recipesTable: dynamodb.Table;

  /**
   * RecipeIngredients テーブル。
   * 後続 Issue で Lambda 環境変数 RECIPE_INGREDIENTS_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §4
   */
  public readonly recipeIngredientsTable: dynamodb.Table;

  /**
   * Menus テーブル。
   * 後続 Issue で Lambda 環境変数 MENUS_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §5
   */
  public readonly menusTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: CookingPlannerStackProps) {
    super(scope, id, props);

    this.stage = props.stage;

    // ---------------------------------------------------------------------------
    // DynamoDB テーブル定義
    //
    // 課金モード（PAY_PER_REQUEST vs PROVISIONED）:
    //   要確認: 個人利用なのでオンデマンド（PAY_PER_REQUEST）が適切だが、
    //   プロビジョンドの方がコスト予測がしやすい場合もある。現状はオンデマンドで設定。
    //
    // RemovalPolicy:
    //   要確認: dev 環境は DESTROY、prod 環境は RETAIN が一般的だが、
    //   詳細な方針が docs に記載されていないため、暫定的に RETAIN を設定。
    //   CI 環境でスタックを削除する際は明示的に変更すること。
    // ---------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Recipes テーブル
    // PK: userId (string), SK: recipeId (string, UUID)
    // @see docs/03-domain-and-data-model.md §3.2
    // -------------------------------------------------------------------------
    this.recipesTable = new dynamodb.Table(this, 'RecipesTable', {
      tableName: `cooking-planner-${this.stage}-recipes`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'recipeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 要確認: 課金モード
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 要確認: 削除ポリシー
    });

    // -------------------------------------------------------------------------
    // RecipeIngredients テーブル
    // PK: userId (string), SK: recipeId#ingredientName (string)
    // begins_with(SK, recipeId#) で特定レシピの材料一覧を Query 可能
    // @see docs/03-domain-and-data-model.md §4.2
    // -------------------------------------------------------------------------
    this.recipeIngredientsTable = new dynamodb.Table(this, 'RecipeIngredientsTable', {
      tableName: `cooking-planner-${this.stage}-recipe-ingredients`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
        // SK の値は "recipeId#ingredientName" 形式
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 要確認: 課金モード
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 要確認: 削除ポリシー
    });

    // -------------------------------------------------------------------------
    // Menus テーブル
    // PK: userId (string), SK: date#mealType#menuId (string)
    // - date: YYYY-MM-DD 形式
    // - mealType: "BREAKFAST" | "LUNCH" | "DINNER"
    // - menuId: UUID
    // @see docs/03-domain-and-data-model.md §5.2
    //
    // GSI（期間検索用インデックス）について:
    //   今回は GSI を追加しない。SK は "date#..." で始まるため、
    //   userId を PK に固定した Query で SK の範囲条件（BETWEEN）や
    //   begins_with(SK, `${date}#`) を使えば、日付検索・期間検索に
    //   FilterExpression や Lambda 側フィルタなしで対応可能である。
    //   件数増加や検索要件の変化があった場合に GSI 追加を検討する。
    //   @see docs/03-domain-and-data-model.md §5.4
    // -------------------------------------------------------------------------
    this.menusTable = new dynamodb.Table(this, 'MenusTable', {
      tableName: `cooking-planner-${this.stage}-menus`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
        // SK の値は "date#mealType#menuId" 形式
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // 要確認: 課金モード
      removalPolicy: cdk.RemovalPolicy.RETAIN, // 要確認: 削除ポリシー
    });

    // TODO(将来拡張): PantryItems テーブル
    //   PK: userId (string), SK: ingredientName (string)
    //   常備品・在庫管理用テーブル。現時点では実装しない。
    //   Lambda 環境変数名: PANTRY_ITEMS_TABLE_NAME
    //   @see docs/03-domain-and-data-model.md §7

    // TODO(後続Issue): Lambda 関数をここに追加する
    // TODO(後続Issue): API Gateway HTTP API をここに追加する
    // TODO(後続Issue): Cognito User Pool をここに追加する
    // TODO(後続Issue): S3 + CloudFront をここに追加する
  }
}
