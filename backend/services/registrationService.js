const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../db/database');
const { getNumericSetting, getBooleanSetting } = require('../config/hospital');
const { getOtpProvider, generateOtpCode, hashOtp, maskPhone } = require('../providers/otpProvider');
const { JWT_SECRET } = require('../middleware/auth');
const { logAudit } = require('./auditService');
const { nowIso, addMinutesIso } = require('../utils/time');

function generatePatientUid(id, prefix = 'CS') {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`;
}

async function requestMobileOtp({ phone, purpose = 'registration' }) {
  if (!phone || !/^\d{10,15}$/.test(String(phone).trim())) {
    return { error: 'Valid 10-15 digit phone number is required.', statusCode: 400 };
  }

  const db = getDB();
  const cleanPhone = String(phone).trim();
  const expiryMins = getNumericSetting('otp_expiry_minutes') || 5;
  const code = generateOtpCode();
  const otpHash = hashOtp(code);
  const expiresAt = addMinutesIso(nowIso(), expiryMins);

  const res = db.prepare(`
    INSERT INTO otp_verifications (phone, otp_hash, purpose, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(cleanPhone, otpHash, purpose, expiresAt, nowIso());

  const providerResult = await getOtpProvider().sendOtp(maskPhone(cleanPhone), code, purpose);

  return {
    verification_id: Number(res.lastInsertRowid),
    masked_phone: maskPhone(cleanPhone),
    expires_at: expiresAt,
    ...(providerResult.dev_otp ? { dev_otp: providerResult.dev_otp } : {})
  };
}

function verifyMobileOtp({ phone, otp, purpose = 'registration' }) {
  if (!phone || !otp) {
    return { error: 'Phone and OTP are required.', statusCode: 400 };
  }

  const db = getDB();
  const cleanPhone = String(phone).trim();
  const row = db.prepare(`
    SELECT * FROM otp_verifications
    WHERE phone = ? AND purpose = ? AND verified_at IS NULL
    ORDER BY id DESC LIMIT 1
  `).get(cleanPhone, purpose);

  if (!row) return { error: 'No active OTP found for this phone number.', statusCode: 404 };
  if (row.expires_at <= nowIso()) return { error: 'OTP has expired. Please request a new one.', statusCode: 400 };
  if (row.attempts >= 5) return { error: 'Maximum OTP attempts exceeded.', statusCode: 429 };

  db.prepare('UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = ?').run(row.id);

  if (hashOtp(otp) !== row.otp_hash) {
    return { error: 'Invalid OTP code.', statusCode: 400 };
  }

  db.prepare('UPDATE otp_verifications SET verified_at = ? WHERE id = ?').run(nowIso(), row.id);
  return { verified: true, verification_id: row.id };
}

/**
 * Registers a patient, doctor, or staff-assisted patient.
 * Explicitly allows multiple patients/family members sharing a phone number,
 * while catching duplicate (email) or exact duplicate (name + phone + DOB).
 */
async function registerUser({
  name,
  email,
  password,
  role = 'patient',
  hospitalId = null,
  allowPrivileged = false,
  phone = null,
  dateOfBirth = null,
  gender = null,
  preferredLanguage = 'en',
  otpCode = null,
  requireOtp = false,
  feeExempt = false,
  exemptionReason = null,
  depositPaid = false,
  registeredByStaffId = null,
  doctorProfile = null
}) {
  if (!name || !email || !password) {
    return { error: 'Name, email, and password are required.', statusCode: 400 };
  }
  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters.', statusCode: 400 };
  }

  const db = getDB();
  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingEmail) {
    return { error: 'An account with this email already exists.', statusCode: 409 };
  }

  // Exact duplicate patient check (same name + phone + DOB) — allows family sharing phone!
  if (phone && dateOfBirth) {
    const dupPerson = db.prepare(`
      SELECT id FROM users
      WHERE LOWER(name) = LOWER(?) AND phone = ? AND date_of_birth = ?
    `).get(name.trim(), String(phone).trim(), dateOfBirth);
    if (dupPerson) {
      return {
        error: 'Duplicate registration detected for the same patient name, phone, and date of birth.',
        statusCode: 409
      };
    }
  }

  let phoneVerified = 0;
  if (requireOtp) {
    if (!phone || !otpCode) {
      return { error: 'Mobile phone and OTP verification are required.', statusCode: 400 };
    }
    const otpRes = verifyMobileOtp({ phone, otp: otpCode, purpose: 'registration' });
    if (otpRes.error) return otpRes;
    phoneVerified = 1;
  } else if (otpCode && phone) {
    const otpRes = verifyMobileOtp({ phone, otp: otpCode, purpose: 'registration' });
    if (otpRes.error) return otpRes;
    phoneVerified = 1;
  } else if (registeredByStaffId) {
    phoneVerified = phone ? 1 : 0;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const validPrivilegedRoles = ['patient', 'doctor', 'staff', 'admin'];
  const allowedRole = allowPrivileged && validPrivilegedRoles.includes(role) ? role : 'patient';
  const effectiveHospitalId = hospitalId || doctorProfile?.hospital_id || null;

  let depositStatus = 'NONE';
  if (allowedRole === 'patient') {
    const depositEnabled = getBooleanSetting('registration_deposit_enabled');
    if (feeExempt) depositStatus = 'EXEMPT';
    else if (depositEnabled && depositPaid) depositStatus = 'PAID';
  }

  const tx = db.transaction(() => {
    const res = db.prepare(`
      INSERT INTO users (
        name, email, password_hash, role, hospital_id, phone, phone_verified, preferred_language,
        date_of_birth, gender, deposit_status, fee_exempt, exemption_reason, registered_by_staff_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      email.trim().toLowerCase(),
      passwordHash,
      allowedRole,
      effectiveHospitalId,
      phone ? String(phone).trim() : null,
      phoneVerified,
      preferredLanguage === 'ta' ? 'ta' : 'en',
      dateOfBirth,
      gender,
      depositStatus,
      feeExempt ? 1 : 0,
      exemptionReason,
      registeredByStaffId,
      nowIso()
    );

    const userId = Number(res.lastInsertRowid);
    let patientUid = null;
    if (allowedRole === 'patient') {
      patientUid = generatePatientUid(userId, 'CS');
      db.prepare('UPDATE users SET patient_uid = ? WHERE id = ?').run(patientUid, userId);
    }

    if (allowedRole === 'doctor' && doctorProfile) {
      db.prepare(`
        INSERT INTO doctor_profiles (
          user_id, hospital_id, department_id, specialization, experience_years, consultation_fee,
          available_days, start_time, end_time, consultation_duration_mins,
          online_quota, walkin_quota, referral_quota, bio
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        effectiveHospitalId,
        doctorProfile.department_id || null,
        doctorProfile.specialization || 'General Physician',
        doctorProfile.experience_years || 0,
        doctorProfile.consultation_fee ?? 0,
        doctorProfile.available_days || 'Mon,Tue,Wed,Thu,Fri',
        doctorProfile.start_time || '09:00',
        doctorProfile.end_time || '17:00',
        doctorProfile.consultation_duration_mins || 30,
        doctorProfile.online_quota ?? null,
        doctorProfile.walkin_quota ?? null,
        doctorProfile.referral_quota ?? null,
        doctorProfile.bio || ''
      );
    }

    return { userId, patientUid };
  });

  const { userId, patientUid } = tx();

  if (registeredByStaffId) {
    logAudit({
      actorUserId: registeredByStaffId,
      actorRole: 'staff',
      action: 'STAFF_ASSISTED_PATIENT_REGISTRATION',
      entityType: 'user',
      entityId: userId,
      details: { patientUid, feeExempt }
    });
  }

  const token = jwt.sign(
    {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: allowedRole,
      hospital_id: effectiveHospitalId
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    token,
    user: {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: allowedRole,
      hospital_id: effectiveHospitalId,
      patient_uid: patientUid,
      phone_verified: Boolean(phoneVerified),
      deposit_status: depositStatus,
      fee_exempt: Boolean(feeExempt)
    }
  };
}

function addFamilyMember({ primaryUserId, name, relationship, dateOfBirth = null, gender = null, phone = null }) {
  if (!name || !relationship) {
    return { error: 'Dependent name and relationship are required.', statusCode: 400 };
  }
  const db = getDB();
  const primary = db.prepare('SELECT id, phone FROM users WHERE id = ?').get(primaryUserId);
  if (!primary) return { error: 'Primary user not found.', statusCode: 404 };

  const sharedPhone = phone || primary.phone || null;
  if (sharedPhone && dateOfBirth) {
    const dup = db.prepare(`
      SELECT id FROM family_members
      WHERE primary_user_id = ? AND LOWER(name) = LOWER(?) AND date_of_birth = ?
    `).get(primaryUserId, name.trim(), dateOfBirth);
    if (dup) {
      return { error: 'This family member profile already exists.', statusCode: 409 };
    }
  }

  const tempUid = `CSF-TMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const res = db.prepare(`
    INSERT INTO family_members (primary_user_id, patient_uid, name, relationship, date_of_birth, gender, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(primaryUserId, tempUid, name.trim(), relationship.trim(), dateOfBirth, gender, sharedPhone, nowIso());

  const id = Number(res.lastInsertRowid);
  const uid = generatePatientUid(id, 'CSF');
  db.prepare('UPDATE family_members SET patient_uid = ? WHERE id = ?').run(uid, id);

  return { member: db.prepare('SELECT * FROM family_members WHERE id = ?').get(id) };
}

function listFamilyMembers(primaryUserId) {
  const db = getDB();
  return db.prepare('SELECT * FROM family_members WHERE primary_user_id = ? ORDER BY id ASC').all(primaryUserId);
}

module.exports = {
  requestMobileOtp,
  verifyMobileOtp,
  registerUser,
  addFamilyMember,
  listFamilyMembers
};
