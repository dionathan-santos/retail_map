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
