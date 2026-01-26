#!/usr/bin/env bash
set -euo pipefail

# Deploy frontend/build to S3 bucket and optionally invalidate CloudFront
# Requires: AWS CLI configured with an IAM user that can put objects and create invalidation

FRONTEND_DIR="$(cd "$(dirname "$0")/.." && pwd)/frontend/build"
BUCKET="${S3_BUCKET:-your-bucket-name}"
CLOUDFRONT_DISTRIBUTION_ID="${CLOUDFRONT_DISTRIBUTION_ID:-}"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo "Frontend build not found at $FRONTEND_DIR" >&2
  exit 2
fi

if [ -z "$BUCKET" ] || [ "$BUCKET" = "your-bucket-name" ]; then
  echo "Set S3_BUCKET env var to your target bucket." >&2
  exit 2
fi

echo "Syncing $FRONTEND_DIR -> s3://$BUCKET"
aws s3 sync "$FRONTEND_DIR" "s3://$BUCKET" --delete --acl public-read

if [ -n "$CLOUDFRONT_DISTRIBUTION_ID" ]; then
  echo "Creating CloudFront invalidation for distribution $CLOUDFRONT_DISTRIBUTION_ID"
  aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
fi

echo "Deploy complete."
