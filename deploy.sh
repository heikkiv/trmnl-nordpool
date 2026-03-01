#!/usr/bin/env bash
set -euo pipefail

FUNCTION_NAME="trmnl-nordpool"
REGION="eu-west-1"
RUNTIME="nodejs24.x"
ARCH="arm64"
MEMORY=256
TIMEOUT=15
ZIP_FILE="lambda.zip"

if [ -z "${LAMBDA_ROLE_ARN:-}" ]; then
  echo "Error: LAMBDA_ROLE_ARN environment variable is required"
  echo "  export LAMBDA_ROLE_ARN=arn:aws:iam::123456789012:role/your-lambda-role"
  exit 1
fi

echo "Packaging Lambda function..."
rm -f "$ZIP_FILE"
zip -j "$ZIP_FILE" src/lambda.js src/nordpool.js src/markup.js

# Check if function already exists
if aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then
  echo "Updating existing function..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --zip-file "fileb://$ZIP_FILE" \
    --output text --query 'FunctionArn'

  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --runtime "$RUNTIME" \
    --memory-size "$MEMORY" \
    --timeout "$TIMEOUT" \
    --environment "Variables={NORDPOOL_AREA=${NORDPOOL_AREA:-FI},NORDPOOL_CURRENCY=${NORDPOOL_CURRENCY:-EUR}}" \
    --output text --query 'FunctionArn' > /dev/null

  # Ensure Function URL exists with NONE auth
  if ! aws lambda get-function-url-config --function-name "$FUNCTION_NAME" --region "$REGION" > /dev/null 2>&1; then
    echo "Creating Function URL..."
    aws lambda create-function-url-config \
      --function-name "$FUNCTION_NAME" \
      --region "$REGION" \
      --auth-type NONE \
      --output text --query 'FunctionUrl' > /dev/null
  fi

  # Ensure public invoke permissions exist
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --statement-id "AllowPublicAccess" \
    --action "lambda:InvokeFunctionUrl" \
    --principal "*" \
    --function-url-auth-type NONE \
    --output text > /dev/null 2>&1 || true

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --statement-id "AllowPublicInvoke" \
    --action "lambda:InvokeFunction" \
    --principal "*" \
    --output text > /dev/null 2>&1 || true
else
  echo "Creating new function..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --runtime "$RUNTIME" \
    --architectures "$ARCH" \
    --handler "lambda.handler" \
    --role "$LAMBDA_ROLE_ARN" \
    --zip-file "fileb://$ZIP_FILE" \
    --memory-size "$MEMORY" \
    --timeout "$TIMEOUT" \
    --environment "Variables={NORDPOOL_AREA=${NORDPOOL_AREA:-FI},NORDPOOL_CURRENCY=${NORDPOOL_CURRENCY:-EUR}}" \
    --output text --query 'FunctionArn'

  echo "Waiting for function to become active..."
  aws lambda wait function-active-v2 --function-name "$FUNCTION_NAME" --region "$REGION"

  echo "Creating Function URL..."
  FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --auth-type NONE \
    --output text --query 'FunctionUrl')

  echo "Adding public invoke permissions..."
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --statement-id "AllowPublicAccess" \
    --action "lambda:InvokeFunctionUrl" \
    --principal "*" \
    --function-url-auth-type NONE \
    --output text > /dev/null

  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --region "$REGION" \
    --statement-id "AllowPublicInvoke" \
    --action "lambda:InvokeFunction" \
    --principal "*" \
    --output text > /dev/null
fi

# Get the Function URL
FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION" \
  --output text --query 'FunctionUrl' 2>/dev/null || echo "")

echo ""
echo "Deployed successfully!"
if [ -n "$FUNCTION_URL" ]; then
  echo "  Function URL: $FUNCTION_URL"
  echo "  Webhook:      ${FUNCTION_URL}api/trmnl"
  echo "  Health:       ${FUNCTION_URL}health"
fi

rm -f "$ZIP_FILE"
