const express = require('express');
const { getDB } = require('../db/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/prescriptions - Create prescription (Doctor only)
router.post('/', authenticateToken, authorizeRole('doctor'), (req, res) => {
  try {
    const { appointment_id, diagnosis, medicines, notes } = req.body;

    if (!appointment_id || !diagnosis || !medicines) {
      return res.status(400).json({ error: 'appointment_id, diagnosis, and medicines are required.' });
    }

    const db = getDB();

    // Verify the appointment belongs to this doctor
    const profile = db.prepare('SELECT id FROM doctor_profiles WHERE user_id = ?').get(req.user.id);
    const appointment = db.prepare(
      'SELECT id FROM appointments WHERE id = ? AND doctor_id = ?'
    ).get(appointment_id, profile.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found or access denied.' });
    }

    // Check if prescription already exists
    const existing = db.prepare('SELECT id FROM prescriptions WHERE appointment_id = ?').get(appointment_id);
    if (existing) {
      return res.status(409).json({ error: 'Prescription already exists for this appointment.' });
    }

    const result = db.prepare(
      'INSERT INTO prescriptions (appointment_id, diagnosis, medicines, notes) VALUES (?, ?, ?, ?)'
    ).run(appointment_id, diagnosis, medicines, notes || null);

    // Auto-mark appointment as completed
    db.prepare("UPDATE appointments SET status = 'completed' WHERE id = ?").run(appointment_id);

    res.status(201).json({
      message: 'Prescription created and appointment marked as completed.',
      prescription: { id: result.lastInsertRowid, appointment_id, diagnosis, medicines, notes }
    });
  } catch (err) {
    console.error('Error creating prescription:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/prescriptions - Get prescriptions for the logged-in user
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    let prescriptions;

    if (req.user.role === 'patient') {
      prescriptions = db.prepare(`
        SELECT p.*, a.appointment_date, a.time_slot, a.symptoms,
               u.name as doctor_name, dp.specialization
        FROM prescriptions p
        JOIN appointments a ON p.appointment_id = a.id
        JOIN doctor_profiles dp ON a.doctor_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE a.patient_id = ?
        ORDER BY p.created_at DESC
      `).all(req.user.id);
    } else if (req.user.role === 'doctor') {
      const profile = db.prepare('SELECT id FROM doctor_profiles WHERE user_id = ?').get(req.user.id);
      prescriptions = db.prepare(`
        SELECT p.*, a.appointment_date, a.time_slot, a.symptoms,
               u.name as patient_name
        FROM prescriptions p
        JOIN appointments a ON p.appointment_id = a.id
        JOIN users u ON a.patient_id = u.id
        WHERE a.doctor_id = ?
        ORDER BY p.created_at DESC
      `).all(profile.id);
    }

    res.json({ prescriptions });
  } catch (err) {
    console.error('Error fetching prescriptions:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
