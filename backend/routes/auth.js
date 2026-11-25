const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone, specialization, experience_years, consultation_fee, bio } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const db = getDB();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const userRole = role === 'doctor' ? 'doctor' : 'patient';

    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
    ).run(name, email, password_hash, userRole, phone || null);

    // If registering as doctor, create profile
    if (userRole === 'doctor') {
      db.prepare(
        `INSERT INTO doctor_profiles (user_id, specialization, experience_years, consultation_fee, bio)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        result.lastInsertRowid,
        specialization || 'General Physician',
        experience_years || 0,
        consultation_fee || 500,
        bio || ''
      );
    }

    const token = jwt.sign(
      { id: result.lastInsertRowid, name, email, role: userRole },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { id: result.lastInsertRowid, name, email, role: userRole }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  const db = getDB();
  const user = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  if (user.role === 'doctor') {
    const profile = db.prepare('SELECT * FROM doctor_profiles WHERE user_id = ?').get(user.id);
    user.profile = profile;
  }

  res.json({ user });
});

module.exports = router;
