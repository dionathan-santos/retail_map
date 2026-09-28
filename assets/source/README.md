# Source assets (not committed until provided)

Arquivos de origem do mapa base — vindos do spec v2. Salvar aqui:

- `FIKA_Locations_Sept_2026.pdf` (obrigatório) — o PDF fonte do mapa base atual.
- `georef_transform.py` e/ou `georefTransform.js` (obrigatório) — coeficientes da
  transformação afim PDF-point -> lat/lng, já fitados. Reuso direto, sem refit.
- `gcp_points.csv` (opcional, referência/auditoria dos GCPs usados no fit).
- `GCP_Collector.ipynb` (opcional, só necessário se for preciso adicionar mais GCPs).

Trocou o PDF fonte? Depois de gerar um `gcp_points.csv` novo (rodando o
`GCP_Collector.ipynb` contra o PDF novo), rode:

```bash
pip install numpy
python3 scripts/fit-georef-transform.py assets/source/gcp_points.csv \
    --pdf-width <largura em pt> --pdf-height <altura em pt>
python3 scripts/render-basemap.py   # depois de ajustar SOURCE_PDF no script
```

Esses arquivos alimentam o script que gera o PNG de alta resolução usado como
raster background no MapLibre (ver Opção A do spec).
