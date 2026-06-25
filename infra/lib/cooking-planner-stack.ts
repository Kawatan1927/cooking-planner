import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export type Stage = 'dev' | 'prod';

export interface CookingPlannerStackProps extends cdk.StackProps {
  /** デプロイ対象の環境。"dev" または "prod" */
  stage: Stage;
  /**
   * （後方互換のため残置）CORS で許可するオリジン一覧。
   * API は Bun + Hono サーバー側で CORS を処理するため、CDK では未使用。
   */
  allowedOrigins?: string[];
  /**
   * Cognito Hosted UI のコールバック URL 一覧（ログイン後リダイレクト先）。
   * - dev 環境: 省略可（デフォルト: ['http://localhost:5173/callback']）
   * - prod 環境: 必須。省略・空を指定すると synth 時にエラー
   *   例: cdk deploy --context callbackUrls=https://xxx.cloudfront.net/callback
   */
  callbackUrls?: string[];
  /**
   * Cognito Hosted UI のログアウト URL 一覧（ログアウト後リダイレクト先）。
   * - dev 環境: 省略可（デフォルト: ['http://localhost:5173']）
   * - prod 環境: 必須。省略・空を指定すると synth 時にエラー
   *   例: cdk deploy --context logoutUrls=https://xxx.cloudfront.net
   */
  logoutUrls?: string[];
}

/**
 * CookingPlanner のベーススタック。
 *
 * DynamoDB テーブル（Recipes / RecipeIngredients / Menus）、
 * Cognito User Pool、S3 バケット、CloudFront ディストリビューションを定義します。
 *
 * API サーバー（Bun + Hono）はローカル PC 上で常時起動し、Cloudflare Tunnel で
 * 公開する構成のため、Lambda / API Gateway は CDK では定義しません（#127）。
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
   * @see docs/03-domain-and-data-model.md §3
   */
  public readonly recipesTable: dynamodb.Table;

  /**
   * RecipeIngredients テーブル。
   * @see docs/03-domain-and-data-model.md §4
   */
  public readonly recipeIngredientsTable: dynamodb.Table;

  /**
   * Menus テーブル。
   * @see docs/03-domain-and-data-model.md §5
   */
  public readonly menusTable: dynamodb.Table;

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

  /**
   * Cognito User Pool Domain（Hosted UI 用）。
   * ドメインプレフィックスは `cooking-planner-{stage}`。
   * @see docs/05-architecture-notes.md §2.4
   */
  public readonly userPoolDomain: cognito.UserPoolDomain;

  /**
   * フロントエンド静的ファイル用 S3 バケット。
   * CloudFront OAC 経由でのみアクセス可能（パブリックアクセス無効）。
   * @see docs/05-architecture-notes.md §1.1
   */
  public readonly frontendBucket: s3.Bucket;

  /**
   * CloudFront ディストリビューション。
   * - デフォルトビヘイビア: S3 バケット（SPA 配信）
   * - SPA ルーティング: 拡張子のないパスを index.html にリライト
   * @see docs/04-api-design.md §1.1
   */
  public readonly distribution: cloudfront.Distribution;

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
    // - mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "OTHER"
    // - menuId: UUID
    // @see docs/03-domain-and-data-model.md §5.2
    //
    // GSI（期間検索用インデックス）について:
    //   今回は GSI を追加しない。SK は "date#..." で始まるため、
    //   userId を PK に固定した Query で SK の範囲条件（BETWEEN）や
    //   begins_with(SK, `${date}#`) を使えば、日付検索・期間検索に
    //   FilterExpression なしで対応可能である。
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
    //   @see docs/03-domain-and-data-model.md §7

    // -------------------------------------------------------------------------
    // API サーバー（Bun + Hono）はローカル PC 上で動作するため、
    // Lambda / API Gateway は CDK では定義しない（#127 で AWS から移行）。
    // DynamoDB テーブルへのアクセス権限はローカル実行側の認証情報で付与する。
    // -------------------------------------------------------------------------

    // -------------------------------------------------------------------------
    // Cognito User Pool / App Client 定義
    //
    // 個人利用アプリのため自己登録不可。メールアドレスでサインイン。
    // SPA は SRP 認証フローまたは Hosted UI（Authorization Code Grant）で
    // トークンを取得する。
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

    // -------------------------------------------------------------------------
    // Hosted UI 用 callback URL / logout URL の検証・設定
    //
    // prod/dev の切り替え方針:
    //   - dev 環境: Vite dev server のデフォルト URL をフォールバックとして使用。
    //     テスト・検証目的であれば `--context callbackUrls=...` で上書き可能。
    //   - prod 環境: 配信 URL を必ず明示する（省略不可）。
    //
    // @see docs/05-architecture-notes.md §4.1
    // -------------------------------------------------------------------------
    let cognitoCallbackUrls: string[];
    let cognitoLogoutUrls: string[];
    if (this.stage === 'dev') {
      const filteredCallback = (props.callbackUrls ?? [])
        .map(u => u.trim())
        .filter(u => u.length > 0);
      const filteredLogout = (props.logoutUrls ?? []).map(u => u.trim()).filter(u => u.length > 0);
      cognitoCallbackUrls =
        filteredCallback.length > 0 ? filteredCallback : ['http://localhost:5173/callback'];
      cognitoLogoutUrls = filteredLogout.length > 0 ? filteredLogout : ['http://localhost:5173'];
    } else {
      const filteredCallback = (props.callbackUrls ?? [])
        .map(u => u.trim())
        .filter(u => u.length > 0);
      const filteredLogout = (props.logoutUrls ?? []).map(u => u.trim()).filter(u => u.length > 0);
      if (filteredCallback.length === 0) {
        throw new Error(
          'prod 環境では callbackUrls が必須です。' +
            'cdk deploy 時に --context callbackUrls=https://xxx.cloudfront.net/callback を指定してください。'
        );
      }
      if (filteredLogout.length === 0) {
        throw new Error(
          'prod 環境では logoutUrls が必須です。' +
            'cdk deploy 時に --context logoutUrls=https://xxx.cloudfront.net を指定してください。'
        );
      }
      cognitoCallbackUrls = filteredCallback;
      cognitoLogoutUrls = filteredLogout;
    }

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: cognitoCallbackUrls,
        logoutUrls: cognitoLogoutUrls,
      },
    });

    // Hosted UI 用 User Pool Domain
    // ドメインプレフィックスはグローバルで一意である必要があるため、
    // アプリ名＋ステージ名で構成する（例: cooking-planner-prod）。
    const userPoolDomainPrefix = `cooking-planner-${this.stage}`;
    this.userPoolDomain = new cognito.UserPoolDomain(this, 'UserPoolDomain', {
      userPool: this.userPool,
      cognitoDomain: {
        domainPrefix: userPoolDomainPrefix,
      },
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

    // Cognito Hosted UI ドメインを出力（フロントエンドの VITE_COGNITO_DOMAIN に設定する）
    new cdk.CfnOutput(this, 'UserPoolDomainName', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Hosted UI ドメイン（VITE_COGNITO_DOMAIN に設定する値）',
      exportName: `cooking-planner-user-pool-domain-${this.stage}`,
    });

    // -------------------------------------------------------------------------
    // S3 バケット定義（フロントエンド静的ファイル用）
    //
    // セキュリティ設定:
    //   - パブリックアクセスを完全にブロック
    //   - CloudFront OAC（Origin Access Control）経由でのみアクセス可能
    //
    // RemovalPolicy:
    //   prod 環境はデータ保護のため RETAIN。
    //   dev 環境は DESTROY + autoDeleteObjects でスタック削除時にバケットも削除。
    //
    // @see docs/05-architecture-notes.md §1.1
    // -------------------------------------------------------------------------
    this.frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: tableRemovalPolicy,
      autoDeleteObjects: this.stage !== 'prod',
    });

    // -------------------------------------------------------------------------
    // CloudFront Function 定義（SPA ルーティング用）
    //
    // デフォルトビヘイビア（S3）でファイル拡張子のないパスを
    // /index.html にリライトして React Router のクライアントサイドルーティングを実現する。
    //
    // @see docs/04-api-design.md §1.1
    // -------------------------------------------------------------------------
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `cooking-planner-spa-routing-${this.stage}`,
      comment: 'SPA ルーティング: 拡張子のないパスと / を /index.html にリライト',
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  if (uri === '/' || !uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
`),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // -------------------------------------------------------------------------
    // CloudFront ディストリビューション定義
    //
    // ビヘイビア構成:
    //   - デフォルト (/**): S3 バケット（SPA 静的ファイル配信）
    //     - OAC で S3 に安全にアクセス
    //     - SPA ルーティング: 拡張子のないパスを /index.html にリライト
    //
    // API（/api/*）は CloudFront ではなくローカルの Hono サーバー
    // （Cloudflare Tunnel 経由）で配信するため、ここには定義しない（#127）。
    //
    // @see docs/04-api-design.md §1.1
    // @see docs/05-architecture-notes.md §1.2
    // -------------------------------------------------------------------------
    this.distribution = new cloudfront.Distribution(this, 'CloudFrontDistribution', {
      comment: `cooking-planner-${this.stage}`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        // SPA ルーティング: 拡張子のないパスを /index.html にリライト。
        functionAssociations: [
          {
            function: spaRoutingFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
    });

    // CloudFront URL を出力（Cognito callback URL の設定などに使用）
    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront URL（フロント配信 URL / Cognito callback URL に使用）',
      exportName: `cooking-planner-cloudfront-url-${this.stage}`,
    });

    // CloudFront Distribution ID を出力（フロントデプロイ後のキャッシュ無効化に使用）
    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID（aws cloudfront create-invalidation で使用）',
      exportName: `cooking-planner-cloudfront-distribution-id-${this.stage}`,
    });

    // S3 バケット名を出力（フロントデプロイ時の aws s3 sync に使用）
    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: this.frontendBucket.bucketName,
      description: 'フロントエンド静的ファイル用 S3 バケット名（aws s3 sync で使用）',
      exportName: `cooking-planner-frontend-bucket-name-${this.stage}`,
    });
  }
}
