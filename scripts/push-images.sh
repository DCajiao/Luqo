#!/bin/bash
set -e
echo "=== Push Docker Images to ECR ==="
# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "Project root: $PROJECT_ROOT"
cd "$PROJECT_ROOT"
# AWS Profile
AWS_PROFILE="aws-academy"
# Get AWS Account ID and Region
ACCOUNT_ID=$(aws sts get-caller-identity --profile $AWS_PROFILE --query Account --output text)
REGION="us-east-1"
ECR_REGISTRY="$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
echo "Account ID: $ACCOUNT_ID"
echo "ECR Registry: $ECR_REGISTRY"
# Login to ECR
echo "Logging in to Amazon ECR..."
aws ecr get-login-password --profile $AWS_PROFILE --region $REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

# Build and push each image
echo "Building and pushing images..."

for SERVICE in frontend backend db-service database; do
  IMAGE="$ECR_REGISTRY/luqo-$SERVICE:latest"
  echo "  - Building $IMAGE..."
  docker build -t $IMAGE ./microservices/$SERVICE
  echo "  - Pushing $IMAGE..."
  docker push $IMAGE
  echo "  ✓ Done: $IMAGE"
done

echo "=== All images pushed successfully ==="