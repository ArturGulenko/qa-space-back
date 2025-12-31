# Внутренние правила кодирования QA Space Backend

## Общие принципы

### 1. Читаемость превыше всего
- Код должен быть понятен без комментариев
- Используйте осмысленные имена переменных и функций
- Избегайте магических чисел и строк
- Предпочитайте явное неявному

### 2. DRY (Don't Repeat Yourself)
- Не дублируйте код
- Выносите повторяющуюся логику в сервисы/утилиты
- Используйте переиспользуемые guards и декораторы

### 3. SOLID принципы
- **Single Responsibility** - один класс = одна ответственность
- **Open/Closed** - открыт для расширения, закрыт для модификации
- **Liskov Substitution** - подтипы должны быть заменяемы базовыми типами
- **Interface Segregation** - много специфичных интерфейсов лучше одного общего
- **Dependency Inversion** - зависеть от абстракций, а не от конкретных реализаций

### 4. Безопасность
- **ВСЕГДА** проверяйте пермишены на бэкенде
- Не доверяйте данным с клиента
- Валидируйте все входные данные
- Используйте параметризованные запросы (Prisma делает это автоматически)

---

## Структура проекта

```
src/
├── common/              # Общие модули
│   ├── guards/         # Guards для защиты эндпоинтов
│   ├── decorators/     # Кастомные декораторы
│   ├── permissions/    # Система пермишенов
│   └── utils/         # Утилиты
├── features/           # Функциональные модули
│   └── feature-name/
│       ├── *.controller.ts
│       ├── *.service.ts
│       ├── *.module.ts
│       └── dto/        # Data Transfer Objects
├── prisma.service.ts
└── main.ts
```

---

## Именование

### Файлы
- **Контроллеры:** `*.controller.ts` (например, `test-cases.controller.ts`)
- **Сервисы:** `*.service.ts` (например, `test-cases.service.ts`)
- **Модули:** `*.module.ts` (например, `test-cases.module.ts`)
- **DTO:** `*-dto.ts` или в папке `dto/` (например, `create-test-case.dto.ts`)
- **Guards:** `*.guard.ts` (например, `permissions.guard.ts`)
- **Декораторы:** `*.decorator.ts` (например, `permissions.decorator.ts`)

### Классы и переменные
- **Классы:** `PascalCase` (например, `TestCasesController`)
- **Переменные и функции:** `camelCase` (например, `testCaseId`)
- **Константы:** `SCREAMING_SNAKE_CASE` (например, `DEFAULT_PAGE_SIZE`)
- **Приватные члены:** начинаются с `_` (например, `_getUserPermissions()`)
- **Enum значения:** `SCREAMING_SNAKE_CASE` (например, `TEST_CASE_VIEW`)

---

## Контроллеры

### Структура контроллера

```typescript
// ✅ ХОРОШО: Четкая структура с защитой
@Controller('test-cases')
@UseGuards(JwtAuthGuard)
export class TestCasesController {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_VIEW)
  async list(@Request() req: any) {
    // ...
  }

  @Post()
  @UseGuards(WorkspaceMemberGuard, PermissionsGuard)
  @RequirePermissions(Permission.TEST_CASE_CREATE)
  async create(@Body() dto: CreateTestCaseDto, @Request() req: any) {
    // ...
  }
}
```

### ВСЕГДА защищайте эндпоинты

```typescript
// ✅ ХОРОШО: Всегда используйте guards
@Get(':id')
@UseGuards(WorkspaceMemberGuard, PermissionsGuard)
@RequirePermissions(Permission.TEST_CASE_VIEW)
async getById(@Param('id') id: string) {
  // ...
}

// ❌ ПЛОХО: Не оставляйте эндпоинты без защиты
@Get(':id')
async getById(@Param('id') id: string) {
  // ...
}
```

### Порядок декораторов

```typescript
// ✅ ХОРОШО: Правильный порядок
@Get(':id')
@UseGuards(WorkspaceMemberGuard, PermissionsGuard)
@RequirePermissions(Permission.TEST_CASE_VIEW)
async getById(@Param('id') id: string) {
  // 1. HTTP метод
  // 2. Guards
  // 3. Декораторы пермишенов
  // 4. Параметры
  // 5. Метод
}
```

---

## Guards и Permissions

### Использование Guards

```typescript
// ✅ ХОРОШО: Всегда используйте JwtAuthGuard на уровне контроллера
@Controller('test-cases')
@UseGuards(JwtAuthGuard)
export class TestCasesController {
  // ...
}

// ✅ ХОРОШО: Используйте WorkspaceMemberGuard для проверки членства
@Get(':id')
@UseGuards(WorkspaceMemberGuard, PermissionsGuard)
@RequirePermissions(Permission.TEST_CASE_VIEW)
async getById(@Param('id') id: string) {
  // ...
}
```

### Использование пермишенов

```typescript
// ✅ ХОРОШО: Используйте правильные пермишены
// CREATE операции → *:create
@Post()
@RequirePermissions(Permission.TEST_CASE_CREATE)

// READ операции → *:view
@Get()
@RequirePermissions(Permission.TEST_CASE_VIEW)

// UPDATE операции → *:update
@Patch(':id')
@RequirePermissions(Permission.TEST_CASE_UPDATE)

// DELETE операции → *:delete
@Delete(':id')
@RequirePermissions(Permission.TEST_CASE_DELETE)

// EXECUTE операции → *:execute
@Post(':id/execute')
@RequirePermissions(Permission.TEST_CASE_EXECUTE)
```

### Super Admin

```typescript
// ✅ ХОРОШО: Super Admin автоматически имеет все права
// Не нужно проверять isSuperAdmin вручную - это делает PermissionsGuard
// Просто используйте @RequirePermissions() - guard сам проверит super admin
```

---

## Валидация

### DTO с валидацией

```typescript
// ✅ ХОРОШО: Используйте class-validator
import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';

export class CreateTestCaseDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  suiteId?: string;
}
```

### Проверка входных данных

```typescript
// ✅ ХОРОШО: Проверяйте и валидируйте входные данные
@Post()
async create(@Body() dto: CreateTestCaseDto) {
  if (!dto.title || dto.title.trim().length === 0) {
    throw new BadRequestException('Title is required');
  }

  const projectId = parseInt(dto.projectId, 10);
  if (!projectId || isNaN(projectId)) {
    throw new BadRequestException('Invalid project id');
  }
  // ...
}
```

---

## Обработка ошибок

### HTTP статусы

```typescript
// ✅ ХОРОШО: Используйте правильные HTTP статусы
// 400 - Bad Request (невалидные данные)
if (!validData) {
  throw new BadRequestException('Invalid data');
}

// 401 - Unauthorized (нет токена или токен невалиден)
// Обрабатывается JwtAuthGuard автоматически

// 403 - Forbidden (нет прав)
// Обрабатывается PermissionsGuard автоматически

// 404 - Not Found (ресурс не найден)
if (!testCase) {
  throw new NotFoundException('Test case not found');
}

// 500 - Internal Server Error (серверная ошибка)
// Используйте только для неожиданных ошибок
```

### Логирование ошибок

```typescript
// ✅ ХОРОШО: Логируйте ошибки с контекстом
try {
  await this.prisma.testCase.create({ data });
} catch (error) {
  console.error('Error creating test case:', {
    error: error.message,
    stack: error.stack,
    data: { projectId, title },
  });
  throw new BadRequestException('Failed to create test case');
}
```

---

## Работа с Prisma

### Проверка существования

```typescript
// ✅ ХОРОШО: Всегда проверяйте существование
const testCase = await this.prisma.testCase.findUnique({
  where: { id: testCaseId },
});

if (!testCase) {
  throw new NotFoundException('Test case not found');
}
```

### Проверка принадлежности

```typescript
// ✅ ХОРОШО: Проверяйте принадлежность к workspace
if (testCase.workspaceId !== req.workspaceId) {
  throw new NotFoundException('Test case not found');
}

// ✅ ХОРОШО: Используйте requireProjectAccess утилиту
await requireProjectAccess(this.prisma, projectId, req.user.sub, req.workspaceId);
```

### Оптимизация запросов

```typescript
// ✅ ХОРОШО: Используйте select для оптимизации
const testCase = await this.prisma.testCase.findUnique({
  where: { id: testCaseId },
  select: {
    id: true,
    title: true,
    status: true,
    // Только нужные поля
  },
});

// ✅ ХОРОШО: Используйте include для связанных данных
const testCase = await this.prisma.testCase.findUnique({
  where: { id: testCaseId },
  include: {
    steps: { orderBy: { order: 'asc' } },
    suite: true,
  },
});
```

### Транзакции

```typescript
// ✅ ХОРОШО: Используйте транзакции для атомарных операций
await this.prisma.$transaction(async (tx) => {
  await tx.testCase.create({ data: testCaseData });
  await tx.testStep.createMany({ data: stepsData });
});
```

---

## Типизация

### Строгая типизация

```typescript
// ✅ ХОРОШО: Используйте строгую типизацию
async getById(@Param('id') id: string): Promise<TestCaseDto> {
  const testCaseId = parseInt(id, 10);
  if (!testCaseId || isNaN(testCaseId)) {
    throw new BadRequestException('Invalid test case id');
  }
  // ...
}

// ❌ ПЛОХО: Не используйте any без необходимости
async getById(@Param('id') id: any): Promise<any> {
  // ...
}
```

### Типы для Request

```typescript
// ✅ ХОРОШО: Создайте интерфейс для Request
interface AuthenticatedRequest extends Request {
  user: {
    sub: number;
    userId: number;
    email: string;
  };
  workspaceId: number;
}

@Get()
async list(@Request() req: AuthenticatedRequest) {
  const userId = req.user.sub;
  const workspaceId = req.workspaceId;
  // ...
}
```

---

## Комментарии

### JSDoc для публичных методов

```typescript
/**
 * Create a new test case
 * @param dto - Test case data
 * @param req - Request object with user and workspace info
 * @returns Created test case
 * @throws {BadRequestException} If title is missing
 * @throws {NotFoundException} If project not found
 */
async create(@Body() dto: CreateTestCaseDto, @Request() req: any): Promise<TestCaseDto> {
  // ...
}
```

### Комментарии для сложной логики

```typescript
/**
 * Get user permissions based on workspace or project context
 * Project permissions take precedence over workspace permissions
 * Super admin automatically has all permissions
 */
private async getUserPermissions(req: any, userId: number): Promise<Permission[]> {
  // ...
}
```

---

## Импорты

### Порядок импортов

```typescript
// ✅ ХОРОШО: Группируйте импорты
// 1. NestJS core
import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';

// 2. Guards
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';

// 3. Decorators
import { RequirePermissions } from '../common/decorators/permissions.decorator';

// 4. Enums and types
import { Permission } from '../common/permissions/permissions.enum';

// 5. Services
import { PrismaService } from '../prisma.service';

// 6. DTOs
import { CreateTestCaseDto } from './dto/create-test-case.dto';

// 7. Utils
import { requireProjectAccess } from '../common/utils/project-access';
```

---

## Безопасность

### Проверка пермишенов

```typescript
// ✅ ХОРОШО: Всегда проверяйте пермишены на бэкенде
@RequirePermissions(Permission.TEST_CASE_DELETE)
async delete(@Param('id') id: string) {
  // Клиентская проверка - только для UX
  // Серверная проверка - обязательна!
}
```

### Валидация данных

```typescript
// ✅ ХОРОШО: Валидируйте все входные данные
if (!id || isNaN(parseInt(id, 10))) {
  throw new BadRequestException('Invalid id');
}

// ✅ ХОРОШО: Проверяйте принадлежность ресурсов
if (testCase.workspaceId !== req.workspaceId) {
  throw new NotFoundException('Test case not found');
}
```

### Защита от SQL инъекций

```typescript
// ✅ ХОРОШО: Prisma автоматически защищает от SQL инъекций
// Всегда используйте параметризованные запросы через Prisma
const testCase = await this.prisma.testCase.findUnique({
  where: { id: parseInt(id, 10) }, // Безопасно
});

// ❌ ПЛОХО: Никогда не используйте сырые SQL запросы с конкатенацией
// await this.prisma.$queryRaw(`SELECT * FROM test_cases WHERE id = ${id}`);
```

---

## Производительность

### Пагинация

```typescript
// ✅ ХОРОШО: Используйте пагинацию для больших списков
@Get()
async list(
  @Query('page') page: string = '1',
  @Query('limit') limit: string = '20',
) {
  const pageNum = parseInt(page, 10) || 1;
  const limitNum = parseInt(limit, 10) || 20;
  const skip = (pageNum - 1) * limitNum;

  const [items, total] = await Promise.all([
    this.prisma.testCase.findMany({
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.testCase.count(),
  ]);

  return {
    items,
    total,
    page: pageNum,
    limit: limitNum,
  };
}
```

### Индексы

```prisma
// ✅ ХОРОШО: Используйте индексы для часто запрашиваемых полей
model TestCase {
  id          Int      @id @default(autoincrement())
  projectId   Int
  workspaceId Int
  
  @@index([projectId])
  @@index([workspaceId])
  @@index([projectId, status])
}
```

---

## Тестирование

### Unit тесты

```typescript
// ✅ ХОРОШО: Пишите тесты для критичной логики
describe('PermissionsGuard', () => {
  it('should allow access with correct permissions', async () => {
    // ...
  });

  it('should deny access without permissions', async () => {
    // ...
  });
});
```

---

## Чеклист перед коммитом

- [ ] Все эндпоинты защищены guards
- [ ] Используются правильные пермишены
- [ ] Валидируются входные данные (DTO)
- [ ] Проверяется существование ресурсов
- [ ] Проверяется принадлежность к workspace/project
- [ ] Используются правильные HTTP статусы
- [ ] Логируются ошибки
- [ ] Нет утечек данных (правильный select)
- [ ] Код проходит линтер
- [ ] Нет console.log в production коде
- [ ] Коммит сообщение следует конвенции

---

## Полезные ссылки

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Style Guide](https://github.com/microsoft/TypeScript/wiki/Coding-guidelines)
- [REST API Best Practices](https://restfulapi.net/)

---

## Вопросы?

Если у вас есть вопросы по правилам кодирования, обратитесь к тимлиду или создайте issue в репозитории.

