const express = require('express');
const { getDB } = require('../db/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/doctors - List all doctors with profiles
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { specialization } = req.query;

    let query = `
      SELECT u.id as user_id, u.name, u.email, u.phone,
             dp.id as profile_id, dp.specialization, dp.experience_years,
             dp.consultation_fee, dp.available_days, dp.start_time, dp.end_time, dp.bio
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'doctor'
    `;
    const params = [];

    if (specialization) {
      query += ' AND dp.specialization LIKE ?';
      params.push(`%${specialization}%`);
    }

    query += ' ORDER BY dp.experience_years DESC';

    const doctors = db.prepare(query).all(...params);
    res.json({ doctors });
  } catch (err) {
    console.error('Error fetching doctors:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/doctors/:id - Get specific doctor by profile ID
router.get('/:id', (req, res) => {
  try {
    const db = getDB();
    const doctor = db.prepare(`
      SELECT u.id as user_id, u.name, u.email, u.phone,
             dp.id as profile_id, dp.specialization, dp.experience_years,
             dp.consultation_fee, dp.available_days, dp.start_time, dp.end_time, dp.bio
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE dp.id = ? AND u.role = 'doctor'
    `).get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    res.json({ doctor });
  } catch (err) {
    console.error('Error fetching doctor:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD - Get available time slots
router.get('/:id/slots', (req, res) => {
  try {
    const db = getDB();
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD).' });
    }

    const doctor = db.prepare(`
      SELECT dp.*, u.name
      FROM doctor_profiles dp
      JOIN users u ON dp.user_id = u.id
      WHERE dp.id = ?
    `).get(req.params.id);

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found.' });
    }

    // Check if the requested date falls on an available day
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const requestedDay = dayNames[new Date(date + 'T00:00:00').getDay()];
    const availableDays = doctor.available_days.split(',');

    if (!availableDays.includes(requestedDay)) {
      return res.json({
        doctor_name: doctor.name,
        date,
        available: false,
        message: `Dr. ${doctor.name} is not available on ${requestedDay}s.`,
        slots: []
      });
    }

    // Generate all 30-minute slots between start_time and end_time
    const allSlots = generateTimeSlots(doctor.start_time, doctor.end_time);

    // Get already booked (non-cancelled) slots for this date
    const bookedSlots = db.prepare(`
      SELECT time_slot FROM appointments
      WHERE doctor_id = ? AND appointment_date = ? AND status != 'cancelled'
    `).all(req.params.id, date).map(row => row.time_slot);

    const slots = allSlots.map(slot => ({
      time: slot,
      available: !bookedSlots.includes(slot)
    }));

    res.json({
      doctor_name: doctor.name,
      date,
      available: true,
      slots
    });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Helper: Generate 30-minute time slots between startTime and endTime
function generateTimeSlots(startTime, endTime) {
  const slots = [];
  let [h, m] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  while (h < endH || (h === endH && m < endM)) {
    const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const ampm = h >= 12 ? 'PM' : 'AM';
    slots.push(`${hour12}:${m.toString().padStart(2, '0')} ${ampm}`);

    m += 30;
    if (m >= 60) {
      h += 1;
      m = 0;
    }
  }
  return slots;
}

module.exports = router;
