import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lattice from 'aws-cdk-lib/aws-vpclattice';
import * as ram from 'aws-cdk-lib/aws-ram';

interface VpcLatticeStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  domainName: string;
  subDomain: string;
  shareAccount: string;
}

export class VpcLatticeStack extends cdk.Stack {
  public readonly resourceConfig: lattice.CfnResourceConfiguration
  constructor(scope: Construct, id: string, props: VpcLatticeStackProps) {
    super(scope, id, props);

    const rgSecurityGroup = new ec2.SecurityGroup(this, 'ResourceGatewaySG', {
      vpc: props.vpc,
      allowAllOutbound: false,
    });

    rgSecurityGroup.addEgressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(443),
      'Allow HTTPS traffic from Resource Gateway',
    );

    const resourceGateway = new lattice.CfnResourceGateway(this, 'ResourceGateway', {
      name: 'private-api-access',
      ipAddressType: 'IPV4',
      vpcIdentifier: props.vpc.vpcId,
      subnetIds: props.vpc.selectSubnets({
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      }).subnetIds,
      securityGroupIds: [rgSecurityGroup.securityGroupId],
    });

    this.resourceConfig = new lattice.CfnResourceConfiguration(
      this,
      'ResourceConfig',
      {
        name: 'sf-private-api',
        portRanges: ['443'],
        resourceGatewayId: resourceGateway.ref,
        resourceConfigurationType: 'SINGLE',
      },
    );

    this.resourceConfig.addPropertyOverride(
      'ResourceConfigurationDefinition.DnsResource',
      {
        DomainName: `${props.subDomain}.${props.domainName}`,
        IpAddressType: 'IPV4',
      },
    );

    new ram.CfnResourceShare(this, 'ResourceShare', {
      name: 'private-api-access',
      allowExternalPrincipals: true,
      principals: [props.shareAccount],
      resourceArns: [this.resourceConfig.attrArn],
    });
  }
}