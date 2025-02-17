#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { ClusterStack } from '../lib/cluster-stack';
import { ServiceStack } from '../lib/service-stack';
import { VpcLatticeStack } from '../lib/vpclattice-stack';
import { WorkflowStack } from '../lib/workflow-stack';
import * as dotenv from 'dotenv';

dotenv.config();

const app = new cdk.App();

// Environment variables
const domainName = process.env.DOMAIN_NAME as string;
const subDomain = process.env.SUB_DOMAIN_NAME as string;
const acmCertArn = process.env.ACM_CERT_ARN as string;
const apiKey = process.env.API_KEY as string;
const shareAccount = process.env.SECONDARY_ACCOUNT as string;

// Create a single environment configuration for all stacks
const environment = {
  account: process.env.DEFAULT_ACCOUNT,
  region: process.env.DEFAULT_REGION,
};

// Create stacks with the same environment
const networkStack = new NetworkStack(app, 'NetworkStack', {
  env: environment,
  maxAzs: 2,
  description: 'Network infrastructure including VPC and subnets'
});

const clusterStack = new ClusterStack(app, 'ClusterStack', {
  env: environment,
  vpc: networkStack.vpc,
  description: 'ECS Cluster configuration'
});

const serviceStack = new ServiceStack(app, 'ServiceStack', {
  env: environment,
  cluster: clusterStack.cluster,
  domainName,
  subDomain,
  certificateArn: acmCertArn,
  description: 'ECS Service, ALB, and DNS configuration'
});

const vpcLatticeStack = new VpcLatticeStack(app, 'VpcLatticeStack', {
  env: environment,
  vpc: networkStack.vpc,
  domainName,
  subDomain,
  shareAccount,
  description: 'VPC Lattice configuration'
});

const workflowStack = new WorkflowStack(app, 'WorkflowStack', {
  env: environment,
  resourceConfigArn: vpcLatticeStack.resourceConfig.attrArn,
  domainName,
  subDomain,
  apiKey,
  description: 'EventBridge and Step Functions workflow'
});

// Add dependencies
clusterStack.addDependency(networkStack);
serviceStack.addDependency(clusterStack);
vpcLatticeStack.addDependency(networkStack);
workflowStack.addDependency(vpcLatticeStack);

// Add tags to all stacks
const tags = {
  Environment: process.env.ENVIRONMENT || 'development',
  Project: 'EcsAPI',
  ManagedBy: 'CDK'
};

cdk.Tags.of(app).add('Project', tags.Project);
cdk.Tags.of(app).add('ManagedBy', tags.ManagedBy);
cdk.Tags.of(app).add('Environment', tags.Environment);