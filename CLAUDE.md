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
