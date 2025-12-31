#!/bin/bash

# Script to set up all GCP resources
# Usage: ./scripts/setup-gcp.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-us-central1}

if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID not specified. Use: ./scripts/setup-gcp.sh PROJECT_ID [REGION]"
  echo "   or set GOOGLE_CLOUD_PROJECT environment variable"
  exit 1
fi

echo "🚀 Setting up GCP infrastructure for QA Space"
echo "=============================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📦 Enabling required APIs..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage-api.googleapis.com \
  iam.googleapis.com

# Create Service Account for Cloud Run
echo ""
echo "👤 Creating Service Account..."
SA_NAME="qa-space-backend"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
  gcloud iam service-accounts create $SA_NAME \
    --display-name="QA Space Backend Service Account" \
    --description="Service account for QA Space backend application"
  echo "✅ Service Account created"
else
  echo "⚠️  Service Account already exists"
fi

# Grant permissions to Service Account
echo ""
echo "🔐 Setting up Service Account permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

# Create Cloud SQL instance
echo ""
echo "🗄️  Creating Cloud SQL PostgreSQL instance..."
DB_INSTANCE="qa-space-db"
DB_NAME="qa_space"
DB_USER="postgres"

if ! gcloud sql instances describe $DB_INSTANCE &>/dev/null; then
  echo "⚠️  Creating Cloud SQL instance (this may take 5-10 minutes)..."
  read -p "Enter password for postgres user: " -s DB_PASSWORD
  echo ""
  
  gcloud sql instances create $DB_INSTANCE \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=$REGION \
    --root-password=$DB_PASSWORD \
    --storage-type=SSD \
    --storage-size=10GB \
    --backup-start-time=03:00 \
    --enable-bin-log \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=04 \
    --maintenance-release-channel=production \
    --deletion-protection
  
  # Create database
  gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE
  
  # Get connection name
  CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
  
  echo "✅ Cloud SQL instance created"
  echo "   Connection Name: $CONNECTION_NAME"
  echo "   Database: $DB_NAME"
  echo "   Username: $DB_USER"
  echo ""
  echo "⚠️  Save the password! It will be needed for DATABASE_URL"
else
  echo "⚠️  Cloud SQL instance already exists"
  CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
fi

# Create GCS bucket for files
echo ""
echo "📦 Creating GCS bucket for files..."
BUCKET_NAME="${PROJECT_ID}-qa-space-files"

if ! gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
  gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
  gsutil uniformbucketlevelaccess set on gs://$BUCKET_NAME
  echo "✅ GCS bucket created: $BUCKET_NAME"
else
  echo "⚠️  GCS bucket already exists: $BUCKET_NAME"
fi

# Create Service Account for GCS access
echo ""
echo "🔑 Creating Service Account for GCS..."
GCS_SA_NAME="qa-space-gcs"
GCS_SA_EMAIL="${GCS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $GCS_SA_EMAIL &>/dev/null; then
  gcloud iam service-accounts create $GCS_SA_NAME \
    --display-name="QA Space GCS Service Account" \
    --description="Service account for GCS access"
  
  # Create key for Service Account
  gcloud iam service-accounts keys create /tmp/gcs-key.json \
    --iam-account=$GCS_SA_EMAIL
  
  # Grant permissions on bucket
  gsutil iam ch serviceAccount:${GCS_SA_EMAIL}:objectAdmin gs://$BUCKET_NAME
  
  echo "✅ GCS Service Account created"
  echo "   Key saved to /tmp/gcs-key.json"
  echo "   ⚠️  Save this key! It will be needed for S3_ACCESS_KEY and S3_SECRET_KEY"
else
  echo "⚠️  GCS Service Account already exists"
fi

# Create Secret Manager secrets
echo ""
echo "🔐 Setting up Secret Manager..."
SECRET_NAME="qa-space-secrets"

# Request required data
if [ -z "$DB_PASSWORD" ]; then
  read -p "Enter Cloud SQL password: " -s DB_PASSWORD
  echo ""
fi

read -p "Enter JWT_ACCESS_SECRET (or press Enter for auto-generation): " JWT_ACCESS_SECRET
if [ -z "$JWT_ACCESS_SECRET" ]; then
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  echo "✅ Generated JWT_ACCESS_SECRET"
fi

read -p "Enter JWT_REFRESH_SECRET (or press Enter for auto-generation): " JWT_REFRESH_SECRET
if [ -z "$JWT_REFRESH_SECRET" ]; then
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  echo "✅ Generated JWT_REFRESH_SECRET"
fi

read -p "Enter ALLOWED_ORIGINS (comma-separated, e.g.: https://example.com,https://app.example.com): " ALLOWED_ORIGINS
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"*"}

# Get data from GCS key
if [ -f /tmp/gcs-key.json ]; then
  GCS_ACCESS_KEY=$(cat /tmp/gcs-key.json | jq -r '.client_email')
  GCS_SECRET_KEY=$(cat /tmp/gcs-key.json | jq -r '.private_key' | base64 -w 0)
else
  echo "⚠️  GCS key not found. Enter manually:"
  read -p "GCS Access Key (client_email): " GCS_ACCESS_KEY
  read -p "GCS Secret Key (private_key in base64): " -s GCS_SECRET_KEY
  echo ""
fi

# Build DATABASE_URL
DB_HOST=$(gcloud sql instances describe $DB_INSTANCE --format="value(ipAddresses[0].ipAddress)")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# GCS endpoint for S3-compatible API
GCS_ENDPOINT="https://storage.googleapis.com"

# Create JSON secret
# IMPORTANT: S3_SECRET_KEY must be in base64 for proper GCS operation
SECRET_JSON=$(cat <<EOF
{
  "DATABASE_URL": "${DATABASE_URL}",
  "JWT_ACCESS_SECRET": "${JWT_ACCESS_SECRET}",
  "JWT_REFRESH_SECRET": "${JWT_REFRESH_SECRET}",
  "S3_BUCKET": "${BUCKET_NAME}",
  "S3_REGION": "${REGION}",
  "S3_ENDPOINT": "${GCS_ENDPOINT}",
  "S3_ACCESS_KEY": "${GCS_ACCESS_KEY}",
  "S3_SECRET_KEY": "${GCS_SECRET_KEY}",
  "ALLOWED_ORIGINS": "${ALLOWED_ORIGINS}"
}
EOF
)

# Save to temporary file
echo "$SECRET_JSON" > /tmp/secrets.json

# Create or update secret
if gcloud secrets describe $SECRET_NAME &>/dev/null; then
  echo "🔄 Updating existing secret..."
  gcloud secrets versions add $SECRET_NAME --data-file=/tmp/secrets.json
else
  echo "✨ Creating new secret..."
  gcloud secrets create $SECRET_NAME --data-file=/tmp/secrets.json --replication-policy="automatic"
fi

# Grant Service Account access to secret
gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Cleanup
rm -f /tmp/secrets.json

echo ""
echo "✅ Setup completed!"
echo ""
echo "📋 Next steps:"
echo "1. Run migrations: ./scripts/run-migrations-gcp.sh"
echo "2. Deploy application: ./scripts/deploy-gcp.sh"
echo ""
echo "📊 Useful commands:"
echo "   gcloud run services describe qa-space-backend --region=$REGION"
echo "   gcloud sql instances describe $DB_INSTANCE"
echo "   gsutil ls gs://$BUCKET_NAME"

