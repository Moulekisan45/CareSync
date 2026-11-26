const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimit');
const {
  requestMobileOtp,
  verifyMobileOtp,
  registerUser,
  addFamilyMember,
  listFamilyMembers
} = require('../services/registrationService');

const router = express.Router();

const authLimiter = createRateLimiter({ windowMs: 60000, max: 20, keyPrefix: 'auth' });
const otpLimiter = createRateLimiter({ windowMs: 60000, max: 5, keyPrefix: 'otp', message: 'Too many OTP requests. Please wait a minute.' });

// POST /api/auth/otp/request
router.post('/otp/request', otpLimiter, async (req, res) => {
  try {
    const result = await requestMobileOtp({ phone: req.body.phone, purpose: req.body.purpose || 'registration' });
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json({ message: 'OTP sent successfully.', ...result });
  } catch (err) {
    console.error('OTP request error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', otpLimiter, (req, res) => {
  try {
    const result = verifyMobileOtp({ phone: req.body.phone, otp: req.body.otp, purpose: req.body.purpose || 'registration' });
    if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
    res.json({ message: 'OTP verified successfully.', ...result });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register (Public registration is strictly restricted to patient accounts)
router.post('/register', authLimiter, async (req, res) => {
  try {
    const {
      name, email, password, role, phone, date_of_birth, gender,
      preferred_language, otp_code, require_otp, fee_exempt, exemption_reason, deposit_paid
    } = req.body;

    if (role && String(role).toLowerCase() !== 'patient') {
      return res.status(403).json({
        error: 'Public registration is restricted to patient accounts. Privileged accounts must be created by an administrator.'
      });
    }

    const result = await registerUser({
      name,
      email,
      password,
      role: 'patient',
      phone,
      dateOfBirth: date_of_birth || null,
      gender: gender || null,
      preferredLanguage: preferred_language || 'en',
      otpCode: otp_code || null,
      requireOtp: Boolean(require_otp),
      feeExempt: Boolean(fee_exempt),
      exemptionReason: exemption_reason || null,
      depositPaid: Boolean(deposit_paid)
    });

    if (result.error) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }

    res.status(201).json({
      message: 'Registration successful!',
      token: result.token,
      user: result.user
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital_id: user.hospital_id || null
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospital_id: user.hospital_id || null,
        patient_uid: user.patient_uid,
        preferred_language: user.preferred_language
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  const db = getDB();
  const user = db.prepare(`
    SELECT id, name, email, role, hospital_id, phone, patient_uid, phone_verified, preferred_language,
           late_cancellation_count, no_show_count, booking_restricted_until,
           deposit_status, fee_exempt, created_at
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (user.role === 'doctor') {
    user.profile = db.prepare('SELECT * FROM doctor_profiles WHERE user_id = ?').get(user.id);
  }
  if (user.role === 'patient') {
    user.family_members = listFamilyMembers(user.id);
  }

  res.json({ user });
});

// PATCH /api/auth/language
router.patch('/language', authenticateToken, (req, res) => {
  const { language } = req.body;
  if (!['en', 'ta'].includes(language)) {
    return res.status(400).json({ error: "Language must be 'en' or 'ta'." });
  }
  const db = getDB();
  db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(language, req.user.id);
  res.json({ message: 'Preferred language updated.', preferred_language: language });
});

// GET /api/auth/family
router.get('/family', authenticateToken, (req, res) => {
  res.json({ family_members: listFamilyMembers(req.user.id) });
});

// POST /api/auth/family
router.post('/family', authenticateToken, (req, res) => {
  const result = addFamilyMember({
    primaryUserId: req.user.id,
    name: req.body.name,
    relationship: req.body.relationship,
    dateOfBirth: req.body.date_of_birth || null,
    gender: req.body.gender || null,
    phone: req.body.phone || null
  });
  if (result.error) return res.status(result.statusCode || 400).json({ error: result.error });
  res.status(201).json({ message: 'Family member added.', ...result });
});

module.exports = router;
