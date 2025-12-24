#!/bin/bash

# Скрипт для запуска миграций Prisma на Cloud Run
# Использование: ./scripts/run-migrations-gcp.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-us-central1}

if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID не указан. Используйте: ./scripts/run-migrations-gcp.sh PROJECT_ID [REGION]"
  exit 1
fi

echo "🔄 Запуск миграций Prisma на Cloud Run"
echo "======================================"
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
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

# Собираем образ для миграций
echo "📦 Сборка Docker образа для миграций..."
if [ -f cloudbuild.migrations.yaml ]; then
  gcloud builds submit --config=cloudbuild.migrations.yaml .
else
  # Альтернативный способ - используем docker build напрямую
  echo "   Используем прямой docker build..."
  docker build -f Dockerfile.migrations -t gcr.io/$PROJECT_ID/qa-space-migrations:latest .
  docker push gcr.io/$PROJECT_ID/qa-space-migrations:latest
fi

# Запускаем одноразовую задачу на Cloud Run
echo ""
echo "🚀 Создание/обновление Cloud Run Job для миграций..."

# Проверяем, существует ли job
if gcloud run jobs describe qa-space-migrations --region=$REGION &>/dev/null; then
  echo "⚠️  Job уже существует, обновляем..."
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
  echo "✨ Создание нового Job..."
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

# Запускаем job
echo ""
echo "⏳ Запуск задачи миграций..."
EXECUTION_NAME=$(gcloud run jobs execute qa-space-migrations --region=$REGION --format="value(metadata.name)")

echo "✅ Задача запущена: $EXECUTION_NAME"
echo ""
echo "📊 Отслеживание выполнения:"
echo "   gcloud run jobs executions describe $EXECUTION_NAME --region=$REGION"
echo ""
echo "📋 Просмотр логов:"
echo "   gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=qa-space-migrations\" --limit=50 --format=json"

# Ждем завершения
echo ""
echo "⏳ Ожидание завершения миграций (это может занять несколько минут)..."
echo "   Вы можете отслеживать прогресс в Cloud Console или через логи"

# Ждем завершения выполнения
gcloud run jobs executions wait $EXECUTION_NAME --region=$REGION --timeout=600

# Проверяем статус
STATUS=$(gcloud run jobs executions describe $EXECUTION_NAME --region=$REGION --format="value(status.conditions[0].type)" 2>/dev/null || echo "Unknown")

if [ "$STATUS" = "Complete" ]; then
  echo ""
  echo "✅ Миграции успешно выполнены!"
  exit 0
else
  echo ""
  echo "⚠️  Миграции завершились со статусом: $STATUS"
  echo "   Проверьте логи для деталей:"
  echo "   gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=qa-space-migrations\" --limit=50"
  exit 1
fi

