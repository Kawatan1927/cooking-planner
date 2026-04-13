import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import * as path from 'path';

export type Stage = 'dev' | 'prod';

export interface CookingPlannerStackProps extends cdk.StackProps {
  /** デプロイ対象の環境。"dev" または "prod" */
  stage: Stage;
}

/**
 * CookingPlanner のベーススタック。
 *
 * DynamoDB テーブル（Recipes / RecipeIngredients / Menus）と
 * Lambda 関数、API Gateway HTTP API を定義します。
 * 後続の Issue で Cognito User Pool / App Client、S3+CloudFront
 * などのリソースをここに追加していきます。
 *
 * @see docs/03-domain-and-data-model.md
 * @see docs/04-api-design.md
 * @see docs/05-architecture-notes.md
 * @see infra/CDK_INTEGRATION.md
 */
export class CookingPlannerStack extends cdk.Stack {
  /** デプロイ対象の環境名 ("dev" / "prod") */
  public readonly stage: Stage;

  /**
   * Recipes テーブル。
   * Lambda 環境変数 RECIPES_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §3
   */
  public readonly recipesTable: dynamodb.Table;

  /**
   * RecipeIngredients テーブル。
   * Lambda 環境変数 RECIPE_INGREDIENTS_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §4
   */
  public readonly recipeIngredientsTable: dynamodb.Table;

  /**
   * Menus テーブル。
   * Lambda 環境変数 MENUS_TABLE_NAME に渡す。
   * @see docs/03-domain-and-data-model.md §5
   */
  public readonly menusTable: dynamodb.Table;

  /**
   * メイン Lambda 関数（小さめモノリス構成）。
   * infra/lambda/src/index.ts をエントリーポイントとして参照する。
   * @see docs/05-architecture-notes.md
   * @see infra/lambda/src/index.ts
   */
  public readonly apiHandler: NodejsFunction;

  /**
   * API Gateway HTTP API。
   * - GET /health: 認証不要の疎通確認エンドポイント
   * - /{proxy+}: 業務 API（後続 Issue で JWT Authorizer を追加予定）
   * @see docs/04-api-design.md
   */
  public readonly httpApi: apigatewayv2.HttpApi;

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
    //   prod 環境はデータ保護のため RETAIN、それ以外（dev など）は
    //   スタックの作り直しを容易にするため DESTROY を設定する。
    // ---------------------------------------------------------------------------
    const tableRemovalPolicy =
      this.stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY;

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
      removalPolicy: tableRemovalPolicy,
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
      removalPolicy: tableRemovalPolicy,
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
      removalPolicy: tableRemovalPolicy,
    });

    // TODO(将来拡張): PantryItems テーブル
    //   PK: userId (string), SK: ingredientName (string)
    //   常備品・在庫管理用テーブル。現時点では実装しない。
    //   Lambda 環境変数名: PANTRY_ITEMS_TABLE_NAME
    //   @see docs/03-domain-and-data-model.md §7

    // -------------------------------------------------------------------------
    // Lambda 関数定義（単一 Lambda 小さめモノリス構成）
    //
    // NodejsFunction を使用して TypeScript ソースを esbuild で自動バンドルする。
    // @aws-sdk/* は Node.js 20 ランタイムに同梱されているため外部化する。
    //
    // @see infra/CDK_INTEGRATION.md
    // @see docs/05-architecture-notes.md
    // -------------------------------------------------------------------------
    this.apiHandler = new NodejsFunction(this, 'ApiHandler', {
      functionName: `cooking-planner-api-${this.stage}`,
      entry: path.join(__dirname, '../lambda/src/index.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        RECIPES_TABLE_NAME: this.recipesTable.tableName,
        RECIPE_INGREDIENTS_TABLE_NAME: this.recipeIngredientsTable.tableName,
        MENUS_TABLE_NAME: this.menusTable.tableName,
      },
      bundling: {
        // @aws-sdk/* は Lambda Node.js 20 ランタイムに含まれるため外部化する
        externalModules: ['@aws-sdk/*'],
      },
    });

    // DynamoDB テーブルへの読み書き権限を Lambda に付与
    this.recipesTable.grantReadWriteData(this.apiHandler);
    this.recipeIngredientsTable.grantReadWriteData(this.apiHandler);
    this.menusTable.grantReadWriteData(this.apiHandler);

    // -------------------------------------------------------------------------
    // API Gateway HTTP API 定義
    //
    // 汎用プロキシルーティング構成:
    //   - GET /health: 認証不要（疎通確認用）
    //   - /{proxy+} ANY: 全メソッド・全パスを Lambda にプロキシ
    //     （後続 Issue で業務ルートに JWT Authorizer を追加予定）
    //
    // /health の認証要否: 認証不要とする。
    //   docs/04-api-design.md では GET /health は任意の疎通確認 API と定義されており、
    //   デプロイ確認や監視の利便性を考慮して認証不要とする。
    //
    // @see docs/04-api-design.md
    // @see docs/05-architecture-notes.md
    // @see infra/CDK_INTEGRATION.md
    // -------------------------------------------------------------------------
    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `cooking-planner-api-${this.stage}`,
      corsPreflight: {
        // dev 環境ではローカル開発サーバーのオリジンに限定する。
        // prod 環境では CloudFront ドメイン設定後に適切なオリジンを指定すること。
        // TODO(後続Issue): prod 用 CloudFront ドメインが確定したら ['https://<domain>'] に変更
        allowOrigins: this.stage === 'dev' ? ['http://localhost:5173'] : ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', this.apiHandler);

    // GET /health: 認証不要の疎通確認エンドポイント
    // Lambda の /health ルートは status と time を返す
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // /{proxy+}: 全メソッド・全パスを Lambda にプロキシ
    // 後続 Issue でこのルートまたは業務ルート（/recipes, /menus 等）に
    // JWT Authorizer を追加する
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
    });

    // API エンドポイント URL を出力
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'API Gateway HTTP API endpoint URL',
      exportName: `cooking-planner-api-url-${this.stage}`,
    });

    // TODO(後続Issue): Cognito User Pool をここに追加する
    // TODO(後続Issue): S3 + CloudFront をここに追加する
  }
}
