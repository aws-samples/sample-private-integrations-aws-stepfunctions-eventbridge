// lib/cluster-stack.ts
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';

interface ClusterStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
}

export class ClusterStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props: ClusterStackProps) {
    super(scope, id, props);

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: props.vpc,
      clusterName: cdk.PhysicalName.GENERATE_IF_NEEDED,
      enableFargateCapacityProviders: true,
    });
  }
}