# MatombePay — UI (React + Vite + TypeScript)

Frontend do SaaS MatombePay. Consome a API Laravel em `../matombepay-api`.

## Stack
React 18 · Vite · TypeScript · Tailwind CSS · Zustand · React Router ·
React Hook Form + Zod · Axios · Sonner · Lucide.

## Setup
```bash
npm install
# .env (já criado):
#   VITE_API_URL=http://localhost:8000/api
#   VITE_TENANT=matombe
npm run dev   # http://localhost:5173
```

A API tem de estar a correr em `http://localhost:8000` (ver README do backend).
Todas as chamadas enviam o cabeçalho `X-Tenant` (de `VITE_TENANT`) e o `Bearer`
token guardado em `localStorage`.

## Login demo
`admin@matombe.ao` / `password`

## Páginas
- **Dashboard** — métricas e últimos recibos.
- **Funcionários** — lista, criar/editar (modal), eliminar, pesquisa.
- **Recibos de Salário** — seletor mês/ano, **gerar lote**, lista com IRT/INSS/líquido,
  detalhe com decomposição, gerar/descarregar **DOCX/PDF** e **ZIP** do mês.
- **Empresa** — dados da empresa e **upload de logótipo** (usado nos documentos).

## Notas
- shadcn/ui não foi inicializado; os componentes em `src/components/ui.tsx` são
  equivalentes leves em Tailwind com o tema da marca (`#2E4057`). Pode adicionar-se
  shadcn/ui por cima sem alterar a lógica.
