> Nota: documento interno de trabalho (mapa histórico do projeto). Pode estar desatualizado em pontos — o README na raiz é a referência atual.

================================================================================
  MAPPING DO PROJETO — TypeScriptLab (Rpflix / Critique.rpg)
================================================================================

  Stack: Express 5 + TypeScript + EJS + Tailwind CSS (CDN) + MongoDB (Mongoose)
  Inicio: npm start → http://localhost:3000

================================================================================
  ESTRUTURA DE DIRETORIOS
================================================================================

  TypeScriptLab/
  ├── src/
  │   ├── index.ts              # Entry point do servidor
  │   ├── types.ts              # Interfaces compartilhadas
  │   ├── data.ts               # Camada de dados (MongoDB via Mongoose)
  │   ├── database.ts           # Conexao com MongoDB
  │   ├── migrate.ts            # Script de migracao de db.json → MongoDB
  │   ├── models/
  │   │   ├── Rpg.ts            # Model Mongoose de RPG
  │   │   ├── Review.ts         # Model Mongoose de Review
  │   │   ├── User.ts           # Model Mongoose de Usuario
  │   │   └── Session.ts        # Model Mongoose de Sessao (token)
  │   ├── routes/
  │   │   ├── public.ts         # Rota que renderiza a pagina principal
  │   │   ├── api.ts            # API de reviews + RPGs (CRUD admin)
  │   │   └── auth.ts           # API de autenticacao + perfil
  │   ├── views/
  │   │   └── public.ejs        # Template unico (HTML + CSS + JS)
  │   ├── public/               # Arquivos estaticos
  │   └── data/
  │       └── db.json           # Backup/dados para migracao inicial
  ├── mapping.txt               # Este arquivo
  ├── .env.example
  ├── .env
  ├── .gitignore
  ├── package.json
  ├── tsconfig.json
  └── README.md

================================================================================
  ARQUIVO: src/index.ts
================================================================================

  Configura DNS (Google 8.8.8.8), carrega dotenv, configura Cloudinary SDK.
  Conecta ao MongoDB via connectDatabase() em segundo plano.
  Importa e monta os roteadores:
    - / (GET)  → publicRouter (renderiza a view)
    - /public  → publicRouter
    - /api     → apiRouter (reviews + RPGs)
    - /api/auth → authRouter (autenticacao)

  Configura:
    - view engine = EJS
    - diretorio de views = ./src/views
    - static = ./src/public
    - JSON parser (limite 50mb)
    - urlencoded parser (limite 50mb)

  Rotas extras:
    - GET /robots.txt → sitemap + permissao crawlers
    - GET /sitemap.xml → URLs de todos os RPGs
    - GET /rpg/:slug → pagina do RPG (com meta tags SEO)

================================================================================
  ARQUIVO: src/types.ts
================================================================================

  Interfaces exportadas:
  ┌──────────────────────────────────────────────────────────────────────────┐
  │ Tag { name, weight }                                                     │
  │   → Tag para categorizacao de RPGs                                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ RPG { name, owner, genre, image, banner, description, link?,            │
  │       whatsapp?, year?, ageRating, featured?, blurImage?, tags? }        │
  │   → Sistema de RPG com suporte a link, WhatsApp, classificacao etaria,   │
  │     destaque (featured), efeito blur, e tags                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Review { id, rpg, username, rating, comment, timeAgo, createdAt,        │
  │         status, customImage? }                                           │
  │   → Avaliacao com status (pending/approved/rejected) e imagem opcional   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ ReviewInput { rpgName, rating, comment, customImage? }                   │
  │   → Dados enviados no POST /api/reviews                                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ User { id, username, passwordHash, role, bio?, avatar?, contact? }       │
  │   → Usuario com role (user/admin), bio, avatar e contato                 │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/data.ts
================================================================================

  Camada de dados com MongoDB via Mongoose. Tudo persiste no banco.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES AUXILIARES                                                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ toSlug(name) → string                                                    │
  │   Converte nome para slug (URL amigavel)                                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ calcTimeAgo(createdAt) → string                                          │
  │   Calcula tempo relativo ("5 min atras", "2 d atras")                    │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ rpgFromDoc(doc) → RPG                                                    │
  │   Converte documento MongoDB para interface RPG                          │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ reviewFromDoc(doc, rpg) → Review                                         │
  │   Converte documento MongoDB para interface Review                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ userFromDoc(doc) → User                                                  │
  │ userPublicFromDoc(doc) → User (sem passwordHash)                         │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES DE RPG                                                           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getRpgs() → Promise<RPG[]>                                               │
  │   Retorna todos os RPGs                                                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getRpgByName(name) → Promise<RPG | undefined>                            │
  │   Busca RPG pelo nome                                                    │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ addRpg(input) → Promise<RPG>                                             │
  │   Cria novo RPG (banner = image se nao fornecido)                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ updateRpg(name, updates) → Promise<RPG | undefined>                      │
  │   Atualiza campos parciais de um RPG                                     │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ toggleFeaturedRpg(name) → Promise<RPG | undefined>                       │
  │   Alterna flag featured de um RPG                                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ deleteRpg(name) → Promise<boolean>                                       │
  │   Remove RPG pelo nome                                                   │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES DE REVIEW                                                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getReviews(all?) → Promise<Review[]>                                     │
  │   Retorna reviews aprovadas (ou todas se all=true)                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getPendingReviews() → Promise<Review[]>                                  │
  │   Retorna apenas reviews com status pending                              │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ addReview(input, username) → Promise<Review>                             │
  │   Cria review (status pending se nao-admin, approved se admin)           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ approveReview(reviewId) → Promise<Review | undefined>                    │
  │   Aprova uma review pendente                                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ rejectReview(reviewId) → Promise<boolean>                                │
  │   Rejeita uma review pendente                                            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ deleteReviewById(reviewId, username, isAdmin) → Promise<boolean>         │
  │   Exclui review (proprietario ou admin)                                  │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES DE USUARIO E AUTENTICACAO                                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ registerUser(username, password, contact?, avatar?)                      │
  │   → { user, token } | { error }                                          │
  │   Primeiro usuario registrado vira admin                                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ loginUser(username, password) → { user, token } | { error }              │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getUserByToken(token) → User | undefined                                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getUsers() → Omit<User, 'passwordHash'>[]                                │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ updateProfile(userId, { bio, avatar }) → User | undefined                │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ logoutUser(token) → void                                                 │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES DE RANKING                                                       │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getRpgRatings() → Promise<RpgRating[]>                                   │
  │   Calcula media + media bayesiana (m=20, C=3.5) para cada RPG           │
  │   Ordena por bayesianAvg descendente                                     │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES INTERNAS (PRIVADAS)                                              │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ hashPassword(password) → string                                          │
  │   Salt aleatorio (16 bytes) + hash scryptSync (64 bytes) → "salt:hash"   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ verifyPassword(password, stored) → boolean                               │
  │   Extrai salt, recalcula hash, compara                                   │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/database.ts
================================================================================

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ connectDatabase() → Promise<void>                                        │
  │   Conecta ao MongoDB usando MONGO_URI do .env                            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ disconnectDatabase() → Promise<void>                                     │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/migrate.ts
================================================================================

  Script unico de migracao: le src/data/db.json e popula o MongoDB.
  Limpa colecoes existentes antes de inserir.
  Migra: RPGs, Usuarios (com hash de senha), Reviews, Sessoes (mapeando IDs).

================================================================================
  ARQUIVO: src/models/ (Mongoose Schemas)
================================================================================

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ Rpg.ts → Schema IRpg                                                     │
  │   name (unique), owner, genre, image, banner, description, link,        │
  │   whatsapp, year, ageRating, featured, blurImage, tags[] (name+weight)  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Review.ts → Schema IReview                                               │
  │   rpgName, username, rating (0-5), comment, customImage,                │
  │   status (pending|approved|rejected, default: pending), createdAt        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ User.ts → Schema IUser                                                   │
  │   username (unique, min 3), passwordHash, role (user|admin),            │
  │   bio, avatar, contact                                                   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Session.ts → Schema ISession                                             │
  │   token (unique), userId, createdAt (TTL: 604800s = 7 dias)             │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/routes/public.ts
================================================================================

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ getPageData() → { rpgs, reviews, pendingReviews, allReviews,            │
  │                  users, rpgRatings, topRpgs }                            │
  │   Carrega todos os dados necessarios para renderizar a view             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ GET / (e /public)                                                        │
  │   Renderiza "public.ejs" com todos os dados da pagina                   │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/routes/api.ts
================================================================================

  Endpoints de reviews (alguns requerem autenticacao):

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ GET /api/rpgs                                                            │
  │   Lista todos os RPGs (JSON)                                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ GET /api/rpgs/:name                                                      │
  │   Busca RPG pelo nome                                                    │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ GET /api/reviews?rpg=Nome                                                │
  │   Retorna reviews aprovadas. Se ?rpg=, filtra por nome                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ POST /api/reviews (Auth: Bearer token)                                   │
  │   Cria nova review. FormData: rpgName, rating, comment, image (opcional)│
  │   - Multer memoryStorage (limite 30MB, jpg/png/webp/gif)                 │
  │   - Se image enviada → uploadToCloudinary() (pasta "rpg-reviewer")       │
  │   - Status: approved se admin, pending se usuario comum                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ GET /api/reviews/pending (Auth: Admin)                                   │
  │   Retorna reviews pendentes de moderacao                                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ PATCH /api/reviews/:id/approve (Auth: Admin)                             │
  │   Aprova uma review pendente                                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ PATCH /api/reviews/:id/reject (Auth: Admin)                              │
  │   Rejeita uma review pendente                                            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ DELETE /api/reviews/:id (Auth: proprietario ou admin)                    │
  │   Exclui uma review                                                      │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ POST /api/rpgs (Auth)                                                    │
  │   Cria novo RPG. FormData: name, owner, genre, year, ageRating,         │
  │   description, link, whatsapp, tags (JSON), image, banner (opcional)     │
  │   Upload de image e banner para Cloudinary (pasta "rpg-reviewer/rpgs")  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ PATCH /api/rpgs/:name (Auth: Admin)                                      │
  │   Atualiza RPG. Suporta upload de nova image/banner                     │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ PATCH /api/rpgs/:name/featured (Auth: Admin)                             │
  │   Alterna flag featured do RPG                                           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ DELETE /api/rpgs/:name (Auth: Admin)                                     │
  │   Exclui um RPG                                                          │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/routes/auth.ts
================================================================================

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ GET /api/auth/users                                                      │
  │   Lista todos os usuarios (sem passwordHash)                             │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ POST /api/auth/register (multipart/form-data)                            │
  │   Campos: username, password, contact (opcional), avatar (opcional)      │
  │   - Valida username (min 3) e password (min 4)                           │
  │   - Avatar opcional → upload Cloudinary (pasta "rpg-reviewer/avatars")   │
  │   - Primeiro usuario vira admin                                          │
  │   Resposta 201: { user, token }                                          │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ POST /api/auth/login (JSON)                                              │
  │   Corpo: { username, password }                                          │
  │   Resposta 200: { user, token }                                          │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ POST /api/auth/logout (Auth: Bearer token)                               │
  │   Remove token do banco                                                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ GET /api/auth/me (Auth: Bearer token)                                    │
  │   Retorna dados do usuario logado (id, username, role, bio, avatar, etc)│
  ├──────────────────────────────────────────────────────────────────────────┤
  │ PATCH /api/auth/profile (Auth: Bearer token)                             │
  │   Atualiza bio e/ou avatar do usuario logado                             │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  ARQUIVO: src/views/public.ejs
================================================================================

  Template unico de pagina inteira (~684 linhas). EJS renderiza dados
  do servidor + JavaScript client-side para interatividade.

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ SECOES DO HTML                                                           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ <head>                                                                   │
  │   Google Fonts (Plus Jakarta Sans + Space Grotesk)                      │
  │   Tailwind CSS (CDN) + config custom de fontes                          │
  │   FontAwesome 6.4 (CDN)                                                  │
  │   CSS custom: .no-scrollbar, .glassmorphism                              │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Header                                                                   │
  │   Logo "Critique.rpg" com icone de dado                                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Stories (Em Destaque)                                                    │
  │   Loop EJS: rpgs.forEach → botoes circulares, ao clicar → filtrarRPG()  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Busca                                                                   │
  │   Input de texto, toggle visivel via toggleSearch()                     │
  │   Ao digitar → buscarNoFeed() (filtra cards pelo texto)                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Feed de Avaliacoes                                                       │
  │   Loop EJS: reviews.forEach → cards com capa, nome, genero, editora,    │
  │   badge do usuario, estrelas (suporta meia-estrela), comentario         │
  │   Atributo data-rpg usado para filtro                                   │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Navbar Inferior                                                          │
  │   Inicio → limparFiltros()                                              │
  │   Buscar → toggleSearch()                                               │
  │   Avaliar (botao central destacado) → abrirModalAvaliacao()             │
  │   Catalogo (substitui Ranking) → overlay Netflix-style                  │
  │   Entrar/Perfil → condicional conforme getUser()                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Modal de Avaliacao                                                       │
  │   Fundo gradiente escuro, card largo com bordas suaves                  │
  │   Badge do usuario logado (nome + avatar)                               │
  │   Select de RPG (loop EJS), input de capa (opcional, ate 5MB)          │
  │   Seletor de estrelas interativo (hidden input #form-rating)            │
  │   Textarea 5 linhas, botao "Publicar Critica"                           │
  │   Se nao logado → redireciona para modal login                          │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Modal de Login / Registro                                                │
  │   Formularios com validacao client-side, erros exibidos em divs         │
  │   Links para alternar entre login e cadastro                            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Modal de Configuracoes                                                   │
  │   Checkboxes placeholder (Filtro de Conteudo, Portugues)                │
  └──────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────┐
  │ FUNCOES JAVASCRIPT (CLIENT-SIDE)                                         │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ getToken() / getUser() / saveSession() / clearSession()                  │
  │   Gerenciamento de sessao no localStorage                               │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ atualizarNavbar() / abrirPerfil() / fazerLogout()                        │
  │   Controles da navbar e logout                                           │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ verificarSessao()                                                        │
  │   Valida token salvo via GET /api/auth/me ao carregar pagina            │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ fazerLogin() / fazerRegistro()                                           │
  │   Envia POST para /api/auth/login ou /api/auth/register                 │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ toggleSearch() / buscarNoFeed() / filtrarRPG() / limparFiltros()         │
  │   Filtros do feed                                                        │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ abrirModalAvaliacao() / postarAvaliacao()                                │
  │   Abre modal, envia POST /api/reviews via FormData com ou sem foto      │
  │   Se 401 → limpa sessao, redireciona para login                         │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ atualizarNomeArquivo(input)                                              │
  │   Mostra nome do arquivo selecionado no file input                      │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Seletor de estrelas (clique em #star-rating i)                          │
  │   Atualiza hidden input #form-rating (1-5), classes das estrelas,      │
  │   label (Selecione/Pessimo/Ruim/Regular/Bom/Excelente)                  │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ abrir/fechar modais: login, registro, avaliacao, configuracoes          │
  ├──────────────────────────────────────────────────────────────────────────┤
  │ Tema Netflix (vermelho #e50914) configurável no desktop:                │
  │   Botao "Tema" fixo na lateral (> 1024px)                               │
  │   Color pickers para bg, cards, destaque, texto, estrelas              │
  │   Tema salvo no localStorage, botao "Exportar" copia vars               │
  └──────────────────────────────────────────────────────────────────────────┘

================================================================================
  .ENV
================================================================================

  Variaveis obrigatorias:
    MONGO_URI              → string de conexao do MongoDB
    CLOUDINARY_CLOUD_NAME  → Cloudinary cloud name
    CLOUDINARY_API_KEY     → Cloudinary API key
    CLOUDINARY_API_SECRET  → Cloudinary API secret

================================================================================
  package.json
================================================================================

  Dependencies (producao):
    cloudinary ^2.10    → Upload e CDN de imagens
    dotenv ^17.4        → Carrega .env em process.env
    ejs ^6.0.1          → Template engine
    express ^5.2.1      → Framework web (beta)
    mongoose ^9.8.0     → ODM MongoDB
    multer ^2.2.0       → Parse de multipart/form-data (memoryStorage)
    tsx ^4.23.1         → Executa TypeScript diretamente

  DevDependencies:
    typescript ^5.0, @types/express, @types/multer, @types/node

  Scripts:
    npm run dev      → tsx watch src/index.ts (modo watch)
    npm start        → npx tsx src/index.ts
    npm run build    → copia views/ e public/ para dist/
    npm run migrate  → npx tsx src/migrate.ts

================================================================================
  tsconfig.json
================================================================================

  Opcoes principais:
    target: ES2022
    module: NodeNext
    moduleResolution: NodeNext
    strict: true
    rootDir: ./src
    outDir: ./dist

================================================================================
  FLUXO DA APLICACAO
================================================================================

  1. Servidor inicia → conecta MongoDB + configura Express + Cloudinary
  2. Usuario acessa http://localhost:3000
  3. Rota / (ou /public) renderiza public.ejs com rpgs, reviews, usuarios,
     ranking, etc.
  4. Pagina carrega, JS executa verificarSessao() (valida token salvo)
  5. Usuario interage:
     - Stories → filtrarRPG() (filtro local por data-rpg)
     - Busca → buscarNoFeed() (filtro por texto nos cards)
     - Avaliar (logado) → modal com estrelas + upload opcional de capa
       → imagem vai pro Cloudinary via memoryStorage + upload_stream
       → secure_url salva como customImage na review
     - Avaliar (sem login) → modal login
     - Catalogo → overlay Netflix-style com banner hero
     - Entrar → modal login/registro com avatar opcional
     - Perfil (logado) → confirm → logout
  6. Admin:
     - Modera reviews pendentes (aprovar/rejeitar)
     - CRUD completo de RPGs
     - Alternar featured dos RPGs
  7. Tema Netflix customizavel (> 1024px), salvo no localStorage

================================================================================
  POSSIVEIS MELHORIAS FUTURAS
================================================================================

  - Paginacao do feed
  - Pagina de perfil do usuario com historico
  - Pagina de detalhes do RPG com nota media
  - Notificacoes para admins quando nova review pendente
  - Upload de avatar no registro (front-end)
  - Testes automatizados
  - CI/CD

================================================================================
