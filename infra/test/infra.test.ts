import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { CookingPlannerStack } from '../lib/cooking-planner-stack';

describe('CookingPlannerStack', () => {
  test('DynamoDB Tables Created', () => {
    const app = new cdk.App();
    const stack = new CookingPlannerStack(app, 'TestStack', {
      stage: 'test',
    });
    const template = Template.fromStack(stack);

    // Check that all three DynamoDB tables are created
    template.resourceCountIs('AWS::DynamoDB::Table', 3);

    // Verify Recipes table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'CookingPlanner-Recipes-test',
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Verify RecipeIngredients table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'CookingPlanner-RecipeIngredients-test',
      BillingMode: 'PAY_PER_REQUEST',
    });

    // Verify Menus table
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TableName: 'CookingPlanner-Menus-test',
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  test('Cognito User Pool Created', () => {
    const app = new cdk.App();
    const stack = new CookingPlannerStack(app, 'TestStack', {
      stage: 'test',
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UserPoolName: 'CookingPlanner-UserPool-test',
    });

    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      ClientName: 'CookingPlanner-Client-test',
      AllowedOAuthFlows: ['code'],
      AllowedOAuthFlowsUserPoolClient: true,
      CallbackURLs: Match.arrayWith(['http://localhost:5173']),
      LogoutURLs: Match.arrayWith(['http://localhost:5173']),
    });
  });

  test('Lambda Function Created', () => {
    const app = new cdk.App();
    const stack = new CookingPlannerStack(app, 'TestStack', {
      stage: 'test',
    });
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'CookingPlanner-Api-test',
      Runtime: 'nodejs20.x',
    });
  });

  test('S3 Bucket and CloudFront Distribution Created', () => {
    const app = new cdk.App();
    const stack = new CookingPlannerStack(app, 'TestStack', {
      stage: 'test',
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
  });

  test('HTTP API uses JWT authorizer for business routes', () => {
    const app = new cdk.App();
    const stack = new CookingPlannerStack(app, 'TestStack', {
      stage: 'test',
    });
    const template = Template.fromStack(stack);

    template.resourceCountIs('AWS::ApiGatewayV2::Authorizer', 1);
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /{proxy+}',
      AuthorizationType: 'JWT',
      AuthorizerId: Match.anyValue(),
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /health',
      Target: Match.anyValue(),
    });
  });
});

