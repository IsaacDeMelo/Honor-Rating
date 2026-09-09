<p align="center">
  <img src="src/public/images/logo.png" alt="Honor Rating" width="160">
</p>

<h1 align="center">Honor Rating</h1>

[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Express](https://img.shields.io/badge/Express-5-lightgrey)](https://expressjs.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green)](https://www.mongodb.com)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow)](./LICENSE)

Catálogo e comunidade de RPGs de mesa: descubra sistemas, leia e publique críticas, acompanhe eventos de criadores e gerencie destaques, anúncios e moderação em um painel só.

O front-end é uma página única (`EJS`) com navegação sem reload (modais + `pushState`), e o back-end é uma API REST em `Express + TypeScript` com persistência em `MongoDB (Mongoose)` e upload de imagens via `Cloudinary`.

## Funcionalidades

**Catálogo**
- Grade por gênero, Top 10 por nota bayesiana, busca e ordenação (A–Z, populares, melhor nota).
- Carrossel/hero com RPGs em edição limitada e destaques em ordem configurável.
- Página por RPG (`/rpg/:slug`) com SEO (meta tags, sitemap, `robots.txt`).
- CTA discreto para cadastro de RPG pela curadoria.

**Avaliações**
- Críticas com nota (0–5, meia-estrela), foto opcional e moderação (pendente/aprovada/rejeitada).
- Feed com infinite scroll misturando avaliações e posts de evento com boost por score.
- Respostas do criador nas avaliações do próprio sistema.

**Criadores**
- Selo de criador por sistema, painel com score/nível, acessos, avaliações, respostas e posts (com filtros e busca).
- Posts de evento com fixação temporária proporcional ao score do RPG.

**Anúncios**
- Multi-imagem por anúncio: cada criativo define onde aparece (topo/catálogo/ambos), formato (faixa/quadrado/poster) e posição (slot entre seções).

**Moderação e analytics**
- Aprovação de avaliações, destaques, criadores, denúncias e submissões de RPG.
- Monitoramento de tráfego: totais, últimos 7 dias, média/dia, pico, gráfico de 14 dias por tipo, top RPGs/buscas e atividade recente.

**Denúncias e submissões**
- Botão discreto de denúncia em cada RPG (motivos: golpe, inativo, falso; golpe exige provas em texto e/ou até 3 imagens).
- Envio de RPG por usuários logados (capa 2:3, banner 16:9 opcional) com fila de aprovação; ao aprovar, o autor ganha o selo de criador automaticamente.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Servidor | Express 5 + TypeScript 5 (execução com `tsx`) |
| View | EJS (página única) + Tailwind CSS via CDN + Cropper.js |
| Banco | MongoDB via Mongoose |
| Upload | Multer (memória) + Cloudinary |
| Auth | Token Bearer com sessões de 7 dias (TTL) |

## Estrutura

```text
src/
├── index.ts            # App Express, SEO (/rpg/:slug, sitemap) e boot
├── types.ts            # Interfaces compartilhadas (RPG, Review, User...)
├── data.ts             # Regras de negócio e acesso ao banco
├── database.ts         # Conexão com o MongoDB
├── migrate.ts          # Migração de src/data/db.json para o MongoDB
├── models/             # Schemas Mongoose (Rpg, Review, User, Ad, Report...)
├── routes/
│   ├── public.ts       # GET / (render da página)
│   ├── api.ts          # REST: rpgs, reviews, ads, creators, reports...
│   └── auth.ts         # Registro, login, sessão e perfil
├── views/public.ejs    # Página única (HTML + CSS + JS)
├── public/images/      # Assets estáticos
└── data/db.json        # Massa inicial para migração
docs/
├── mapa-do-projeto.md  # Mapa interno detalhado (histórico)
└── backlog.md          # Backlog interno (histórico)
```

## Começando

Pré-requisitos: Node 18+ e uma conta com MongoDB (ex.: Atlas) e Cloudinary.

```bash
npm install
cp .env.example .env   # preencha as variáveis abaixo
npm run migrate        # opcional: importa src/data/db.json
npm run dev            # http://localhost:3000
```

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `MONGO_URI` | sim | String de conexão do MongoDB |
| `CLOUDINARY_CLOUD_NAME` | sim | Cloud name do Cloudinary |
| `CLOUDINARY_API_KEY` | sim | API key do Cloudinary |
| `CLOUDINARY_API_SECRET` | sim | API secret do Cloudinary |
| `PORT` | não | Porta do servidor (padrão `3000`) |

### Scripts

| Script | O que faz |
| --- | --- |
| `npm run dev` | Sobe com reload (`tsx watch`) |
| `npm start` | Sobe em modo normal |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Copia views/assets para `dist/` |
| `npm run migrate` | Migra `db.json` para o MongoDB |

## API (resumo)

Autenticação: header `Authorization: Bearer <token>`. Papéis: `user` e `admin`; criadores têm selo por sistema (`creatorOf`).

**Páginas e SEO:** `GET /`, `GET /rpg/:slug`, `GET /sitemap.xml`, `GET /robots.txt`.

| Área | Endpoints |
| --- | --- |
| RPGs | `GET /api/rpgs`, `GET /api/rpgs/ratings`, `GET /api/rpgs/:name`, `POST /api/rpgs` (auth), `PATCH /api/rpgs/:name` (admin), `PATCH /api/rpgs/:name/featured` (admin), `PATCH /api/rpgs/featured-order` (admin), `DELETE /api/rpgs/:name` (admin, com cascata) |
| Avaliações | `GET /api/reviews` (`?rpg=`), `POST /api/reviews` (auth, imagem opcional), `GET /api/reviews/feed` (`?skip&limit`), `GET /api/reviews/pending` (admin), `PATCH /api/reviews/:id/approve` / `reject` (admin), `DELETE /api/reviews/:id` |
| Respostas | `GET /api/reviews/:id/replies`, `POST /api/reviews/:id/replies` (criador), `DELETE /api/replies/:id` |
| Eventos | `GET /api/feed/events`, `GET /api/posts`, `POST /api/posts` (criador), `DELETE /api/posts/:id` |
| Anúncios | `GET /api/ads`, `GET /api/ads/all` (admin), `POST /api/ads` (admin), `PATCH /api/ads/:id` (admin), `DELETE /api/ads/:id` (admin) |
| Criadores | `PATCH /api/creators/:username` (admin), `GET /api/creators/:username/stats` |
| Denúncias | `POST /api/reports` (texto + até 3 imagens), `GET /api/reports` (admin), `GET /api/reports/pending-count` (admin), `PATCH /api/reports/:id` (admin) |
| Submissões | `POST /api/submissions` (auth, capa + banner), `GET /api/submissions` (admin), `GET /api/submissions/pending-count` (admin), `PATCH /api/submissions/:id` (admin, aprovar cria o RPG) |
| Analytics | `POST /api/analytics`, `GET /api/analytics/summary` (admin) |
| Admin | `POST /api/admin/cleanup-orphans` (admin, remove avaliações/posts/visitas órfãs) |
| Auth | `GET /api/auth/users`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile` |

## Modelos de dados

`Rpg`, `Review` (status), `ReviewReply`, `User` (`creatorOf`), `Session` (TTL 7 dias), `Ad` (`creatives[]`), `EventPost`, `Report` (+ `evidenceImages[]`), `RpgSubmission`, `Visit` (`pageview`/`rpgview`/`search`).

Regras que valem saber:
- Ranking usa média bayesiana (`m=20, C=3.5`); o score do criador (0–100) deriva dela e define o tempo de boost dos posts de evento (6h a ~96h).
- Excluir um RPG apaga em cascata suas avaliações, respostas, posts e visitas.
- Na inicialização o servidor remove registros órfãos automaticamente (com log).

## Deploy

Defina `PORT`, `MONGO_URI` e as chaves do Cloudinary no provedor, rode `npm install` e inicie com `npm start`. O `npm run build` apenas copia `views/` e `public/` para `dist/` (a execução usa `tsx` direto do `src/`).

## Licença

ISC — veja [LICENSE](./LICENSE).
