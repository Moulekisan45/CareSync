const { getDB } = require('../db/database');
const { nowIso } = require('../utils/time');

/**
 * Records an immutable audit log entry for sensitive hospital operations.
 * Never stores sensitive patient clinical payloads or plaintext credentials.
 */
function logAudit({ actorUserId = null, actorRole = null, action, entityType, entityId = null, details = null, ipAddress = null }) {
  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO audit_logs (actor_user_id, actor_role, action, entity_type, entity_id, details_json, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      actorUserId,
      actorRole,
      action,
      entityType,
      entityId !== null && entityId !== undefined ? String(entityId) : null,
      details ? JSON.stringify(details) : null,
      ipAddress,
      nowIso()
    );
  } catch (err) {
    console.error('Audit log error:', err.message);
  }
}

module.exports = { logAudit };
