export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Best-effort audit trail for admin actions (service role only).
export async function audit(service, actorId, action, resource, resourceId, details) {
  const { error } = await service.from('audit_log').insert({
    actor_id: actorId,
    action,
    resource,
    resource_id: resourceId == null ? null : String(resourceId),
    details: details ?? null,
  });
  if (error) console.error('[audit] failed to write audit log:', error.message);
}
