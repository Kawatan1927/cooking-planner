import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type Stage = 'dev' | 'prod';

export interface CookingPlannerStackProps extends cdk.StackProps {
  /** デプロイ対象の環境。"dev" または "prod" */
  stage: Stage;
}

/**
 * CookingPlanner のベーススタック。
 *
 * 現時点ではリソースを持たない空スタックです。
 * 後続の Issue で DynamoDB / Lambda / API Gateway / Cognito / S3+CloudFront
 * などのリソースをここに追加していきます。
 *
 * @see docs/05-architecture-notes.md
 * @see infra/CDK_INTEGRATION.md
 */
export class CookingPlannerStack extends cdk.Stack {
  /** デプロイ対象の環境名 ("dev" / "prod") */
  public readonly stage: Stage;

  constructor(scope: Construct, id: string, props: CookingPlannerStackProps) {
    super(scope, id, props);

    this.stage = props.stage;

    // TODO(後続Issue): DynamoDB テーブルをここに追加する
    // TODO(後続Issue): Lambda 関数をここに追加する
    // TODO(後続Issue): API Gateway HTTP API をここに追加する
    // TODO(後続Issue): Cognito User Pool をここに追加する
    // TODO(後続Issue): S3 + CloudFront をここに追加する
  }
}
