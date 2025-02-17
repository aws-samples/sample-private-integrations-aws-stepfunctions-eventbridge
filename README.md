# ECS Private API with Shared Resource Pattern

This CDK project deploys a private ECS API service with ALB and VPC Lattice for shared resource access. The infrastructure is split into logical stacks for better maintainability and reuse.

## Architecture

The project creates the following AWS resources:

- VPC with public and private subnets
- ECS Fargate cluster
- ECS service with container task
- Internal Application Load Balancer
- Route53 DNS records
- VPC Lattice resource gateway for private API access
- RAM resource for cross account access
- An EventBridge connection to connect to the private API
- A Step Functions workflow to demosntrate calling a private API directly

### Stack Structure

The infrastructure is divided into the following stacks:

1. **NetworkStack**: Base networking infrastructure
   - VPC
   - Public and private subnets
   - Internet Gateway
   - NAT Gateways

2. **ClusterStack**: ECS cluster configuration
   - ECS Fargate cluster
   - Cluster security group

3. **ServiceStack**: Application components
   - ECS service and task definition
   - Application Load Balancer
   - Security groups
   - Route53 records
   - ACM certificate integration

4. **VpcLatticeStack**: Shared resource configuration
   - VPC Lattice resource gateway
   - Resource configuration for private API access
   - RAM configuration for sharing the private endpoint with a secondary account
5. **WorkflowStack**: Demonstration application outside of VPC
   - Amazon EventBridge connection
   - AWS Step Functions workflow

## Prerequisites

- Node.js 16.x or later
- AWS CDK CLI v2
- AWS credentials configured
- Docker or Finch (for building container images)
- Public hosted zone for your domain in Amazon Route 53 
- ACM certificate for your domain

### Container Runtime
This project can use either Docker or Finch for building container images. Ensure you have one of these installed:
- Docker Desktop or Docker Engine
- Finch (docker-compatible container runtime)

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file
```
cp .env.example .env
```

4. Configure your environment variables in `.env`:
```
DOMAIN_NAME="<your domain name>"        # example mydomain.com
SUB_DOMAIN_NAME="<sub domain name>"     # sub domain for above domain 'ecs'
ACM_CERT_ARN="<ACM Cert Arn>"           # Cert arn for above subdomain 'https://ecs.mydomain.com'"
API_KEY="<API Key in app>"              # If you use demo app it is 1234567890
DEFAULT_ACCOUNT="<default account>"     # Primary account this is installed to
DEFAULT_REGION="<region>"               # Default region for primary account
SECONDARY_ACCOUNT="<secondary account>" # Account to share with via RAM
```

## Deployment

Deploy all stacks:
```bash
npm run deploy
```

Or deploy individual stacks:
```bash
npm run deploy:network
npm run deploy:cluster
npm run deploy:service
npm run deploy:lattice
npm run deploy:workflow
```

## Clean Up

To destroy all resources:
```bash
npm run destroy
```

## Project Structure

```
.
├── bin/
│   └── app.ts              # Entry point
├── lib/
│   ├── network-stack.ts    # VPC and networking
│   ├── cluster-stack.ts    # ECS Cluster
│   ├── service-stack.ts    # Service and ALB
│   ├── vpclattice-stack.ts # VPC Lattice configuration
│   └── workflow-stack.ts   # Workflow configuration
├── api-container/
│   └── Dockerfile          # API container definition
├── .env                    # Environment variables
├── cdk.json                # CDK configuration
└── package.json            # Project dependencies
```

## Available Scripts

- `npm run build`: Compile TypeScript code
- `npm run watch`: Watch for changes and compile
- `npm run test`: Run the test suite
- `npm run deploy`: Deploy all stacks
- `npm run deploy:network`: Deploy network stack
- `npm run deploy:cluster`: Deploy cluster stack
- `npm run deploy:service`: Deploy service stack
- `npm run deploy:lattice`: Deploy VPC Lattice stack
- `npm run deploy:workflow`: Deploy Workflow stack
- `npm run destroy`: Remove all deployed resources

## Security Considerations

- The Application Load Balancer is internal (not internet-facing)
- VPC endpoints are used for AWS services
- Security groups restrict access between components
- Container tasks run on Fargate with minimum required permissions
- Private subnets are used for the ECS tasks
- VPC Lattice provides secure service access for consumers

## Troubleshooting

1. **VPC Lookup Issues**
   - Ensure your AWS credentials are configured correctly
   - Check if you're in the correct AWS region
   - Verify VPC exists if using existing VPC

2. **Container Build and Health Check Issues**
   - If using Finch, ensure the service is running (`finch vm start`)
   - Verify container health check endpoint is responding
   - Check container logs in CloudWatch
   - Ensure security groups allow health check traffic
   - For Finch users: use `finch build` to test container builds locally

3. **DNS Resolution Issues**
   - Verify Route53 hosted zone exists
   - Check ACM certificate is valid and in the correct region
   - Ensure DNS records are properly propagated