#!/bin/bash

# Script to run Prisma migrations on Cloud Run
# Usage: ./scripts/run-migrations-gcp.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-us-central1}

if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID not specified. Use: ./scripts/run-migrations-gcp.sh PROJECT_ID [REGION]"
  exit 1
fi

echo "🔄 Running Prisma migrations on Cloud Run"
echo "======================================"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set the project
gcloud config set project $PROJECT_ID

# Get Cloud SQL connection name
DB_INSTANCE="qa-space-db"
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>/dev/null || echo "")

if [ -z "$CONNECTION_NAME" ]; then
  echo "❌ Cloud SQL instance not found. Run first: ./scripts/setup-gcp.sh"
  exit 1
fi

# Get Service Account
SA_EMAIL="qa-space-backend@${PROJECT_ID}.iam.gserviceaccount.com"

# Build migration image
echo "📦 Building Docker image for migrations..."
if [ -f cloudbuild.migrations.yaml ]; then
  gcloud builds submit --config=cloudbuild.migrations.yaml .
else
  # Alternative method - use docker build directly
  echo "   Using direct docker build..."
  docker build -f Dockerfile.migrations -t gcr.io/$PROJECT_ID/qa-space-migrations:latest .
  docker push gcr.io/$PROJECT_ID/qa-space-migrations:latest
fi

# Run one-time task on Cloud Run
echo ""
echo "🚀 Creating/updating Cloud Run Job for migrations..."

# Check if job exists
if gcloud run jobs describe qa-space-migrations --region=$REGION &>/dev/null; then
  echo "⚠️  Job already exists, updating..."
  gcloud run jobs update qa-space-migrations \
    --region $REGION \
    --image gcr.io/$PROJECT_ID/qa-space-migrations:latest \
    --service-account $SA_EMAIL \
    --add-cloudsql-instances $CONNECTION_NAME \
    --set-env-vars NODE_ENV=production \
    --set-secrets DATABASE_URL=qa-space-secrets:latest,DATABASE_URL \
    --memory 512Mi \
    --cpu 1 \
    --timeout 600 \
    --max-retries 1 \
    --command "sh" \
    --args "-c" \
    --args "npx prisma migrate deploy && npx prisma generate"
else
  echo "✨ Creating new Job..."
  gcloud run jobs create qa-space-migrations \
    --image gcr.io/$PROJECT_ID/qa-space-migrations:latest \
    --region $REGION \
    --service-account $SA_EMAIL \
    --add-cloudsql-instances $CONNECTION_NAME \
    --set-env-vars NODE_ENV=production \
    --set-secrets DATABASE_URL=qa-space-secrets:latest,DATABASE_URL \
    --memory 512Mi \
    --cpu 1 \
    --timeout 600 \
    --max-retries 1 \
    --command "sh" \
    --args "-c" \
    --args "npx prisma migrate deploy && npx prisma generate"
fi

# Execute job
echo ""
echo "⏳ Starting migration task..."
EXECUTION_NAME=$(gcloud run jobs execute qa-space-migrations --region=$REGION --format="value(metadata.name)")

echo "✅ Task started: $EXECUTION_NAME"
echo ""
echo "📊 Monitor execution:"
echo "   gcloud run jobs executions describe $EXECUTION_NAME --region=$REGION"
echo ""
echo "📋 View logs:"
echo "   gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=qa-space-migrations\" --limit=50 --format=json"

# Wait for completion
echo ""
echo "⏳ Waiting for migrations to complete (this may take several minutes)..."
echo "   You can track progress in Cloud Console or through logs"

# Wait for execution to complete
gcloud run jobs executions wait $EXECUTION_NAME --region=$REGION --timeout=600

# Check status
STATUS=$(gcloud run jobs executions describe $EXECUTION_NAME --region=$REGION --format="value(status.conditions[0].type)" 2>/dev/null || echo "Unknown")

if [ "$STATUS" = "Complete" ]; then
  echo ""
  echo "✅ Migrations completed successfully!"
  exit 0
else
  echo ""
  echo "⚠️  Migrations finished with status: $STATUS"
  echo "   Check logs for details:"
  echo "   gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=qa-space-migrations\" --limit=50"
  exit 1
fi

