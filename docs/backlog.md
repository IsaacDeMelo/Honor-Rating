# TASKS — Pendências do TypeScriptLab

> Nota: documento interno de trabalho (backlog histórico). Pode conter itens já concluídos.

Código de produção: `C:\Users\Administrador\Desktop\Isaac\TypeScriptLab\TypeScriptLab\` (branch main, commit caba182).
Stack: Express 5 + TypeScript + EJS + MongoDB/Mongoose (SPA: modais + pushState, sem reload).

---

## JÁ FEITO (contexto)
- Feed unificado: posts de evento entram no infinite scroll (`/api/feed/events`, fases events→reviews em `carregarMaisFeed`) e são ordenados por boost.
- Score/boost de posts: `rpgScoreFromBayesian` (0–100), `eventPostBoostHours` (6h base + até 90h), `getEventPosts` ordena por boost→idade; cards mostram "Em alta · Xh" ou "Caindo".
- Painel do Criador: `/api/creators/:username/stats` (acessos por `VisitModel` rpgview, avaliações, média, respostas, posts, posts impulsionados, score/nível do criador). Botão + chip de score no perfil.
- Erros `tsc` de `VisitType`/`VisitModel` corrigidos (imports em `src/data.ts`).
- Sistema de ads com `placement`/`slot`/`format` de **imagem única** (ver nº 1: isso será SUBSTITUÍDO por multi-imagem).

---

## 1. ANÚNCIOS — SUPORTE A MÚLTIPLAS IMAGENS (PRIORIDADE ALTA)
O anunciante precisa conseguir cadastrar **várias imagens** e, para **cada imagem**, escolher:
**onde ela aparece** (topo/carrossel OU entre as categorias OU ambos), **o formato** (faixa larga / quadrado / poster) e **o lugar** (slot = após qual seção do catálogo).

Hoje existem campos de imagem única (`image`, `placement`, `slot`, `format`) que devem virar um **array**.

- **Modelo** `src/models/Ad.ts`:
  - Substituir `image: string` + `placement/slot/format` por:
    ```ts
    type AdPlacement = 'hero' | 'catalog' | 'both'
    type AdFormat = 'wide' | 'square' | 'poster'
    interface AdCreative { image: string; placement: AdPlacement; slot: number; format: AdFormat }
    // IAd: title, link?, active, creatives: AdCreative[], createdAt
    ```
  - Default: `creatives: []`.
- **`src/data.ts`**: interface `Ad`, `adFromDoc`, `addAd`, `updateAd` passando a serializar/gravar o array `creatives` (regra de negócio: ad ativo e sem criativos não é exibido).
- **`src/routes/api.ts`**:
  - `POST /ads` e `PATCH /ads/:id`: aceitar **upload múltiplo** (`upload.array('images')`) e metadados por imagem (ex.: JSON `creatives` com `[{placement, slot, format}]`, um por arquivo). PATCH deve permitir adicionar/remover criativos (ex.: campo `removeCreatives` com índices) sem apagar a imagem existente.
- **Modal de anúncios** `src/views/public.ejs` (`#modal-anuncios` + `renderAnuncios`/`editarAnuncio`/`criarAnuncio`):
  - Permitir adicionar N imagens; para cada uma, um mini-formulário com: preview da imagem, select `Onde exibir` (topo/entre categorias/ambos), select `Formato` (faixa larga/quadrado/poster) e input `Posição (slot)`.
  - Na lista de anúncios (`#anuncios-list`) mostrar todos os criativos (miniaturas + posição/formato de cada).
  - Migrar a lógica atual de `refreshAds`/`atualizarHero` para consumir `creatives`.

## 2. ANÚNCIOS ENTRE AS CATEGORIAS DO CATÁLOGO (PRIORIDADE ALTA)
Os anúncios não podem ficar só no topo: devem aparecer **entre as categorias**, na posição (slot) e formato definidos.

- **Rendering no catálogo** (`src/views/public.ejs`):
  - **Server (EJS)**: em `#catalog-grid-container` (linha ~871), após o "Top 10" e após cada `<div class="cat-section" data-genre=...>`, injetar os criativos `catalog/both` cujo `slot` corresponda à posição (0 = após o Top 10, 1 = após a 1ª categoria, etc.).
  - **Cliente (JS)**: `renderCatalogo` (~linha 2850), `filtrarCatalogo` (~2789) e `ordenarCatalogo` (~2812) precisam conservar/re-renderizar os blocos de anúncio ao refiltrar/reescolher ordem; `refreshAds` deve chamar o re-render do catálogo.
- **Formato do anúncio fora do carrossel**:
  - `wide`: faixa larga full-width (`aspect-[21/9]` ~ faixa horizontal).
  - `square`: card quadrado centralizado (`aspect-square`, largura limitada, ex. `max-w-60 mx-auto`).
  - `poster`: card vertical 2/3 (`aspect-[2/3]`, `max-w-44 mx-auto`).
- **Visual:** apenas a imagem, **SEM descrição/texto de link**. Sobre a imagem, no **canto inferior direito**, o responsável/anunciante (`title`) em letra BEM pequena (ex.: `text-[8px]`, semi-transparente com leve fundo escuro). Clicar abre o `link` em nova aba.
- Se não houver `link`, o clique não faz nada (ou não torna o card clicável).

## 3. HERO/CARROSSEL — SEM "LINK COMO DESCRIÇÃO" (PRIORIDADE MÉDIA)
- `buildHeroSlides` (linha ~1787 do `public.ejs`): usar apenas criativos com `placement` `hero`/`both` (hoje pega todos os ads ativos).
- `heroIrPara` (linha ~1824): para slides de anúncio a descrição (`#cat-desc`) deve ficar **vazia** — hoje mostra o `link` (URL crua) como descrição ("ficou feio"). Mostrar apenas: imagem, nome do anunciante (`title`) e selo "Anúncio". O `link` abre somente no clique (`heroClicar`).
- Manter `#cat-ad-link` discreto (ex.: "Parceiro" / ícone) ou removê-lo; não exibir a URL.

## 4. ABA DE BOTÕES VAZANDO DA TELA (PRIORIDADE MÉDIA)
- `#cat-admin-section` (`div.flex.gap-2` com os botões Novo Sistema / Pendentes / Anúncios / Destaques / Criadores, linha ~806) estoura a largura.
- Solução: wrapper com `overflow-x-hidden` + linha com `flex-wrap` (botões quebram linhaem vez de vazar), ou `overflow-x-auto` com `shrink-0` nos botões. Confirmar em mobile e desktop.

## 5. SELO DE CRIADOR — CORRIGIR POSICIONAMENTO (PRIORIDADE ALTA)
"Você colocou criador ao lado do nome do criador do RPG na review, mas não é pra fazer isso. Criador é só na conta do criador que eu defini, e nos comentários/respostas/posts dele."

- **Remover** o selo que hoje aparece ao lado de "Por: <owner do RPG>" nos cards de review (server: linha ~458/460 com `data-rpg`; JS: `criarCardFeed`; e o badge "Você é o criador" no modal de detalhe deve ser revisado).
- O indicador "Criador" deve aparecer **somente**:
  1. Na **conta/perfil** do usuário que recebeu o selo (papel "Criador" verde — já feito em `preencherPerfil`);
  2. Ao lado do **autor** nas reviews/comentários **que ele escreveu** (feed: `criarCardFeed` + server; detalhe: `renderReviewsNoDetalheList`), usando o AUTHOR, não o dono do RPG;
  3. Nas **respostas** dele (já mostra, manter);
  4. Nos **posts de evento** dele (já mostra, manter).
- Trocar a lógica de `atualizarFeedSelo` (linha ~2580): antes usava `isCreatorOfUser(rpgName)` (usuário logado é criador do RPG). Agora o badge deve ser por **autor** (`data-creator="<username>"`), exibindo quando aquele usuário (via `catUsersData`) tem `creatorOf` não vazio. Atualizar também os delete-buttons e o `#btn-postar-evento`.

## 6. MONITORAMENTO — GRÁFICO COM ERRO (PRIORIDADE MÉDIA)
- O gráfico "Últimos 14 dias" do modal de monitoramento (`#mon-daily`, `abrirMonitoramento` ~linha 3140) está com erro.
- Causas prováveis:
  - **Timezone**: `getAnalyticsSummary` (`src/data.ts`) calcula `since` com `setDate(-13)` no horário **local**, mas agrupa no Mongo por `$dateToString` (UTC) e monta os 14 dias com `d.toISOString().slice(0,10)` (**UTC**). Resultado: dias 'vazios'/deslocados ou barras em datas erradas. Corrigir para uma faixa coerente (usar `setUTCHours(0,0,0,0)`/chaves consistentes, ou `$dateToString` com `timezone`).
  - **Overflow das barras**: `#mon-daily` tem `h-32` e colunas `h-full` com `gap-1`; `height:h% + rótulo de contagem + label do dia` pode passar de 100% e cortar/vazar. Ajustar altura da barra (ex.: `Math.min(h, ...)` percentual da área restante) ou reorganizar o flex para caber.
- Testar com dados reais de `VisitModel` (que já está populado).

## 7. VERIFICAÇÃO FINAL (sempre ao terminar)
- `.\node_modules\.bin\tsc.cmd --noEmit` → sem erros.
- Subir: `$env:PORT="3999"; npx tsx src/index.ts` → `/` retorna 200.
- Validar JS dos `<script>` inline com `node --check`.
- Testar APIs: `GET /api/ads`, `GET /api/ads/all`, `POST /api/ads` (com múltiplos arquivos), `PATCH /api/ads/:id`, `DELETE /api/ads/:id`, `GET /api/creators/:username/stats`, `GET /api/feed/events`.
- Testar fluxos de UI: criar anúncio multi-imagem, ver anúncio entre categorias e no carrossel, painel do criador, gráfico do monitoramento, selo de criador nos lugares certos.