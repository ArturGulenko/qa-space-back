# 🚀 Развертывание QA Space Backend на Google Cloud Platform

Это руководство поможет вам развернуть QA Space Backend на GCP используя Cloud Run, Cloud SQL и другие сервисы GCP.

## 📋 Предварительные требования

1. **Google Cloud Account** с активным проектом
2. **Google Cloud SDK (gcloud)** установлен и настроен
   ```bash
   # Установка gcloud (если еще не установлен)
   # macOS: brew install google-cloud-sdk
   # Linux: https://cloud.google.com/sdk/docs/install
   # Windows: https://cloud.google.com/sdk/docs/install-sdk
   
   # Авторизация
   gcloud auth login
   gcloud auth application-default login
   ```

3. **Docker** (опционально, для локальной сборки)

## 🏗️ Архитектура

Развертывание использует следующие сервисы GCP:

- **Cloud Run** - для контейнеризированного приложения (serverless)
- **Cloud SQL** - для PostgreSQL базы данных
- **Cloud Storage (GCS)** - для хранения файлов
- **Secret Manager** - для хранения секретов
- **Cloud Build** - для CI/CD (опционально)

## 🚀 Быстрый старт

### 1. Настройка проекта

```bash
# Установите PROJECT_ID
export GOOGLE_CLOUD_PROJECT="your-project-id"
gcloud config set project $GOOGLE_CLOUD_PROJECT

# Или передайте PROJECT_ID как аргумент
./scripts/setup-gcp.sh your-project-id us-central1
```

### 2. Создание ресурсов GCP

Скрипт `setup-gcp.sh` автоматически создаст все необходимые ресурсы:

```bash
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh your-project-id us-central1
```

Этот скрипт создаст:
- ✅ Cloud SQL PostgreSQL инстанс
- ✅ GCS bucket для файлов
- ✅ Service Accounts с необходимыми правами
- ✅ Secret Manager secrets со всеми переменными окружения
- ✅ Включит необходимые API

**Важно:** Сохраните пароли и ключи, которые будут показаны в процессе!

### 3. Запуск миграций базы данных

```bash
chmod +x scripts/run-migrations-gcp.sh
./scripts/run-migrations-gcp.sh your-project-id us-central1
```

### 4. Развертывание приложения

```bash
chmod +x scripts/deploy-gcp.sh
./scripts/deploy-gcp.sh your-project-id us-central1
```

После развертывания вы получите URL вашего приложения, например:
```
https://qa-space-backend-xxxxx-uc.a.run.app
```

## 📝 Детальное описание

### Переменные окружения

Приложение использует следующие переменные окружения (хранятся в Secret Manager):

| Переменная | Описание | Источник |
|-----------|----------|----------|
| `DATABASE_URL` | Connection string для PostgreSQL | Cloud SQL |
| `JWT_ACCESS_SECRET` | Секрет для JWT access токенов | Генерируется |
| `JWT_REFRESH_SECRET` | Секрет для JWT refresh токенов | Генерируется |
| `S3_BUCKET` | Имя GCS bucket | Создается автоматически |
| `S3_REGION` | Регион GCS bucket | us-central1 |
| `S3_ENDPOINT` | Endpoint для S3-совместимого API | https://storage.googleapis.com |
| `S3_ACCESS_KEY` | Service Account email для GCS | Создается автоматически |
| `S3_SECRET_KEY` | Private key для GCS (base64) | Создается автоматически |
| `ALLOWED_ORIGINS` | Разрешенные CORS origins | Настраивается вручную |
| `NODE_ENV` | Окружение | production |
| `PORT` | Порт приложения | 3000 (Cloud Run устанавливает автоматически) |

### Cloud SQL

Cloud SQL инстанс создается с следующими параметрами:
- **Версия:** PostgreSQL 15
- **Tier:** db-f1-micro (можно изменить в скрипте)
- **Storage:** 10GB SSD
- **Backup:** Включен (ежедневно в 03:00)
- **Deletion Protection:** Включен

Connection string формируется для использования через Cloud SQL Proxy:
```
postgresql://postgres:PASSWORD@/qa_space?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME
```

### Cloud Storage (GCS)

GCS bucket используется для хранения файлов через S3-совместимый API. AWS SDK для S3 работает с GCS через специальный endpoint.

### Secret Manager

Все секреты хранятся в одном secret `qa-space-secrets` в формате JSON. Service Account для Cloud Run имеет доступ к этому secret.

## 🔧 Ручная настройка (альтернатива скриптам)

Если вы предпочитаете настраивать вручную:

### 1. Включение API

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  storage-api.googleapis.com
```

### 2. Создание Cloud SQL

```bash
gcloud sql instances create qa-space-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1 \
  --root-password=YOUR_PASSWORD

gcloud sql databases create qa_space --instance=qa-space-db
```

### 3. Создание GCS bucket

```bash
gsutil mb -p $PROJECT_ID -c STANDARD -l us-central1 gs://$PROJECT_ID-qa-space-files
gsutil uniformbucketlevelaccess set on gs://$PROJECT_ID-qa-space-files
```

### 4. Создание Secret Manager secret

```bash
# Создайте JSON файл с секретами
cat > secrets.json <<EOF
{
  "DATABASE_URL": "postgresql://postgres:PASSWORD@/qa_space?host=/cloudsql/...",
  "JWT_ACCESS_SECRET": "...",
  "JWT_REFRESH_SECRET": "...",
  ...
}
EOF

gcloud secrets create qa-space-secrets --data-file=secrets.json
```

### 5. Развертывание на Cloud Run

```bash
gcloud run deploy qa-space-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --add-cloudsql-instances $CONNECTION_NAME \
  --set-secrets DATABASE_URL=qa-space-secrets:latest,DATABASE_URL \
  ...
```

## 🔄 Обновление приложения

Для обновления приложения просто запустите скрипт развертывания снова:

```bash
./scripts/deploy-gcp.sh your-project-id us-central1 latest
```

Или используйте Cloud Build:

```bash
gcloud builds submit --config cloudbuild.yaml
```

## 📊 Мониторинг и логи

### Просмотр логов

```bash
# Логи Cloud Run
gcloud run services logs read qa-space-backend --region=us-central1 --limit=50

# Логи в реальном времени
gcloud run services logs tail qa-space-backend --region=us-central1
```

### Проверка статуса

```bash
# Статус Cloud Run сервиса
gcloud run services describe qa-space-backend --region=us-central1

# Статус Cloud SQL
gcloud sql instances describe qa-space-db

# Список GCS файлов
gsutil ls gs://$PROJECT_ID-qa-space-files
```

## 🔐 Безопасность

1. **Service Accounts** - используются вместо пользовательских ключей
2. **Secret Manager** - все секреты хранятся в зашифрованном виде
3. **IAM** - минимальные необходимые права для каждого Service Account
4. **Cloud SQL** - доступ только через Cloud SQL Proxy
5. **HTTPS** - автоматически включен для Cloud Run

## 💰 Стоимость

Примерная стоимость (может варьироваться):

- **Cloud Run:** ~$0.40 за миллион запросов + $0.00002400 за GB-секунду
- **Cloud SQL (db-f1-micro):** ~$7.67/месяц
- **Cloud Storage:** ~$0.020 за GB/месяц
- **Secret Manager:** ~$0.06 за secret/месяц

Итого: примерно **$10-20/месяц** для небольшого приложения.

## 🆘 Troubleshooting

### Ошибка: "Permission denied"

Убедитесь, что у вашего аккаунта есть необходимые права:
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="user:YOUR_EMAIL" \
  --role="roles/owner"
```

### Ошибка подключения к Cloud SQL

Проверьте:
1. Cloud SQL инстанс запущен
2. Connection name правильный
3. Service Account имеет роль `roles/cloudsql.client`

### Ошибка доступа к Secret Manager

Проверьте, что Service Account имеет роль `roles/secretmanager.secretAccessor`:
```bash
gcloud secrets add-iam-policy-binding qa-space-secrets \
  --member="serviceAccount:qa-space-backend@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Ошибка доступа к GCS

Проверьте права Service Account на bucket:
```bash
gsutil iam ch serviceAccount:qa-space-gcs@$PROJECT_ID.iam.gserviceaccount.com:objectAdmin \
  gs://$PROJECT_ID-qa-space-files
```

## 📚 Дополнительные ресурсы

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Cloud Storage Documentation](https://cloud.google.com/storage/docs)

## 🔄 Миграция с AWS

Если вы мигрируете с AWS, основные отличия:

| AWS | GCP |
|-----|-----|
| ECS Fargate | Cloud Run |
| RDS | Cloud SQL |
| S3 | Cloud Storage |
| Secrets Manager | Secret Manager |
| ALB | Cloud Load Balancer (автоматически) |

Cloud Run автоматически масштабируется и управляет нагрузкой, что упрощает развертывание по сравнению с ECS.


