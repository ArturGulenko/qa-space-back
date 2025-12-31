# Postman Integration Module

Модуль для загрузки и выполнения Postman коллекций и environments в рамках системы QA Space.

## Возможности

- ✅ Загрузка Postman Collection (v2.1)
- ✅ Загрузка Postman Environment
- ✅ Выполнение запросов из коллекций
- ✅ Поддержка переменных (collection и environment)
- ✅ Поддержка аутентификации (Bearer, Basic, API Key)
- ✅ Интеграция результатов в TestRuns
- ✅ Автоматическое создание TestCases из Postman запросов

## API Endpoints

### 1. Загрузка коллекции

```http
POST /projects/:projectId/postman/collections/upload
Content-Type: multipart/form-data

file: <postman_collection.json>
collectionName: "My API Collection" (optional)
```

**Ответ:**
```json
{
  "id": 123,
  "name": "My API Collection",
  "message": "Collection uploaded successfully"
}
```

### 2. Загрузка environment

```http
POST /projects/:projectId/postman/environments/upload
Content-Type: multipart/form-data

file: <postman_environment.json>
environmentName: "Production" (optional)
```

**Ответ:**
```json
{
  "id": 456,
  "name": "Production",
  "message": "Environment uploaded successfully"
}
```

### 3. Получение списка коллекций

```http
GET /projects/:projectId/postman/collections
```

**Ответ:**
```json
[
  {
    "id": 123,
    "name": "My API Collection",
    "sizeBytes": 1024,
    "uploadedAt": "2024-01-01T00:00:00Z",
    "uploadedBy": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name"
    }
  }
]
```

### 4. Получение списка environments

```http
GET /projects/:projectId/postman/environments
```

### 5. Выполнение коллекции

```http
POST /projects/:projectId/postman/execute
Content-Type: multipart/form-data

collection: <postman_collection.json> (optional, если указан collectionId)
collectionId: 123 (optional)
environmentId: 456 (optional)
testRunId: 789 (optional, для обновления существующего test run)
build: "v1.0.0" (optional)
env: "production" (optional)
platform: "api" (optional)
```

**Ответ:**
```json
{
  "testRunId": 789,
  "executionSummary": {
    "total": 10,
    "passed": 8,
    "failed": 2,
    "errors": 1,
    "totalTime": 5000,
    "results": [
      {
        "requestName": "Get Users",
        "requestMethod": "GET",
        "requestUrl": "https://api.example.com/users",
        "statusCode": 200,
        "responseTime": 150,
        "success": true,
        "responseBody": "...",
        "responseHeaders": {},
        "testResults": []
      }
    ],
    "testRunItemsCreated": 10
  },
  "message": "Collection executed successfully"
}
```

## Поддерживаемые функции Postman

### ✅ Поддерживается:
- HTTP методы (GET, POST, PUT, DELETE, PATCH, etc.)
- Headers
- Query parameters
- URL variables
- Body (raw, urlencoded, formdata)
- Collection variables
- Environment variables
- Аутентификация:
  - Bearer Token
  - Basic Auth
  - API Key
- Folders (вложенные запросы)
- **Pre-request scripts** - выполняются перед каждым запросом
- **Test scripts** - выполняются после получения ответа
- Postman API (pm.environment, pm.variables, pm.test, pm.expect, pm.request, pm.response)

### ⚠️ Ограничения:
- File uploads в formdata не поддерживаются
- OAuth 2.0, AWS Signature и другие сложные типы аутентификации требуют доработки
- Поддержка pm.expect ограничена (базовые проверки: to.equal, to.include, to.be.a, eql)
- Сложные асинхронные операции в скриптах могут работать некорректно

## Интеграция с TestRuns

При выполнении коллекции:
1. Создается новый TestRun (или обновляется существующий)
2. Для каждого запроса из коллекции:
   - Создается TestCase (если не существует)
   - Создается TestRunItem с результатом выполнения
   - Результат сохраняется (pass/fail на основе HTTP статуса)

## Переменные

Переменные разрешаются в следующем порядке:
1. Environment variables (приоритет)
2. Collection variables

Синтаксис: `{{variableName}}`

## Примеры использования

### Загрузка и выполнение коллекции

```bash
# 1. Загрузить коллекцию
curl -X POST \
  http://localhost:3000/projects/1/postman/collections/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@collection.json" \
  -F "collectionName=My API Tests"

# 2. Загрузить environment
curl -X POST \
  http://localhost:3000/projects/1/postman/environments/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@environment.json" \
  -F "environmentName=Production"

# 3. Выполнить коллекцию
curl -X POST \
  http://localhost:3000/projects/1/postman/execute \
  -H "Authorization: Bearer <token>" \
  -F "collectionId=123" \
  -F "environmentId=456" \
  -F "build=v1.0.0" \
  -F "env=production"
```

## Разрешения

Требуемые разрешения:
- `TEST_RUN_CREATE` - для загрузки коллекций и environments
- `TEST_RUN_EXECUTE` - для выполнения коллекций
- `TEST_RUN_VIEW` - для просмотра списков

## Поддержка Postman Scripts

Система поддерживает выполнение Pre-request scripts и Test scripts с использованием встроенного модуля `vm` Node.js.

### Поддерживаемые Postman API:

- `pm.environment.get/set/unset/toObject()` - работа с environment variables
- `pm.variables.get/set/unset/toObject()` - работа с collection variables
- `pm.request.url.toString()` - получение URL запроса
- `pm.request.method` - метод запроса
- `pm.request.headers.get/toObject()` - заголовки запроса
- `pm.request.body.raw/urlencoded/formdata` - тело запроса
- `pm.response.code/status/statusText` - статус ответа
- `pm.response.headers.get/toObject()` - заголовки ответа
- `pm.response.json()` - парсинг JSON ответа
- `pm.response.text()` - текст ответа
- `pm.test(name, fn)` - создание тестов
- `pm.expect(value).to.equal/include/be.a()` - проверки в тестах
- `pm.expect(value).eql()` - глубокое сравнение объектов
- `console.log/error/warn()` - логирование
- `setTimeout/clearTimeout` - таймеры
- `setInterval/clearInterval` - интервалы

### Примеры скриптов:

**Pre-request script:**
```javascript
// Установить переменную перед запросом
pm.environment.set("timestamp", Date.now());
pm.variables.set("randomId", Math.random().toString(36));
```

**Test script:**
```javascript
// Проверка статуса ответа
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

// Проверка содержимого ответа
pm.test("Response contains user data", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('user');
    pm.expect(jsonData.user).to.be.a('object');
});
```

## Будущие улучшения

- [ ] Расширенная поддержка pm.expect (больше методов проверки)
- [ ] Поддержка file uploads
- [ ] Поддержка OAuth 2.0 и других типов аутентификации
- [ ] Параллельное выполнение запросов
- [ ] Кэширование коллекций и environments
- [ ] Экспорт результатов в различные форматы
- [ ] Webhook уведомления о завершении выполнения
- [ ] Поддержка pm.sendRequest для вложенных запросов

