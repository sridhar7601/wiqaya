#!/usr/bin/env bash
# Deploy Wiqaya to AWS:
#   private S3 bucket (site files) + CloudFront (HTTPS link, *.cloudfront.net) + one Lambda function URL behind /api/*.
# Safe to re-run: it updates the site and the function. Resource ids live in infra/aws/state.json (git-ignored).
#
# Needs: AWS CLI v2 signed in to a PERSONAL account (AWS_PROFILE or AWS_* env vars), node, zip.
# Usage:  npm run deploy:aws          (builds, runs the tests, then deploys)
# Azure:  bash infra/aws/set-ai-key.sh   (prompts for the key; it never goes into a file or the chat)
set -euo pipefail
cd "$(dirname "$0")/../.."

REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}"
APP=wiqaya
STATE=infra/aws/state.json
BUILD=infra/aws/build
export AWS_PAGER=""

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
CALLER=$(aws sts get-caller-identity --query Arn --output text)
echo "Deploying to account $ACCOUNT ($CALLER) in $REGION"
if [[ "${CALLER}" == *"@presidio.com"* && "${ALLOW_WORK_ACCOUNT:-}" != "yes" ]]; then
  echo "Refusing: this looks like an employer account. Use a personal account, or set ALLOW_WORK_ACCOUNT=yes once you have written permission." >&2
  exit 1
fi

BUCKET="${APP}-site-${ACCOUNT}-${REGION}"
FN="${APP}-ai"
ROLE="${APP}-ai-role"
mkdir -p "$BUILD"

sget() { node -e 'const fs=require("fs");const p=process.argv[1];const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};process.stdout.write(s[process.argv[2]]||"")' "$STATE" "$1"; }
sset() { node -e 'const fs=require("fs");const p=process.argv[1];const s=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):{};s[process.argv[2]]=process.argv[3];fs.writeFileSync(p,JSON.stringify(s,null,2)+"\n")' "$STATE" "$1" "$2"; }

[[ -f dist/index.html ]] || { echo "dist/ is missing. Run: npm run build" >&2; exit 1; }

# ---------- 1. S3 bucket (private) ----------
if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Creating bucket $BUCKET"
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
  fi
fi
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ---------- 2. Lambda role ----------
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  echo "Creating role $ROLE"
  aws iam create-role --role-name "$ROLE" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam attach-role-policy --role-name "$ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  echo "Waiting for the role to propagate…"
  sleep 12
fi
ROLE_ARN=$(aws iam get-role --role-name "$ROLE" --query Role.Arn --output text)

# ---------- 3. Lambda function ----------
SECRET=$(sget originSecret)
if [[ -z "$SECRET" ]]; then SECRET=$(node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("hex"))'); sset originSecret "$SECRET"; fi

rm -f "$BUILD/ai.zip"
zip -j -q "$BUILD/ai.zip" infra/ai/index.mjs

# Keep any Azure settings already on the function; add/override from the shell if exported.
CURRENT_ENV=$(aws lambda get-function-configuration --function-name "$FN" --query 'Environment.Variables' --output json 2>/dev/null || echo '{}')
ENV_JSON=$(CURRENT_ENV="$CURRENT_ENV" SECRET="$SECRET" node -e '
  const cur = JSON.parse(process.env.CURRENT_ENV || "{}") || {};
  for (const k of ["AZURE_OPENAI_ENDPOINT","AZURE_OPENAI_DEPLOYMENT","AZURE_OPENAI_API_KEY","AZURE_OPENAI_API_VERSION","AZURE_OPENAI_REASONING_EFFORT"]) if (process.env[k]) cur[k] = process.env[k];
  cur.ORIGIN_SECRET = process.env.SECRET;
  process.stdout.write(JSON.stringify({ Variables: cur }));')

if aws lambda get-function --function-name "$FN" >/dev/null 2>&1; then
  echo "Updating function $FN"
  aws lambda update-function-code --function-name "$FN" --zip-file "fileb://$BUILD/ai.zip" >/dev/null
  aws lambda wait function-updated --function-name "$FN"
  aws lambda update-function-configuration --function-name "$FN" --environment "$ENV_JSON" >/dev/null
  aws lambda wait function-updated --function-name "$FN"
else
  echo "Creating function $FN"
  aws lambda create-function --function-name "$FN" --runtime nodejs22.x --architectures arm64 \
    --role "$ROLE_ARN" --handler index.handler --zip-file "fileb://$BUILD/ai.zip" \
    --timeout 30 --memory-size 256 --environment "$ENV_JSON" >/dev/null
  aws lambda wait function-active --function-name "$FN"
fi

if ! aws lambda get-function-url-config --function-name "$FN" >/dev/null 2>&1; then
  aws lambda create-function-url-config --function-name "$FN" --auth-type NONE >/dev/null
  aws lambda add-permission --function-name "$FN" --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl --principal "*" --function-url-auth-type NONE >/dev/null
  # Newer accounts also require InvokeFunction for URL calls; ignore if this CLI/account does not support the flag.
  aws lambda add-permission --function-name "$FN" --statement-id FunctionURLInvokeAllowPublicAccess \
    --action lambda:InvokeFunction --principal "*" --invoked-via-function-url >/dev/null 2>&1 || true
fi
FN_URL=$(aws lambda get-function-url-config --function-name "$FN" --query FunctionUrl --output text)
FN_DOMAIN=$(echo "$FN_URL" | sed -E 's#^https://##; s#/$##')

# ---------- 4. CloudFront ----------
OAC=$(sget oacId)
if [[ -z "$OAC" ]]; then
  OAC=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config "Name=${APP}-oac-${ACCOUNT},SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3" \
    --query OriginAccessControl.Id --output text)
  sset oacId "$OAC"
fi

DIST=$(sget distributionId)
if [[ -z "$DIST" ]]; then
  echo "Creating CloudFront distribution (takes a few minutes to go live)"
  BUCKET="$BUCKET" REGION="$REGION" OAC="$OAC" FN_DOMAIN="$FN_DOMAIN" SECRET="$SECRET" node -e '
    const e = process.env;
    const cfg = {
      CallerReference: "wiqaya-" + Date.now(),
      Comment: "Wiqaya prototype",
      Enabled: true,
      DefaultRootObject: "index.html",
      PriceClass: "PriceClass_100",
      HttpVersion: "http2and3",
      Origins: { Quantity: 2, Items: [
        { Id: "s3", DomainName: `${e.BUCKET}.s3.${e.REGION}.amazonaws.com`, S3OriginConfig: { OriginAccessIdentity: "" }, OriginAccessControlId: e.OAC },
        { Id: "ai", DomainName: e.FN_DOMAIN,
          CustomOriginConfig: { HTTPPort: 80, HTTPSPort: 443, OriginProtocolPolicy: "https-only", OriginSslProtocols: { Quantity: 1, Items: ["TLSv1.2"] } },
          CustomHeaders: { Quantity: 1, Items: [{ HeaderName: "x-origin-secret", HeaderValue: e.SECRET }] } },
      ] },
      DefaultCacheBehavior: {
        TargetOriginId: "s3", ViewerProtocolPolicy: "redirect-to-https", Compress: true,
        CachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",           // Managed-CachingOptimized
        ResponseHeadersPolicyId: "67f7725c-6f97-4210-82d7-5512b31e9d03",  // Managed-SecurityHeadersPolicy
        AllowedMethods: { Quantity: 2, Items: ["GET", "HEAD"], CachedMethods: { Quantity: 2, Items: ["GET", "HEAD"] } },
      },
      CacheBehaviors: { Quantity: 1, Items: [{
        PathPattern: "/api/*", TargetOriginId: "ai", ViewerProtocolPolicy: "https-only", Compress: true,
        CachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",            // Managed-CachingDisabled
        OriginRequestPolicyId: "b689b0a8-53d0-40ab-baf2-68738e2966ac",    // Managed-AllViewerExceptHostHeader
        AllowedMethods: { Quantity: 7, Items: ["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"], CachedMethods: { Quantity: 2, Items: ["GET","HEAD"] } },
      }] },
    };
    require("fs").writeFileSync("infra/aws/build/distribution.json", JSON.stringify(cfg));'
  DIST=$(aws cloudfront create-distribution --distribution-config "file://$BUILD/distribution.json" --query Distribution.Id --output text)
  sset distributionId "$DIST"
fi
DOMAIN=$(aws cloudfront get-distribution --id "$DIST" --query Distribution.DomainName --output text)

# ---------- 5. Bucket policy: only this CloudFront distribution may read ----------
aws s3api put-bucket-policy --bucket "$BUCKET" --policy "{
  \"Version\":\"2012-10-17\",
  \"Statement\":[{\"Sid\":\"AllowCloudFrontRead\",\"Effect\":\"Allow\",
    \"Principal\":{\"Service\":\"cloudfront.amazonaws.com\"},
    \"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::${BUCKET}/*\",
    \"Condition\":{\"StringEquals\":{\"AWS:SourceArn\":\"arn:aws:cloudfront::${ACCOUNT}:distribution/${DIST}\"}}}]}"

# ---------- 6. Upload the site ----------
aws s3 sync dist/ "s3://$BUCKET/" --delete --exclude index.html --exclude favicon.svg \
  --cache-control "public,max-age=31536000,immutable" >/dev/null
aws s3 cp dist/favicon.svg "s3://$BUCKET/favicon.svg" --cache-control "public,max-age=3600" >/dev/null
aws s3 cp dist/index.html "s3://$BUCKET/index.html" --cache-control "no-cache" >/dev/null
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/" "/index.html" >/dev/null

echo
echo "Done. Live link (first deploy can take ~5 minutes): https://$DOMAIN/"
echo "Arabic link:  https://$DOMAIN/#/?lang=ar"
