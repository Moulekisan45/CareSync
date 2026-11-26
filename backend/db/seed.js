const bcrypt = require('bcryptjs');
const { getDB, initializeDatabase } = require('./database');
const { DEFAULT_SETTINGS } = require('../config/hospital');

function seed() {
  initializeDatabase();
  const db = getDB();

  // Clear existing data in foreign-key safe order
  db.exec(`
    DELETE FROM background_jobs;
    DELETE FROM notifications;
    DELETE FROM payment_transactions;
    DELETE FROM payments;
    DELETE FROM doctor_recommendation_history;
    DELETE FROM doctor_recommendations;
    DELETE FROM referrals;
    DELETE FROM reschedule_history;
    DELETE FROM reschedule_offers;
    DELETE FROM opd_queue;
    DELETE FROM cancellation_requests;
    DELETE FROM waiting_list;
    DELETE FROM appointment_status_history;
    DELETE FROM prescriptions;
    DELETE FROM appointments;
    DELETE FROM doctor_breaks;
    DELETE FROM doctor_leaves;
    DELETE FROM hospital_holidays;
    DELETE FROM family_members;
    DELETE FROM otp_verifications;
    DELETE FROM audit_logs;
    DELETE FROM doctor_profiles;
    DELETE FROM hospital_departments;
    DELETE FROM departments;
    DELETE FROM users;
    DELETE FROM hospitals;
    DELETE FROM hospital_settings;
  `);

  // Settings
  const insertSetting = db.prepare('INSERT INTO hospital_settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(k, v);
  }

  // Government Hospitals
  const insertHospital = db.prepare(`
    INSERT INTO hospitals (code, name, type, address, contact_phone, contact_email, open_time, close_time, operating_days, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const hDgh = insertHospital.run(
    'DGH-01',
    'District Government Hospital, Tambaram',
    'DISTRICT_HOSPITAL',
    'GST Road, Tambaram, Chennai - 600045',
    '044-22260100',
    'dgh.tambaram@tnhealth.gov.in',
    '08:00',
    '17:00',
    'Mon,Tue,Wed,Thu,Fri,Sat'
  ).lastInsertRowid;

  const hGmc = insertHospital.run(
    'GMC-01',
    'Government Medical College Hospital, Chengalpattu',
    'MEDICAL_COLLEGE',
    'Grand Southern Trunk Rd, Chengalpattu - 603001',
    '044-27428300',
    'gmc.chengalpattu@tnhealth.gov.in',
    '08:00',
    '18:00',
    'Mon,Tue,Wed,Thu,Fri,Sat'
  ).lastInsertRowid;

  // Master Departments
  const insertDept = db.prepare(`
    INSERT INTO departments (code, name, description, is_general_medicine, urgent_care_guidance)
    VALUES (?, ?, ?, ?, ?)
  `);
  const dGenMed = insertDept.run('GENMED', 'General Medicine', 'Primary outpatient department for routine consultations, fevers, and initial triage.', 1,
    'Seek immediate Emergency / Casualty care for chest pain, severe breathing difficulty, sudden weakness, or heavy bleeding.').lastInsertRowid;
  const dPeds = insertDept.run('PEDS', 'Paediatrics', 'Child and neonatal healthcare.', 0, null).lastInsertRowid;
  const dGyn = insertDept.run('GYN', 'Gynaecology', 'Maternal, obstetric, and women healthcare.', 0, null).lastInsertRowid;
  const dCardio = insertDept.run('CARD', 'Cardiology', 'Heart and vascular care.', 0, null).lastInsertRowid;
  const dOrtho = insertDept.run('ORTHO', 'Orthopaedics', 'Bone, joint, and trauma care.', 0, null).lastInsertRowid;
  const dNeuro = insertDept.run('NEURO', 'Neurology', 'Brain, spine, and nervous system care.', 0, null).lastInsertRowid;
  const dDerm = insertDept.run('DERM', 'Dermatology', 'Skin, hair, and allergy care.', 0, null).lastInsertRowid;
  const dEnt = insertDept.run('ENT', 'ENT', 'Ear, nose, and throat specialist care.', 0, null).lastInsertRowid;
  const dOphth = insertDept.run('OPHTH', 'Ophthalmology', 'Eye care and vision services.', 0, null).lastInsertRowid;

  // Associate departments with hospitals (not every hospital has every specialist)
  const insertHospDept = db.prepare('INSERT INTO hospital_departments (hospital_id, department_id, is_active) VALUES (?, ?, 1)');
  [dGenMed, dPeds, dGyn, dDerm, dOrtho].forEach((dId) => insertHospDept.run(hDgh, dId));
  [dGenMed, dPeds, dGyn, dCardio, dOrtho, dNeuro, dEnt, dOphth].forEach((dId) => insertHospDept.run(hGmc, dId));

  const hash = bcrypt.hashSync('password123', 10);
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone, patient_uid, phone_verified, preferred_language, fee_exempt, exemption_reason, hospital_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Patients
  const p1 = insertUser.run('Rahul Sharma', 'rahul@email.com', hash, 'patient', '9876543210', 'CS-2026-00001', 1, 'en', 0, null, null).lastInsertRowid;
  const p2 = insertUser.run('Priya Patel', 'priya@email.com', hash, 'patient', '9876543211', 'CS-2026-00002', 1, 'ta', 0, null, null).lastInsertRowid;
  const p3 = insertUser.run('Amit Kumar', 'amit@email.com', hash, 'patient', '9876543212', 'CS-2026-00003', 1, 'en', 1, 'BPL Ration Card Holder', null).lastInsertRowid;

  // Family member for Rahul sharing his phone number
  db.prepare(`
    INSERT INTO family_members (primary_user_id, patient_uid, name, relationship, date_of_birth, gender, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(p1, 'CSF-2026-00001', 'Meena Sharma', 'Mother', '1960-05-12', 'Female', '9876543210');

  // Doctors
  const uDoc1 = insertUser.run('Dr. Ananya Verma', 'ananya@email.com', hash, 'doctor', '9876543220', null, 1, 'en', 0, null, hGmc).lastInsertRowid;
  const uDoc2 = insertUser.run('Dr. Vikram Singh', 'vikram@email.com', hash, 'doctor', '9876543221', null, 1, 'en', 0, null, hDgh).lastInsertRowid;
  const uDoc3 = insertUser.run('Dr. Meera Iyer', 'meera@email.com', hash, 'doctor', '9876543222', null, 1, 'ta', 0, null, hDgh).lastInsertRowid;
  const uDoc4 = insertUser.run('Dr. Rajesh Gupta', 'rajesh@email.com', hash, 'doctor', '9876543223', null, 1, 'en', 0, null, hGmc).lastInsertRowid;
  const uDoc5 = insertUser.run('Dr. Kavitha Rajan', 'kavitha@email.com', hash, 'doctor', '9876543224', null, 1, 'ta', 0, null, hDgh).lastInsertRowid;
  const uDoc6 = insertUser.run('Dr. Suresh Babu', 'suresh@email.com', hash, 'doctor', '9876543225', null, 1, 'en', 0, null, hDgh).lastInsertRowid;

  // Hospital Staff & Admin
  insertUser.run('DGH Front Desk Staff', 'staff@hospital.gov.in', hash, 'staff', '9876543230', null, 1, 'en', 0, null, hDgh);
  insertUser.run('GMC Front Desk Staff', 'staff.gmc@hospital.gov.in', hash, 'staff', '9876543232', null, 1, 'en', 0, null, hGmc);
  insertUser.run('Medical Superintendent', 'admin@hospital.gov.in', hash, 'admin', '9876543231', null, 1, 'en', 0, null, null);

  const insertProfile = db.prepare(`
    INSERT INTO doctor_profiles (
      user_id, hospital_id, department_id, specialization, experience_years, consultation_fee,
      available_days, start_time, end_time, consultation_duration_mins,
      online_quota, walkin_quota, referral_quota, bio
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // GMC Cardiology: 09:00-17:00 (480m) - 60m lunch = 420m / 30m = 14 slots (8 online, 4 walkin, 2 referral)
  const doc1 = insertProfile.run(uDoc1, hGmc, dCardio, 'Cardiologist', 12, 100, 'Mon,Tue,Wed,Thu,Fri', '09:00', '17:00', 30, 8, 4, 2,
    'Senior Cardiologist specializing in ECG evaluation and hypertension management.').lastInsertRowid;
  // DGH Dermatology: 10:00-16:00 (360m) - 60m lunch = 300m / 30m = 10 slots (5 online, 3 walkin, 2 referral)
  const doc2 = insertProfile.run(uDoc2, hDgh, dDerm, 'Dermatologist', 8, 50, 'Mon,Tue,Wed,Fri', '10:00', '16:00', 30, 5, 3, 2,
    'Expert in clinical dermatology and allergy treatment.').lastInsertRowid;
  // DGH Paediatrics: 09:00-14:00 (300m) / 30m = 10 slots (6 online, 3 walkin, 1 referral)
  const doc3 = insertProfile.run(uDoc3, hDgh, dPeds, 'Paediatrician', 15, 0, 'Mon,Tue,Wed,Thu,Fri', '09:00', '14:00', 30, 6, 3, 1,
    'Child healthcare and immunization specialist.').lastInsertRowid;
  // GMC Orthopaedics: 11:00-18:00 (420m) - 60m lunch = 360m / 30m = 12 slots (6 online, 4 walkin, 2 referral)
  const doc4 = insertProfile.run(uDoc4, hGmc, dOrtho, 'Orthopaedic Surgeon', 10, 100, 'Tue,Wed,Thu,Fri', '11:00', '18:00', 30, 6, 4, 2,
    'Bone, joint, and trauma specialist.').lastInsertRowid;
  // DGH General Medicine 1: 09:00-17:00 (480m) - 60m lunch = 420m / 20m = 21 slots (10 online, 8 walkin, 3 referral)
  const doc5 = insertProfile.run(uDoc5, hDgh, dGenMed, 'General Medicine', 11, 0, 'Mon,Tue,Wed,Thu,Fri,Sat', '09:00', '17:00', 20, 10, 8, 3,
    'Primary outpatient physician for general medicine triage and chronic care.').lastInsertRowid;
  // DGH General Medicine 2: 09:00-17:00 (480m) - 60m lunch = 420m / 20m = 21 slots (12 online, 6 walkin, 3 referral)
  const doc6 = insertProfile.run(uDoc6, hDgh, dGenMed, 'General Medicine', 7, 0, 'Mon,Tue,Wed,Thu,Fri,Sat', '09:00', '17:00', 20, 12, 6, 3,
    'General physician handling routine OPD consultations and fever clinic.').lastInsertRowid;

  // Standard 1:00 PM - 2:00 PM lunch break for doctors
  const insertBreak = db.prepare('INSERT INTO doctor_breaks (doctor_id, day_of_week, start_time, end_time, label) VALUES (?, ?, ?, ?, ?)');
  [doc1, doc2, doc4, doc5, doc6].forEach((dId) => insertBreak.run(dId, 'ALL', '13:00', '14:00', 'Lunch Break'));

  // Sample appointments
  const insertAppt = db.prepare(`
    INSERT INTO appointments (
      patient_id, doctor_id, hospital_id, department_id, appointment_date, time_slot, duration_mins,
      start_minute, end_minute, status, booking_type, symptoms,
      original_appointment_date, original_time_slot, estimated_time_slot, payment_mode, payment_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ONLINE', ?, ?, ?, ?, ?, ?)
  `);

  const a1 = insertAppt.run(p1, doc1, hGmc, dCardio, '2026-12-01', '10:00 AM', 30, 600, 630, 'confirmed', 'Routine BP checkup', '2026-12-01', '10:00 AM', '10:00 AM', 'PAY_AT_HOSPITAL', 'PENDING').lastInsertRowid;
  const a2 = insertAppt.run(p2, doc2, hDgh, dDerm, '2026-12-01', '11:00 AM', 30, 660, 690, 'confirmed', 'Skin rash', '2026-12-01', '11:00 AM', '11:00 AM', 'FREE', 'NOT_REQUIRED').lastInsertRowid;
  const a3 = insertAppt.run(p3, doc3, hDgh, dPeds, '2026-12-02', '9:30 AM', 30, 570, 600, 'completed', 'Paediatric fever', '2026-12-02', '9:30 AM', '9:30 AM', 'FREE', 'WAIVED').lastInsertRowid;

  db.prepare(`INSERT INTO prescriptions (appointment_id, diagnosis, medicines, notes) VALUES (?, ?, ?, ?)`)
    .run(a3, 'Viral Fever', 'Paracetamol 500mg', 'Adequate hydration and rest.');

  db.prepare(`INSERT INTO payments (appointment_id, patient_id, amount, payment_mode, status) VALUES (?, ?, 100, 'PAY_AT_HOSPITAL', 'PENDING')`).run(a1, p1);
  db.prepare(`INSERT INTO payments (appointment_id, patient_id, amount, payment_mode, status) VALUES (?, ?, 0, 'FREE', 'NOT_REQUIRED')`).run(a2, p2);
  db.prepare(`INSERT INTO payments (appointment_id, patient_id, amount, payment_mode, status) VALUES (?, ?, 0, 'FREE', 'WAIVED')`).run(a3, p3);

  console.log('\n🌱 Government Hospital Database seeded successfully!');
  console.log('   Hospitals: DGH-01 (Tambaram), GMC-01 (Chengalpattu)');
  console.log('   Patient:   rahul@email.com / password123');
  console.log('   Patient:   priya@email.com / password123 (Tamil)');
  console.log('   Doctor:    ananya@email.com / password123 (GMC Cardiology)');
  console.log('   Doctor:    kavitha@email.com / password123 (DGH General Medicine)');
  console.log('   Staff DGH: staff@hospital.gov.in / password123');
  console.log('   Staff GMC: staff.gmc@hospital.gov.in / password123');
  console.log('   Admin:     admin@hospital.gov.in / password123\n');
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
