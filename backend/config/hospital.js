const { getDB } = require('../db/database');

const DEFAULT_SETTINGS = {
  hospital_name: 'CareSync Government General Hospital',
  timezone: process.env.HOSPITAL_TIMEZONE || 'Asia/Kolkata',
  default_consultation_duration_mins: '30',
  waitlist_offer_minutes: '10',
  cancellation_cutoff_hours: '24',
  max_active_bookings_per_patient: '3',
  late_cancel_threshold: '3',
  no_show_threshold: '3',
  restriction_days: '14',
  opd_grace_period_mins: '15',
  significant_delay_threshold_mins: '15',
  registration_deposit_enabled: 'false',
  registration_deposit_amount: '50',
  otp_expiry_minutes: '5',
  refund_full_cutoff_hours: '24',
  refund_late_cancel_percent: '0'
};

function getSetting(key) {
  const db = getDB();
  try {
    const row = db.prepare('SELECT value FROM hospital_settings WHERE key = ?').get(key);
    if (row) return row.value;
  } catch (_) {
    // Table might not exist yet during early bootstrap
  }
  return DEFAULT_SETTINGS[key] ?? null;
}

function getNumericSetting(key) {
  const val = getSetting(key);
  const parsed = Number(val);
  return Number.isNaN(parsed) ? Number(DEFAULT_SETTINGS[key] || 0) : parsed;
}

function getBooleanSetting(key) {
  return String(getSetting(key)).toLowerCase() === 'true';
}

function getAllSettings() {
  const db = getDB();
  const merged = { ...DEFAULT_SETTINGS };
  const rows = db.prepare('SELECT key, value FROM hospital_settings').all();
  for (const r of rows) {
    merged[r.key] = r.value;
  }
  return merged;
}

function updateSetting(key, value) {
  const db = getDB();
  db.prepare(`
    INSERT INTO hospital_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
  `).run(key, String(value));
}

module.exports = {
  DEFAULT_SETTINGS,
  getSetting,
  getNumericSetting,
  getBooleanSetting,
  getAllSettings,
  updateSetting
};
