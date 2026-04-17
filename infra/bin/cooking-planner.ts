#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CookingPlannerStack, Stage } from '../lib/cooking-planner-stack';

const app = new cdk.App();

// CDK context から stage を取得。未指定時は 'dev' をデフォルト値とする。
// 例: cdk synth --context stage=prod
const rawStage: string = app.node.tryGetContext('stage') ?? 'dev';

if (rawStage !== 'dev' && rawStage !== 'prod') {
  throw new Error(`Invalid stage: "${rawStage}". Allowed values are "dev" or "prod".`);
}

const stage = rawStage as Stage;

// CORS 許可オリジンを context から取得。
// prod では allowedOrigins が必須（スタック側でバリデーションする）。
// 複数オリジンはカンマ区切りで指定可能。
// 例: cdk deploy --context stage=prod --context allowedOrigins=https://xxx.cloudfront.net
const allowedOriginsRaw: string | undefined = app.node.tryGetContext('allowedOrigins');
const allowedOrigins = allowedOriginsRaw
  ? allowedOriginsRaw
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
  : undefined;

// Cognito Hosted UI の callback URL を context から取得。
// prod では必須（スタック側でバリデーションする）。
// 複数 URL はカンマ区切りで指定可能。
// 例: cdk deploy --context callbackUrls=https://xxx.cloudfront.net/callback
const callbackUrlsRaw: string | undefined = app.node.tryGetContext('callbackUrls');
const callbackUrls = callbackUrlsRaw
  ? callbackUrlsRaw
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
  : undefined;

// Cognito Hosted UI のログアウト URL を context から取得。
// prod では必須（スタック側でバリデーションする）。
// 複数 URL はカンマ区切りで指定可能。
// 例: cdk deploy --context logoutUrls=https://xxx.cloudfront.net
const logoutUrlsRaw: string | undefined = app.node.tryGetContext('logoutUrls');
const logoutUrls = logoutUrlsRaw
  ? logoutUrlsRaw
      .split(',')
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0)
  : undefined;

new CookingPlannerStack(app, `CookingPlanner-${stage}`, {
  stage,
  allowedOrigins,
  callbackUrls,
  logoutUrls,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  tags: {
    Project: 'cooking-planner',
    Stage: stage,
  },
});
