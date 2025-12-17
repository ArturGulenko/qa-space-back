# Инструкции по push кода на GitHub

## Шаг 1: Создайте репозиторий на GitHub

1. Откройте https://github.com/new в браузере
2. Войдите в свой аккаунт GitHub
3. Укажите имя репозитория (например: `qa-space-back`)
4. **НЕ** добавляйте README, .gitignore или лицензию (они уже есть в проекте)
5. Нажмите "Create repository"

## Шаг 2: Выполните команды для push

После создания репозитория выполните следующие команды в терминале:

```powershell
# Замените YOUR_USERNAME на ваш GitHub username
# Замените REPO_NAME на имя вашего репозитория

git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### Пример:
```powershell
git remote add origin https://github.com/yourusername/qa-space-back.git
git branch -M main
git push -u origin main
```

## Альтернативный способ (через SSH)

Если у вас настроен SSH ключ:

```powershell
git remote add origin git@github.com:YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

## Готово!

После выполнения команд ваш код будет загружен на GitHub.

