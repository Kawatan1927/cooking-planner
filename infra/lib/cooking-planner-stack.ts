import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import * as path from 'path';

export type Stage = 'dev' | 'prod';

export interface CookingPlannerStackProps extends cdk.StackProps {
  /** デプロイ対象の環境。"dev" または "prod" */
  stage: Stage;
  /**
   * CORS で許可するオリジン一覧。
   * - dev 環境: 省略可（デフォルト: ['http://localhost:5173']）
   * - prod 環境: 必須。省略・空・'*' を指定すると synth 時にエラー
   *   例: cdk deploy --context allowedOrigins=https://xxx.cloudfront.net
   */
  allowedOrigins?: string[];
}

/**
 * CookingPlanner のベーススタック。
 *
 * DynamoDB テーブル（Recipes / RecipeIngredients / Menus）と
 * Lambda 関数、Cognito User Pool、API Gateway HTTP API を定義します。
 * 後続の Issue で S3+CloudFront などのリソースをここに追加していきます。
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
   * - /{proxy+}: 業務 API（Cognito JWT Authorizer で認証必須）
   * @see docs/04-api-design.md
   */
  public readonly httpApi: apigatewayv2.HttpApi;

  /**
   * Cognito User Pool。認証基盤として使用。
   * - 自己登録不可（個人利用）
   * - メールアドレスでサインイン
   * @see docs/05-architecture-notes.md §2.4
   */
  public readonly userPool: cognito.UserPool;

  /**
   * Cognito User Pool App Client。
   * SPA から SRP 認証フローで使用。
   */
  public readonly userPoolClient: cognito.UserPoolClient;

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
    // @aws-sdk/* (v3) は Node.js 20 ランタイムに同梱されないため、
    // externalModules は指定せず esbuild がバンドルする。
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
    });

    // DynamoDB テーブルへの読み書き権限を Lambda に付与
    this.recipesTable.grantReadWriteData(this.apiHandler);
    this.recipeIngredientsTable.grantReadWriteData(this.apiHandler);
    this.menusTable.grantReadWriteData(this.apiHandler);

    // -------------------------------------------------------------------------
    // Cognito User Pool / App Client 定義
    //
    // 個人利用アプリのため自己登録不可。メールアドレスでサインイン。
    // SPA は SRP 認証フローでトークンを取得し、API 呼び出し時に
    // Authorization: Bearer <JWT> として渡す。
    //
    // @see docs/05-architecture-notes.md §2.4
    // @see docs/04-api-design.md §1.3
    // -------------------------------------------------------------------------
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `cooking-planner-${this.stage}-user-pool`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      removalPolicy: tableRemovalPolicy,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: { userSrp: true },
    });

    // -------------------------------------------------------------------------
    // API Gateway HTTP API 定義
    //
    // 汎用プロキシルーティング構成:
    //   - GET /health: 認証不要（疎通確認用）
    //   - /{proxy+} ANY: 全メソッド・全パスを Lambda にプロキシ（JWT Authorizer で認証必須）
    //
    // /health の認証要否: 認証不要とする。
    //   docs/04-api-design.md では GET /health は任意の疎通確認 API と定義されており、
    //   デプロイ確認や監視の利便性を考慮して認証不要とする。
    //
    // CORS allowedOrigins の検証（fail-closed）:
    //   - dev 環境: 未指定時は ['http://localhost:5173'] をデフォルトとする
    //   - prod 環境: props.allowedOrigins が必須。未設定・空・'*' は synth 時エラー
    //
    // @see docs/04-api-design.md
    // @see docs/05-architecture-notes.md
    // @see infra/CDK_INTEGRATION.md
    // -------------------------------------------------------------------------
    let corsAllowOrigins: string[];
    if (this.stage === 'dev') {
      corsAllowOrigins = props.allowedOrigins ?? ['http://localhost:5173'];
    } else {
      const filtered = (props.allowedOrigins ?? []).map(o => o.trim()).filter(o => o.length > 0);
      if (filtered.length === 0) {
        throw new Error(
          'prod 環境では allowedOrigins が必須です。' +
            'cdk deploy 時に --context allowedOrigins=https://xxx.cloudfront.net を指定してください。'
        );
      }
      if (filtered.some(o => o === '*')) {
        throw new Error(
          'prod 環境では allowedOrigins に "*" は使用できません。' +
            'CloudFront ドメインなど具体的なオリジンを指定してください。'
        );
      }
      corsAllowOrigins = filtered;
    }

    this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `cooking-planner-api-${this.stage}`,
      corsPreflight: {
        allowOrigins: corsAllowOrigins,
        // /{proxy+} で HttpMethod.ANY を受け付けているため、
        // CORS でも許可メソッドを包括的に揃えて不整合を防ぐ。
        allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', this.apiHandler);

    const jwtAuthorizer = new HttpUserPoolAuthorizer('JwtAuthorizer', this.userPool, {
      userPoolClients: [this.userPoolClient],
    });

    // GET /health: 認証不要の疎通確認エンドポイント
    // Lambda の /health ルートは status と time を返す
    this.httpApi.addRoutes({
      path: '/health',
      methods: [apigatewayv2.HttpMethod.GET],
      integration: lambdaIntegration,
    });

    // /{proxy+}: 全メソッド・全パスを Lambda にプロキシ（JWT Authorizer で認証必須）
    this.httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration,
      authorizer: jwtAuthorizer,
    });

    // API エンドポイント URL を出力
    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: this.httpApi.apiEndpoint,
      description: 'API Gateway HTTP API endpoint URL',
      exportName: `cooking-planner-api-url-${this.stage}`,
    });

    // Cognito User Pool ID / App Client ID を出力（フロントエンド設定に使用）
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `cooking-planner-user-pool-id-${this.stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito User Pool App Client ID',
      exportName: `cooking-planner-user-pool-client-id-${this.stage}`,
    });

    // TODO(後続Issue): S3 + CloudFront をここに追加する
  }
}
