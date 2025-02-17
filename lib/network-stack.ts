import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

interface NetworkStackProps extends cdk.StackProps {
  maxAzs?: number;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: NetworkStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: props?.maxAzs || 2
    });
  }
}