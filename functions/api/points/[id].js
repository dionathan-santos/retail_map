// DELETE /api/points/:id -> remove a single point

export async function onRequestDelete({ params, env }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return Response.json({ error: "invalid id" }, { status: 400 });
  }
  await env.DB.prepare("DELETE FROM points WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}
