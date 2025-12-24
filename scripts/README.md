# Скрипты для деплоя на GCP

Скрипты для автоматизации процесса деплоя приложения на Google Cloud Platform.

## 📋 Требования

- Google Cloud SDK (gcloud) установлен и настроен
- Права на выполнение: `chmod +x scripts/*.sh`
- Авторизация в GCP: `gcloud auth login`

## 🚀 Скрипты для GCP

### `setup-gcp.sh`
Создает все необходимые ресурсы GCP:
- Cloud SQL PostgreSQL инстанс
- GCS bucket для файлов
- Service Accounts с необходимыми правами
- Secret Manager secrets

**Использование:**
```bash
./scripts/setup-gcp.sh PROJECT_ID [REGION]
# или
export GOOGLE_CLOUD_PROJECT=your-project-id
./scripts/setup-gcp.sh
```

### `run-migrations-gcp.sh`
Запускает миграции Prisma на Cloud Run Job.

**Использование:**
```bash
./scripts/run-migrations-gcp.sh PROJECT_ID [REGION]
```

### `deploy-gcp.sh`
Развертывает приложение на Cloud Run.

**Использование:**
```bash
./scripts/deploy-gcp.sh PROJECT_ID [REGION] [IMAGE_TAG]
```

## 🔄 Типичный workflow для GCP

```bash
# 1. Настройка ресурсов GCP (один раз)
./scripts/setup-gcp.sh your-project-id us-central1

# 2. Запуск миграций
./scripts/run-migrations-gcp.sh your-project-id us-central1

# 3. Развертывание приложения
./scripts/deploy-gcp.sh your-project-id us-central1

# 4. Обновление приложения (при изменениях)
./scripts/deploy-gcp.sh your-project-id us-central1 latest
```

## 📝 Локальные скрипты

### `add-superadmin.ts`
Создает суперадминистратора в системе.

**Использование:**
```bash
npm run add-superadmin
```

### `create-superadmin.ts`
Альтернативный скрипт для создания суперадминистратора.

**Использование:**
```bash
npm run create-superadmin
```

## 📚 Дополнительная документация

Полное руководство по развертыванию: `../GCP_DEPLOYMENT.md`
