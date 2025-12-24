#!/bin/bash

# Скрипт для настройки всех ресурсов GCP
# Использование: ./scripts/setup-gcp.sh [PROJECT_ID] [REGION]

set -e

PROJECT_ID=${1:-${GOOGLE_CLOUD_PROJECT}}
REGION=${2:-us-central1}

if [ -z "$PROJECT_ID" ]; then
  echo "❌ PROJECT_ID не указан. Используйте: ./scripts/setup-gcp.sh PROJECT_ID [REGION]"
  echo "   или установите переменную окружения GOOGLE_CLOUD_PROJECT"
  exit 1
fi

echo "🚀 Настройка GCP инфраструктуры для QA Space"
echo "=============================================="
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Устанавливаем проект
gcloud config set project $PROJECT_ID

# Включаем необходимые API
echo "📦 Включение необходимых API..."
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage-api.googleapis.com \
  iam.googleapis.com

# Создаем Service Account для Cloud Run
echo ""
echo "👤 Создание Service Account..."
SA_NAME="qa-space-backend"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $SA_EMAIL &>/dev/null; then
  gcloud iam service-accounts create $SA_NAME \
    --display-name="QA Space Backend Service Account" \
    --description="Service account for QA Space backend application"
  echo "✅ Service Account создан"
else
  echo "⚠️  Service Account уже существует"
fi

# Даем права Service Account
echo ""
echo "🔐 Настройка прав Service Account..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin"

# Создаем Cloud SQL инстанс
echo ""
echo "🗄️  Создание Cloud SQL PostgreSQL инстанса..."
DB_INSTANCE="qa-space-db"
DB_NAME="qa_space"
DB_USER="postgres"

if ! gcloud sql instances describe $DB_INSTANCE &>/dev/null; then
  echo "⚠️  Создание Cloud SQL инстанса (это может занять 5-10 минут)..."
  read -p "Введите пароль для пользователя postgres: " -s DB_PASSWORD
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
  
  # Создаем базу данных
  gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE
  
  # Получаем connection name
  CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
  
  echo "✅ Cloud SQL инстанс создан"
  echo "   Connection Name: $CONNECTION_NAME"
  echo "   Database: $DB_NAME"
  echo "   Username: $DB_USER"
  echo ""
  echo "⚠️  Сохраните пароль! Он понадобится для DATABASE_URL"
else
  echo "⚠️  Cloud SQL инстанс уже существует"
  CONNECTION_NAME=$(gcloud sql instances describe $DB_INSTANCE --format="value(connectionName)")
fi

# Создаем GCS bucket для файлов
echo ""
echo "📦 Создание GCS bucket для файлов..."
BUCKET_NAME="${PROJECT_ID}-qa-space-files"

if ! gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
  gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
  gsutil uniformbucketlevelaccess set on gs://$BUCKET_NAME
  echo "✅ GCS bucket создан: $BUCKET_NAME"
else
  echo "⚠️  GCS bucket уже существует: $BUCKET_NAME"
fi

# Создаем Service Account для доступа к GCS
echo ""
echo "🔑 Создание Service Account для GCS..."
GCS_SA_NAME="qa-space-gcs"
GCS_SA_EMAIL="${GCS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe $GCS_SA_EMAIL &>/dev/null; then
  gcloud iam service-accounts create $GCS_SA_NAME \
    --display-name="QA Space GCS Service Account" \
    --description="Service account for GCS access"
  
  # Создаем ключ для Service Account
  gcloud iam service-accounts keys create /tmp/gcs-key.json \
    --iam-account=$GCS_SA_EMAIL
  
  # Даем права на bucket
  gsutil iam ch serviceAccount:${GCS_SA_EMAIL}:objectAdmin gs://$BUCKET_NAME
  
  echo "✅ GCS Service Account создан"
  echo "   Ключ сохранен в /tmp/gcs-key.json"
  echo "   ⚠️  Сохраните этот ключ! Он понадобится для S3_ACCESS_KEY и S3_SECRET_KEY"
else
  echo "⚠️  GCS Service Account уже существует"
fi

# Создаем Secret Manager secrets
echo ""
echo "🔐 Настройка Secret Manager..."
SECRET_NAME="qa-space-secrets"

# Запрашиваем необходимые данные
if [ -z "$DB_PASSWORD" ]; then
  read -p "Введите пароль Cloud SQL: " -s DB_PASSWORD
  echo ""
fi

read -p "Введите JWT_ACCESS_SECRET (или нажмите Enter для автогенерации): " JWT_ACCESS_SECRET
if [ -z "$JWT_ACCESS_SECRET" ]; then
  JWT_ACCESS_SECRET=$(openssl rand -hex 32)
  echo "✅ Сгенерирован JWT_ACCESS_SECRET"
fi

read -p "Введите JWT_REFRESH_SECRET (или нажмите Enter для автогенерации): " JWT_REFRESH_SECRET
if [ -z "$JWT_REFRESH_SECRET" ]; then
  JWT_REFRESH_SECRET=$(openssl rand -hex 32)
  echo "✅ Сгенерирован JWT_REFRESH_SECRET"
fi

read -p "Введите ALLOWED_ORIGINS (через запятую, например: https://example.com,https://app.example.com): " ALLOWED_ORIGINS
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-"*"}

# Получаем данные из GCS ключа
if [ -f /tmp/gcs-key.json ]; then
  GCS_ACCESS_KEY=$(cat /tmp/gcs-key.json | jq -r '.client_email')
  GCS_SECRET_KEY=$(cat /tmp/gcs-key.json | jq -r '.private_key' | base64 -w 0)
else
  echo "⚠️  GCS ключ не найден. Введите вручную:"
  read -p "GCS Access Key (client_email): " GCS_ACCESS_KEY
  read -p "GCS Secret Key (private_key в base64): " -s GCS_SECRET_KEY
  echo ""
fi

# Формируем DATABASE_URL
DB_HOST=$(gcloud sql instances describe $DB_INSTANCE --format="value(ipAddresses[0].ipAddress)")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

# GCS endpoint для S3-совместимого API
GCS_ENDPOINT="https://storage.googleapis.com"

# Создаем JSON secret
# ВАЖНО: S3_SECRET_KEY должен быть в base64 для правильной работы с GCS
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

# Сохраняем во временный файл
echo "$SECRET_JSON" > /tmp/secrets.json

# Создаем или обновляем secret
if gcloud secrets describe $SECRET_NAME &>/dev/null; then
  echo "🔄 Обновление существующего secret..."
  gcloud secrets versions add $SECRET_NAME --data-file=/tmp/secrets.json
else
  echo "✨ Создание нового secret..."
  gcloud secrets create $SECRET_NAME --data-file=/tmp/secrets.json --replication-policy="automatic"
fi

# Даем доступ Service Account к secret
gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"

# Очистка
rm -f /tmp/secrets.json

echo ""
echo "✅ Настройка завершена!"
echo ""
echo "📋 Следующие шаги:"
echo "1. Запустите миграции: ./scripts/run-migrations-gcp.sh"
echo "2. Задеплойте приложение: ./scripts/deploy-gcp.sh"
echo ""
echo "📊 Полезные команды:"
echo "   gcloud run services describe qa-space-backend --region=$REGION"
echo "   gcloud sql instances describe $DB_INSTANCE"
echo "   gsutil ls gs://$BUCKET_NAME"

