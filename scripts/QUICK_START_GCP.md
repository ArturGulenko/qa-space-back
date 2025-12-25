# 🚀 Быстрый старт: Развертывание на GCP

## Шаг 1: Установка и настройка

```bash
# Установите Google Cloud SDK (если еще не установлен)
# https://cloud.google.com/sdk/docs/install

# Авторизуйтесь
gcloud auth login
gcloud auth application-default login

# Установите проект
export GOOGLE_CLOUD_PROJECT="your-project-id"
gcloud config set project $GOOGLE_CLOUD_PROJECT
```

## Шаг 2: Создание ресурсов

```bash
# Сделайте скрипты исполняемыми (Linux/Mac)
chmod +x scripts/*.sh

# Запустите настройку (создаст все ресурсы)
./scripts/setup-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

**Важно:** Сохраните пароли и ключи, которые будут показаны!

## Шаг 3: Запуск миграций

```bash
./scripts/run-migrations-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

## Шаг 4: Развертывание

```bash
./scripts/deploy-gcp.sh $GOOGLE_CLOUD_PROJECT us-central1
```

После развертывания вы получите URL вашего приложения.

## Проверка

```bash
# Получите URL сервиса
gcloud run services describe qa-space-backend --region=us-central1 --format="value(status.url)"

# Проверьте health endpoint
curl https://YOUR-SERVICE-URL/health
```

## Что дальше?

- Обновите фронтенд с новым URL бекенда
- Настройте домен (опционально)
- Настройте мониторинг и алерты

Полная документация: `../GCP_DEPLOYMENT.md`


