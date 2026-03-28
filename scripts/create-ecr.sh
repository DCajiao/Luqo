REGION=us-east-1
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

for SERVICE in luqo-frontend luqo-backend luqo-db-service luqo-database; do
  aws ecr create-repository --repository-name $SERVICE --region $REGION
done