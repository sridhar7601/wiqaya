#!/usr/bin/env bash
# Puts the Azure OpenAI settings on the deployed Lambda. The key is typed in hidden and never written to disk.
set -euo pipefail
export AWS_PAGER=""
FN=wiqaya-ai

read -r -p "Azure OpenAI endpoint (https://<resource>.openai.azure.com): " ENDPOINT
read -r -p "Deployment name (e.g. gpt-4o-mini): " DEPLOYMENT
read -r -p "API version [2024-10-21, or v1]: " VERSION
read -r -s -p "API key (hidden): " KEY; echo

CURRENT=$(aws lambda get-function-configuration --function-name "$FN" --query 'Environment.Variables' --output json)
ENV_JSON=$(CURRENT="$CURRENT" ENDPOINT="$ENDPOINT" DEPLOYMENT="$DEPLOYMENT" VERSION="${VERSION:-2024-10-21}" KEY="$KEY" node -e '
  const v = JSON.parse(process.env.CURRENT || "{}") || {};
  v.AZURE_OPENAI_ENDPOINT = process.env.ENDPOINT;
  v.AZURE_OPENAI_DEPLOYMENT = process.env.DEPLOYMENT;
  v.AZURE_OPENAI_API_VERSION = process.env.VERSION;
  v.AZURE_OPENAI_API_KEY = process.env.KEY;
  process.stdout.write(JSON.stringify({ Variables: v }));')
aws lambda update-function-configuration --function-name "$FN" --environment "$ENV_JSON" >/dev/null
aws lambda wait function-updated --function-name "$FN"
echo "Azure settings saved on $FN. Try 'Explain my result' on the live site."
