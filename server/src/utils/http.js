/** Consistent JSON response helpers. Success: { data, meta? }. Errors are produced by errorHandler. */
export const ok = (res, data, meta) => res.status(200).json(meta ? { data, meta } : { data });
export const created = (res, data) => res.status(201).json({ data });
export const noContent = (res) => res.status(204).end();

export function clientIp(req) {
  return (req.ip || req.socket?.remoteAddress || '').slice(0, 64);
}
