const express = require('express');
const { getDB } = require('../db/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();

// POST /api/appointments - Book an appointment (Patient only)
router.post('/', authenticateToken, authorizeRole('patient'), (req, res) => {
  try {
    const { doctor_id, appointment_date, time_slot, symptoms } = req.body;

    if (!doctor_id || !appointment_date || !time_slot) {
      return res.status(400).json({ error: 'doctor_id, appointment_date, and time_slot are required.' });
    }

    const db = getDB();

    // Verify doctor exists
    const doctor = db.prepare('SELECT id FROM doctor_profiles WHERE id = ?').get(doctor_id);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    // ===== CONCURRENCY GUARD: ACID Transaction =====
    // Wraps slot validation + insertion in an IMMEDIATE transaction
    // so that concurrent requests are serialized at the DB level.
    const bookTransaction = db.transaction(() => {
      const existing = db.prepare(`
        SELECT id FROM appointments
        WHERE doctor_id = ? AND appointment_date = ? AND time_slot = ? AND status != 'cancelled'
      `).get(doctor_id, appointment_date, time_slot);

      if (existing) {
        throw new Error('SLOT_TAKEN');
      }

      return db.prepare(`
        INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status, symptoms)
        VALUES (?, ?, ?, ?, 'confirmed', ?)
      `).run(req.user.id, doctor_id, appointment_date, time_slot, symptoms || null);
    });

    try {
      const result = bookTransaction();
      const appointment = db.prepare(`
        SELECT a.*, u.name as doctor_name, dp.specialization, dp.consultation_fee
        FROM appointments a
        JOIN doctor_profiles dp ON a.doctor_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE a.id = ?
      `).get(result.lastInsertRowid);

      res.status(201).json({
        message: 'Appointment booked successfully!',
        appointment
      });
    } catch (txErr) {
      if (txErr.message === 'SLOT_TAKEN') {
        return res.status(409).json({
          error: 'This time slot is already booked. Please choose a different slot.'
        });
      }
      throw txErr;
    }
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'ERR_SQLITE_ERROR' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      return res.status(409).json({
        error: 'This time slot was just booked by another patient. Please choose a different slot.'
      });
    }
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/appointments - Get appointments for the logged-in user
router.get('/', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    let appointments;

    if (req.user.role === 'patient') {
      appointments = db.prepare(`
        SELECT a.*, u.name as doctor_name, dp.specialization, dp.consultation_fee
        FROM appointments a
        JOIN doctor_profiles dp ON a.doctor_id = dp.id
        JOIN users u ON dp.user_id = u.id
        WHERE a.patient_id = ?
        ORDER BY a.appointment_date DESC, a.time_slot DESC
      `).all(req.user.id);
    } else if (req.user.role === 'doctor') {
      const profile = db.prepare('SELECT id FROM doctor_profiles WHERE user_id = ?').get(req.user.id);
      if (!profile) {
        return res.status(404).json({ error: 'Doctor profile not found.' });
      }
      appointments = db.prepare(`
        SELECT a.*, u.name as patient_name, u.phone as patient_phone, u.email as patient_email
        FROM appointments a
        JOIN users u ON a.patient_id = u.id
        WHERE a.doctor_id = ?
        ORDER BY a.appointment_date ASC, a.time_slot ASC
      `).all(profile.id);
    }

    res.json({ appointments });
  } catch (err) {
    console.error('Error fetching appointments:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/appointments/:id/status - Update appointment status (Doctor only)
router.patch('/:id/status', authenticateToken, authorizeRole('doctor'), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const db = getDB();
    const profile = db.prepare('SELECT id FROM doctor_profiles WHERE user_id = ?').get(req.user.id);

    const result = db.prepare(
      'UPDATE appointments SET status = ? WHERE id = ? AND doctor_id = ?'
    ).run(status, req.params.id, profile.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Appointment not found or access denied.' });
    }

    res.json({ message: `Appointment status updated to '${status}'.` });
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/appointments/:id - Cancel appointment (Patient)
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const result = db.prepare(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ? AND patient_id = ? AND status != 'completed'"
    ).run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Appointment not found or cannot be cancelled.' });
    }

    res.json({ message: 'Appointment cancelled successfully.' });
  } catch (err) {
    console.error('Error cancelling appointment:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
