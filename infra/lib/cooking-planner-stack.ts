import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from '@aws-cdk/aws-apigatewayv2-alpha';
import * as apigatewayv2Integrations from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface CookingPlannerStackProps extends cdk.StackProps {
  stage: string;
}

export class CookingPlannerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CookingPlannerStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // ============================================
    // DynamoDB Tables
    // ============================================

    // Recipes Table
    const recipesTable = new dynamodb.Table(this, 'RecipesTable', {
      tableName: `CookingPlanner-Recipes-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'recipeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: stage === 'prod',
    });

    // RecipeIngredients Table
    const recipeIngredientsTable = new dynamodb.Table(this, 'RecipeIngredientsTable', {
      tableName: `CookingPlanner-RecipeIngredients-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // recipeId#ingredientName
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: stage === 'prod',
    });

    // Menus Table
    const menusTable = new dynamodb.Table(this, 'MenusTable', {
      tableName: `CookingPlanner-Menus-${stage}`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING }, // date#mealType#menuId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: stage === 'prod',
    });

    // ============================================
    // Cognito User Pool
    // ============================================

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `CookingPlanner-UserPool-${stage}`,
      selfSignUpEnabled: false, // Only admin can create users
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    const userPoolClient = userPool.addClient('UserPoolClient', {
      userPoolClientName: `CookingPlanner-Client-${stage}`,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true,
        },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
      },
      generateSecret: false, // SPA doesn't use client secret
    });

    // ============================================
    // Lambda Function (Placeholder)
    // ============================================

    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: `CookingPlanner-Api-${stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({ message: 'API Lambda placeholder - implementation pending' }),
          };
        };
      `),
      environment: {
        RECIPES_TABLE_NAME: recipesTable.tableName,
        RECIPE_INGREDIENTS_TABLE_NAME: recipeIngredientsTable.tableName,
        MENUS_TABLE_NAME: menusTable.tableName,
        NODE_ENV: stage,
      },
      timeout: cdk.Duration.seconds(30),
    });

    // Grant Lambda permissions to access DynamoDB tables
    recipesTable.grantReadWriteData(apiLambda);
    recipeIngredientsTable.grantReadWriteData(apiLambda);
    menusTable.grantReadWriteData(apiLambda);

    // ============================================
    // API Gateway HTTP API
    // ============================================

    const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
      apiName: `CookingPlanner-Api-${stage}`,
      description: 'Cooking Planner HTTP API',
      corsPreflight: {
        allowOrigins: ['*'], // TODO: Restrict to CloudFront domain in production
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Add Lambda integration
    const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      apiLambda
    );

    // Add routes - using proxy integration for all paths
    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.POST,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
      ],
      integration: lambdaIntegration,
    });

    // ============================================
    // S3 Bucket for Frontend Hosting
    // ============================================

    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `cooking-planner-frontend-${stage}-${this.account}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'index.html', // For SPA routing
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: stage !== 'prod',
    });

    // ============================================
    // CloudFront Distribution
    // ============================================

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for Cooking Planner ${stage}`,
    });

    frontendBucket.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket, {
          originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
    });

    // ============================================
    // CloudFormation Outputs
    // ============================================

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: `CookingPlanner-UserPoolId-${stage}`,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: `CookingPlanner-UserPoolClientId-${stage}`,
    });

    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'HTTP API Gateway Endpoint',
      exportName: `CookingPlanner-ApiEndpoint-${stage}`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
      exportName: `CookingPlanner-DistributionDomain-${stage}`,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendBucket.bucketName,
      description: 'Frontend S3 Bucket Name',
      exportName: `CookingPlanner-FrontendBucket-${stage}`,
    });

    new cdk.CfnOutput(this, 'RecipesTableName', {
      value: recipesTable.tableName,
      description: 'Recipes DynamoDB Table Name',
      exportName: `CookingPlanner-RecipesTable-${stage}`,
    });

    new cdk.CfnOutput(this, 'RecipeIngredientsTableName', {
      value: recipeIngredientsTable.tableName,
      description: 'Recipe Ingredients DynamoDB Table Name',
      exportName: `CookingPlanner-RecipeIngredientsTable-${stage}`,
    });

    new cdk.CfnOutput(this, 'MenusTableName', {
      value: menusTable.tableName,
      description: 'Menus DynamoDB Table Name',
      exportName: `CookingPlanner-MenusTable-${stage}`,
    });
  }
}
