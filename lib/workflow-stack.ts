import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events from 'aws-cdk-lib/aws-events';
import * as path from 'path';
import * as fs from 'fs';

interface WorkflowStackProps extends cdk.StackProps {
  domainName: string;
  subDomain: string;
  apiKey: string;
  resourceConfigArn: string;

}

export class WorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WorkflowStackProps) {
    super(scope, id, props);

    const connection = new events.Connection(this, 'Connection', {
      authorization: events.Authorization.apiKey(
        'x-api-key',
        cdk.SecretValue.unsafePlainText(props.apiKey)
      )
    });

    (connection.node.children[0] as events.CfnConnection).addPropertyOverride(
      'InvocationConnectivityParameters',
      {
        ResourceParameters: {
          ResourceConfigurationArn: props.resourceConfigArn,
        },
      },
    );


    // Create EventBridge event bus
    const eventBus = new events.EventBus(this, 'PrivateIntegrationsEventBus', {
      eventBusName: 'private-integrations-bus'
    });

    // Create IAM role for Step Functions
    const stateMachineRole = new iam.Role(this, 'StateMachineRole', {
      assumedBy: new iam.ServicePrincipal('states.amazonaws.com')
    });

    // Add permissions for Bedrock
    stateMachineRole.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0']
    }));

    // Add permissions for EventBridge
    stateMachineRole.addToPolicy(new iam.PolicyStatement({
      actions: ['events:PutEvents'],
      resources: [eventBus.eventBusArn]
    }));

    // Add permissions for HTTP endpoint
    stateMachineRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'states:InvokeHTTPEndpoint',
        'states:StartExecution'
      ],
      resources: ['*']
    }));

    stateMachineRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'events:InvokeApiDestination',
        'events:RetrieveConnectionCredentials'
      ],
      resources: [connection.connectionArn]
    }));

    stateMachineRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'secretsmanager:GetSecretValue',
        'secretsmanager:DescribeSecret'
      ],
      resources: ['*']
    }));

    // Load and substitute values in the ASL definition
    const aslPath = path.join(__dirname, 'workflows', 'private-api.asl.json');
    let definitionString = fs.readFileSync(aslPath, 'utf-8');

    // Replace placeholders with actual values
    definitionString = definitionString
      .replace('${EndpointUrl}', `https://${props.subDomain}.${props.domainName}`)
      .replace('${ConnectionArn}', connection.connectionArn)
      .replace('${EventBusName}', eventBus.eventBusName);

    // Create the state machine with the substituted ASL definition
    new sfn.StateMachine(this, 'UserReviewProcessingStateMachine', {
      definitionBody: sfn.DefinitionBody.fromString(definitionString),
      tracingEnabled: true,
      stateMachineType: sfn.StateMachineType.STANDARD,
      timeout: cdk.Duration.minutes(5),
      role: stateMachineRole
    });
  }
}