#!/bin/bash

# Скрипт для развертывания на Cloud Run
# Использование: ./scripts/deploy-gcp.sh [PROJECT_ID] [REGION] [IMAGE_TAG]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-us-central1}
IMAGE_TAG=${3:-latest}

if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID не указан. Используйте: ./scripts/deploy-gcp.sh PROJECT_ID [REGION] [IMAGE_TAG]"
  exit 1
fi

echo "🚀 Развертывание QA Space Backend на Cloud Run"
echo "=============================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo "Image Tag: $IMAGE_TAG"
echo ""

# Устанавливаем проект
gcloud config set project $PROJECT_ID

# Получаем connection name Cloud SQL
DB_INSTANCE="qa-space-db"
CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)" 2>/dev/null || echo "")

if [ -z "$CONNECTION_NAME" ]; then
  echo "❌ Cloud SQL инстанс не найден. Сначала запустите: ./scripts/setup-gcp.sh"
  exit 1
fi

# Получаем Service Account
SA_EMAIL="qa-space-backend@${PROJECT_ID}.iam.gserviceaccount.com"

# Собираем образ
echo "📦 Сборка Docker образа..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/qa-space-backend:$IMAGE_TAG

# Развертываем на Cloud Run
echo ""
echo "🚀 Развертывание на Cloud Run..."
gcloud run deploy qa-space-backend \
  --image gcr.io/$PROJECT_ID/qa-space-backend:$IMAGE_TAG \
  --region $REGION \
  --platform managed \
  --allow-unauthenticated \
  --service-account $SA_EMAIL \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-env-vars NODE_ENV=production \
  --set-secrets DATABASE_URL=qa-space-secrets:latest,DATABASE_URL \
  --set-secrets JWT_ACCESS_SECRET=qa-space-secrets:latest,JWT_ACCESS_SECRET \
  --set-secrets JWT_REFRESH_SECRET=qa-space-secrets:latest,JWT_REFRESH_SECRET \
  --set-secrets S3_BUCKET=qa-space-secrets:latest,S3_BUCKET \
  --set-secrets S3_REGION=qa-space-secrets:latest,S3_REGION \
  --set-secrets S3_ENDPOINT=qa-space-secrets:latest,S3_ENDPOINT \
  --set-secrets S3_ACCESS_KEY=qa-space-secrets:latest,S3_ACCESS_KEY \
  --set-secrets S3_SECRET_KEY=qa-space-secrets:latest,S3_SECRET_KEY \
  --set-secrets ALLOWED_ORIGINS=qa-space-secrets:latest,ALLOWED_ORIGINS \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --timeout 300 \
  --port 3000

# Получаем URL сервиса
SERVICE_URL=$(gcloud run services describe qa-space-backend --region=$REGION --format="value(status.url)")

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "🌐 URL сервиса: $SERVICE_URL"
echo "   Health check: $SERVICE_URL/health"
echo "   API: $SERVICE_URL/api"
echo ""
echo "📊 Проверить статус:"
echo "   gcloud run services describe qa-space-backend --region=$REGION"
echo ""
echo "📋 Просмотр логов:"
echo "   gcloud run services logs read qa-space-backend --region=$REGION --limit=50"


