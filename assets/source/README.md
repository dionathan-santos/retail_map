# Source assets (not committed until provided)

Arquivos de origem do mapa base — vindos do spec v2. Salvar aqui:

- `Retail_map_no_icons.pdf` (obrigatório) — ou `Retail_map_no_icons.ai`, se preferir manter o vetorial original.
- `georef_transform.py` e/ou `georefTransform.js` (obrigatório) — coeficientes da
  transformação afim PDF-point -> lat/lng, já fitados. Reuso direto, sem refit.
- `gcp_points.csv` (opcional, referência/auditoria dos 12 GCPs usados no fit).
- `GCP_Collector.ipynb` (opcional, só necessário se for preciso adicionar mais GCPs).

Esses arquivos alimentam o script que gera o PNG de alta resolução usado como
raster background no MapLibre (ver Opção A do spec).
