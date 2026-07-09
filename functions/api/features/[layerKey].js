// Cloudflare Pages Function — persists drawn zone/ASP polygons to D1.
// Bound as `env.DB` in the Pages project's Settings > Functions > D1
// database bindings (see README.md).

const ALLOWED_LAYER_KEYS = new Set(["retail-zones", "asp-polygons"]);

function badRequest(message) {
  return Response.json({ error: message }, { status: 400 });
}

export async function onRequestGet({ env, params }) {
  const { layerKey } = params;
  if (!ALLOWED_LAYER_KEYS.has(layerKey)) return badRequest(`unknown layer: ${layerKey}`);

  const { results } = await env.DB.prepare(
    "SELECT id, geometry, properties FROM drawn_features WHERE layer_key = ?"
  )
    .bind(layerKey)
    .all();

  const features = results.map((row) => ({
    type: "Feature",
    id: row.id,
    geometry: JSON.parse(row.geometry),
    properties: JSON.parse(row.properties),
  }));

  return Response.json({ type: "FeatureCollection", features });
}

export async function onRequestPut({ env, params, request }) {
  const { layerKey } = params;
  if (!ALLOWED_LAYER_KEYS.has(layerKey)) return badRequest(`unknown layer: ${layerKey}`);

  const body = await request.json();
  const features = Array.isArray(body?.features) ? body.features : [];
  const now = new Date().toISOString();

  const statements = [
    env.DB.prepare("DELETE FROM drawn_features WHERE layer_key = ?").bind(layerKey),
    ...features.map((feature, index) =>
      env.DB.prepare(
        "INSERT INTO drawn_features (id, layer_key, geometry, properties, updated_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        String(feature.id ?? `${layerKey}-${index}`),
        layerKey,
        JSON.stringify(feature.geometry),
        JSON.stringify(feature.properties ?? {}),
        now
      )
    ),
  ];

  await env.DB.batch(statements);
  return Response.json({ ok: true, count: features.length });
}

export async function onRequestDelete({ env, params }) {
  const { layerKey } = params;
  if (!ALLOWED_LAYER_KEYS.has(layerKey)) return badRequest(`unknown layer: ${layerKey}`);

  await env.DB.prepare("DELETE FROM drawn_features WHERE layer_key = ?").bind(layerKey).run();
  return Response.json({ ok: true });
}
