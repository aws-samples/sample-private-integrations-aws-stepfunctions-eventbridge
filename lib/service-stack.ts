import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as route53_targets from 'aws-cdk-lib/aws-route53-targets';

interface ServiceStackProps extends cdk.StackProps {
  cluster: ecs.Cluster;
  domainName: string;
  subDomain: string;
  certificateArn: string;
}

export class ServiceStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly targetPort: number = 80;

  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    // Create ALB first
    const albSecurityGroup = new ec2.SecurityGroup(this, 'AlbSecurityGroup', {
      vpc: props.cluster.vpc,
      allowAllOutbound: true,
      description: 'Security group for ALB'
    });

    albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      'Allow HTTPS inbound'
    );

    const hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName: props.domainName
    });

    const cert = acm.Certificate.fromCertificateArn(this, 'Cert', props.certificateArn);

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc: props.cluster.vpc,
      internetFacing: false,
      securityGroup: albSecurityGroup
    });

    const listener = this.loadBalancer.addListener('Listener', {
      certificates: [cert],
      protocol: elbv2.ApplicationProtocol.HTTPS,
      port: 443
    });

    // Create service components
    const logGroup = new logs.LogGroup(this, 'ServiceLogGroup', {
      retention: logs.RetentionDays.ONE_DAY,
      removalPolicy: cdk.RemovalPolicy.DESTROY
    });

    const task = new ecs.FargateTaskDefinition(this, 'Task', {
      memoryLimitMiB: 512,
      cpu: 256,
      family: 'ecs-web',
      runtimePlatform: {
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        cpuArchitecture: ecs.CpuArchitecture.ARM64
      },
    });

    const apiImage = ecs.ContainerImage.fromAsset(path.join(__dirname, '../api-container'), {
      file: 'Dockerfile'
    });

    task.addContainer('Container', {
      image: apiImage,
      portMappings: [
        {
          containerPort: this.targetPort,
          hostPort: this.targetPort
        }
      ],
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: 'ecs',
        logGroup: logGroup,
        mode: ecs.AwsLogDriverMode.NON_BLOCKING
      }),
      healthCheck: {
        command: [
          'CMD-SHELL',
          `curl -f http://localhost:${this.targetPort}/health || exit 1`
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60)
      }
    });

    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: props.cluster.vpc,
      allowAllOutbound: true,
      description: 'Security group for ECS service'
    });

    // Allow inbound from ALB
    serviceSecurityGroup.addIngressRule(
      albSecurityGroup,
      ec2.Port.tcp(this.targetPort),
      'Allow inbound from ALB'
    );

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: props.cluster,
      taskDefinition: task,
      desiredCount: 2,
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      securityGroups: [serviceSecurityGroup]
    });

    // Create target group and add service
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc: props.cluster.vpc,
      port: this.targetPort,
      targetType: elbv2.TargetType.IP,
      targets: [this.service],
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: {
        path: '/health',
        port: this.targetPort.toString(),
        protocol: elbv2.Protocol.HTTP,
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
        timeout: cdk.Duration.seconds(5),
        interval: cdk.Duration.seconds(30)
      }
    });

    listener.addTargetGroups('DefaultTargetGroup', {
      targetGroups: [targetGroup]
    });

    new route53.ARecord(this, 'DnsRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(
        new route53_targets.LoadBalancerTarget(this.loadBalancer)
      ),
      recordName: props.subDomain
    });
  }
}