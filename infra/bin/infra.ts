#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { CookingPlannerStack } from '../lib/cooking-planner-stack';

const app = new cdk.App();

// Get stage from context or default to 'prod'
const stage = app.node.tryGetContext('stage') || 'prod';

new CookingPlannerStack(app, `CookingPlannerStack-${stage}`, {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  stage,
});
