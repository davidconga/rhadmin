# RHAdmin

SaaS multi-tenant de gestão de Recursos Humanos e Finanças para empresas angolanas.

## Estrutura

```
rhadmin/
├── api/   # Backend Laravel 11 + Sanctum + SQLite por tenant
└── ui/    # Frontend React 18 + Vite + TypeScript + Tailwind
```

## Arrancar em desenvolvimento

### API
```bash
cd api
composer install
cp .env.example .env
php artisan key:generate
php artisan tenant:create "Empresa Demo" --slug=demo --admin-email=admin@demo.ao --admin-password=password --demo
php artisan serve
```

### UI
```bash
cd ui
npm install
npm run dev
```
