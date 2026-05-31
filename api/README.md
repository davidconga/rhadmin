# MatombePay — SaaS de Gestão Financeira e RH

SaaS multi-tenant (Laravel 11 + React 18) para empresas angolanas. Este repositório
contém a **API** (Laravel). O frontend está em `../matombepay-ui`.

> **Estado: MVP — fatia vertical funcional.** Está implementado, a correr e testado
> de ponta a ponta o fluxo **Funcionários → Recibos de Salário (IRT + Segurança
> Social) → geração de DOCX/PDF/ZIP**, sobre arquitetura **multi-tenant com SQLite
> por tenant**. Os restantes módulos do prompt (Ordens de Pagamento, Notas de Saída,
> Relatórios avançados, Auditoria UI) ficam como próximos passos — a base
> arquitetural já os suporta.

## Stack
- Laravel 11 · API RESTful + Sanctum (Bearer tokens)
- SQLite (uma base **por tenant** em `storage/databases/{slug}.sqlite`)
- PhpWord (DOCX) · DomPDF (PDF) · PhpSpreadsheet (instalado, p/ exportações Excel)

## Arquitetura multi-tenant
- **BD central** (`database/central.sqlite`): tabela `tenants` (registo de empresas).
- **BD por tenant**: `users`, `companies`, `employees`, `salary_slips`, `documents`,
  `audit_logs`, `personal_access_tokens`.
- `TenantMiddleware` resolve o tenant pelo cabeçalho **`X-Tenant: {slug}`** (ou
  subdomínio) e faz *switch* da ligação **antes** da autenticação Sanctum.
  > Detalhe importante: o middleware é registado na *priority list* do Laravel
  > **antes do contrato `AuthenticatesRequests`** (ver `bootstrap/app.php`), caso
  > contrário o lookup do token Sanctum aconteceria na BD errada.

## Setup
```bash
composer install
# .env já configurado (DB_CONNECTION=tenant, CENTRAL_DATABASE default)
touch database/central.sqlite
php artisan migrate --database=central --path=database/migrations/central --force

# Criar um tenant demo com admin + dados de exemplo (empresa + 6 funcionários)
php artisan tenant:create "Matombe Lda" --slug=matombe \
  --admin-email=admin@matombe.ao --admin-password=password --demo

php artisan serve --port=8000
```

### Criar outros tenants
```bash
php artisan tenant:create "Outra Empresa" --slug=outra \
  --admin-email=admin@outra.ao --admin-password=segredo
```

## Endpoints principais (todos exigem `X-Tenant`)
| Método | Rota | Notas |
|---|---|---|
| POST | `/api/login` | público (dentro do tenant) |
| GET | `/api/me` · POST `/api/logout` | auth |
| GET/POST/PUT/DELETE | `/api/employees` | CRUD + `POST /employees/import` (CSV) |
| GET | `/api/salary-slips` | filtros `month`,`year`,`status`,`search` |
| POST | `/api/salary-slips/generate-batch` | gera/recalcula todos do mês |
| POST | `/api/salary-slips/{id}/generate-docx` \| `/generate-pdf` | gera documento |
| POST | `/api/salary-slips/download-zip` | ZIP dos PDF do mês |
| GET/PUT/POST | `/api/company` · `/company/logo` | dados + logótipo |
| GET | `/api/documents/{id}/download` | download autenticado |

## Cálculo de IRT e Segurança Social — premissas
Implementado em `app/Services/IrtCalculatorService.php` (tabela do prompt) e
`app/Services/PayrollService.php`:
- **IRT** progressivo por escalões (parcela fixa acumulada, contínuo). Tabela
  exatamente como no prompt MatombePay.
- **INSS**: 3% (configurável por funcionário) sobre o salário base.
- **Base de IRT** = (base + horas extra + outros rendimentos) − INSS; subsídios de
  **alimentação e transporte tratados como isentos**.
- ⚠️ Validar contra a tabela oficial da **AGT** antes de uso em produção — a lógica
  está isolada num único serviço para facilitar o ajuste.

Exemplo verificado (salário base 650.000): bruto 705.000 · INSS 19.500 · IRT 99.600
· líquido **585.900 AOA**.

## Notas
- PDF gerado com DomPDF (não requer LibreOffice). DOCX com PhpWord.
- Ficheiros guardados em `storage/app/private/tenant/{slug}/documents/`.
