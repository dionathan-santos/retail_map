# Instruções do projeto (retail_map)

## Branch principal

- `master` é a branch mãe (padrão) deste projeto. Todo deploy (Cloudflare
  Pages) é feito a partir dela.
- Nunca desenvolva direto na `master`. Toda mudança deve:
  1. Ser feita em uma branch separada (feature branch).
  2. Ser aberta como Pull Request tendo `master` como base.
  3. Ser revisada e então mergeada na `master`.
- Não deixe branches de feature acumulando sem merge — depois de mergear
  um PR, a branch pode ser apagada. O objetivo é manter o histórico do
  projeto simples e evitar múltiplas branches divergentes.
- **Antes de começar qualquer trabalho, rode `git fetch origin master` e
  confira se a branch local está em cima da `master` atual.** Este projeto
  evolui rápido (várias features grandes por semana); uma branch criada a
  partir de uma `master` antiga diverge muito rápido e gera conflitos
  gigantes na hora do PR — se afastar demais, prefira resetar a branch pra
  `origin/master` e reaplicar as mudanças por cima, em vez de tentar
  rebase/merge de uma base muito velha.

## Deploy (Cloudflare)

- Hospedagem: **Cloudflare Workers com static assets** (não é mais o Pages
  clássico — o dashboard da Cloudflare já não oferece criação de Pages
  isolado, só "Create a Worker"). Produção = branch `master`; outras
  branches conectadas ao mesmo projeto Git geram preview URLs
  (`https://<branch>-retailmap.dionathan-adiel.workers.dev`), nunca o
  domínio de produção.
- Nome do Worker no Cloudflare: **`retailmap`** — o campo `name` em
  `wrangler.toml` precisa bater com esse slug, senão o build da Cloudflare
  emite um warning e sobrescreve o nome silenciosamente.
- Build command: `npm run build` (Vite) → gera `dist/`.
- Deploy command (definido no dashboard): `npx wrangler versions upload`.
  Isso é o fluxo novo e unificado de Workers, não o antigo
  `wrangler pages deploy`. Por isso o `wrangler.toml` precisa do bloco
  `[assets]` (não basta um `pages_build_output_dir` isolado):
  ```toml
  name = "retailmap"
  main = "worker/index.js"

  [assets]
  directory = "./dist"
  binding = "ASSETS"
  ```
- Backend: `worker/index.js` é o fetch handler único — serve `/api/*`
  (pontos, ícones, estilos de categoria, shapes desenhados) e delega tudo
  mais pro binding `ASSETS` (os arquivos estáticos do `dist/`).
- Dados persistem no **Cloudflare D1** (`retail-map-db`, binding `DB`,
  schema em `schema.sql`). O `database_id` real já está em
  `wrangler.toml` — não precisa reprovisionar.
- Para validar localmente antes de dar push, sem depender do dashboard:
  ```bash
  npm run build
  npx wrangler versions upload --dry-run   # valida a config de assets/entry-point
  npx wrangler d1 execute retail-map-db --local --file=schema.sql
  npx wrangler dev --local                 # roda o Worker + API + D1 local, serve em :8787
  ```
  `npm run dev` (Vite puro) sobe a UI mas **não** tem as rotas `/api/*`
  funcionando — para testar qualquer fluxo que dependa do backend
  (pontos, ícones, bulk upload), use `wrangler dev`.

## Estrutura do projeto

```
/retail_map
  index.html            # shell da SPA: header, painéis (layer-toggle, draw,
                         # legend), #right-rail (point-form, bulk-upload,
                         # icon-bank, category-style), #map
  wrangler.toml          # config do Worker: name, main, [assets], D1 binding
  schema.sql              # schema do D1 (points, custom_icons, category
                           # style overrides, shapes)
  vite.config.js
  /worker
    index.js               # fetch handler único: roteia /api/* (points,
                            # icons, category-styles, shapes) e serve
                            # estático via ASSETS
  /src
    main.js                 # bootstrap: initMap() -> monta todos os painéis
    map.js                  # MapLibre: init (basemap raster georreferenciado
                             # de src/basemap-config.json), camada de pontos
                             # (retail-points-symbol, ícones custom), toggle
                             # de visibilidade
    api.js                  # cliente fetch fino pras rotas /api/* do Worker
    draw.js                 # Terra Draw: polígonos/formas desenháveis
    export.js                # captura do canvas + composição em PDF (jsPDF)
    basemap-config.json      # URL + coordenadas de georreferenciamento do
                              # raster base (public/basemap.png)
    /components
      layer-toggle-panel.js
      draw-toolbar.js
      legend-panel.js
      point-form.js          # form de "Add Point" (nome, categoria, ícone,
                              # lat/lng, endereço, status)
      bulk-upload.js          # upload de Excel -> pontos em massa (D1)
      icon-bank.js             # upload de PNGs custom, atribuídos por
                               # categoria ou por ponto
      category-style-picker.js
      projects-panel.js        # painel de Projetos (ver seção abaixo)
    current-project.js         # estado compartilhado: qual projeto está
                                # ativo agora (null = mapa base)
    /styles
      categories.js            # paleta/formas de ícone por categoria
      main.css
  /public
    basemap.png               # raster georreferenciado do mapa base
  /templates
    points-bulk-upload-template.xlsx
```

- Stack: MapLibre GL JS (raster/image source, não mais vetor/PMTiles),
  Terra Draw, jsPDF. Sem glyphs externos de propósito — nomes de pontos
  aparecem só no popup de clique, não como `text-field` no mapa (evita
  dependência de CDN de fontes).
- Antes de mexer em `map.js`/`worker/index.js`/`wrangler.toml`/schema do
  D1, ler o `README.md` (ele documenta a pivotagem de v1 -> v2 e como
  rodar tudo localmente) — o `RETAIL_MAP_SPEC.md` é o spec **antigo**
  (v1, Protomaps/GeoJSON estático) e não reflete mais a arquitetura atual.

## Projetos (ambientes isolados)

- Um "Projeto" é um ambiente isolado: nome, cliente e usuário (D1,
  tabela `projects`). Enquanto um projeto está ativo, os pontos e formas
  desenhadas (`shapes`) criados pelas ferramentas normais do mapa
  (Add Point, Bulk Upload, Draw Polygon) são gravados com
  `project_id = <id do projeto>` em vez de ficarem soltos no mapa base.
  Ícones customizados e estilos de categoria continuam **globais**,
  compartilhados entre todos os projetos e o mapa base.
- `src/current-project.js` guarda qual projeto está ativo agora (client-side,
  em memória — não persiste entre reloads de página de propósito). Todo
  código que cria pontos/shapes lê esse estado na hora de gravar
  (`point-form.js`, `bulk-upload.js`, `draw.js`); todo código que lista
  pontos/shapes passa esse id pra API (`map.js`, `draw.js`).
- **Mapa base = temporário.** Pontos/shapes criados fora de qualquer
  projeto (`project_id IS NULL`) são apagados depois de 24h — o Worker
  filtra isso em `GET /api/points` e `/api/shapes` (não aparecem mais no
  mapa depois de 24h, mesmo antes do cron rodar), e um Cloudflare Cron
  Trigger (`[triggers]` em `wrangler.toml`, roda de hora em hora) apaga
  fisicamente essas linhas do D1 depois disso.
- **Dados que já existiam antes dessa feature nunca são apagados
  automaticamente.** Na primeira request depois do deploy,
  `worker/index.js` (`ensureSchema()`) migra sozinho o banco de produção
  (adiciona a tabela `projects` e a coluna `project_id` em `points`/
  `shapes` via `ALTER TABLE`, sem precisar rodar `wrangler d1 execute
  --remote` manualmente) e grava em `app_meta` o timestamp desse momento
  (`base_map_temporary_since`). A regra das 24h só vale pra linhas criadas
  **depois** desse timestamp — tudo que já existia continua visível pra
  sempre, a não ser que alguém apague manualmente ou mova pra dentro de
  um projeto.
- Deletar um projeto (`DELETE /api/projects/:id`) apaga em cascata os
  pontos e shapes dele — D1/SQLite não faz cascade automático de FK, isso
  é feito manualmente no handler.
