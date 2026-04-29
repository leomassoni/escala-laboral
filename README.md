# Escala Laboral

Web app para gestao de escala laboral com frontend React/Vite e persistencia em backend Node/Express.

## Stack

- Frontend: React + Vite + TypeScript
- Backend: Express
- Banco local: SQLite via Prisma
- Banco em producao: PostgreSQL no Render

## Desenvolvimento local

1. Instale as dependencias do frontend e do backend:

```bash
npm install
npm --prefix server install
```

2. Gere o client do Prisma e crie o banco local:

```bash
npm run db:push
```

3. Suba frontend e backend juntos:

```bash
npm run dev
```

Fluxos locais:

- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- O Vite faz proxy de `/api` para a API local.

## Persistencia

- Se a API estiver disponivel, o app hidrata e salva o estado nela.
- Se a API nao estiver disponivel, o app continua funcionando com `localStorage`.
- O `localStorage` continua sendo mantido como fallback local.

## Scripts

```bash
npm run dev
npm run dev:client
npm run dev:server
npm run build
npm run db:push
npm run db:studio
```

## Estrutura

- `src/`: frontend
- `server/`: API, Prisma e banco local
- `render.yaml`: blueprint para deploy no Render

## GitHub

Sequencia padrao para subir:

```bash
git init
git add .
git commit -m "feat: bootstrap escala laboral com backend e banco"
git branch -M main
git remote add origin <URL_DO_REPOSITORIO>
git push -u origin main
```

## Render

O projeto esta preparado para subir como um unico Web Service com banco Postgres gerenciado pelo Render.

Arquivos relevantes:

- `render.yaml`
- `server/.env.example`

No Render:

1. Conecte o repositorio GitHub.
2. Escolha `Blueprint`.
3. O Render criara:
   - `escala-laboral-db`
   - `escala-laboral`
4. O build:
   - instala frontend e backend
   - gera o build do Vite
   - gera o client do Prisma
   - executa `prisma db push` no Postgres

## Observacao

O frontend ja esta preparado para usar a API de persistencia por snapshot. A proxima etapa natural e migrar de snapshot unico para endpoints CRUD por modulo.
