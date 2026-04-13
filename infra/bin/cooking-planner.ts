#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CookingPlannerStack } from '../lib/cooking-planner-stack';

const app = new cdk.App();

// CDK context から stage を取得。未指定時は 'dev' をデフォルト値とする。
// 例: cdk synth --context stage=prod
const stage: string = app.node.tryGetContext('stage') ?? 'dev';

if (stage !== 'dev' && stage !== 'prod') {
  throw new Error(`Invalid stage: "${stage}". Allowed values are "dev" or "prod".`);
}

new CookingPlannerStack(app, `CookingPlanner-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
  tags: {
    Project: 'cooking-planner',
    Stage: stage,
  },
});
