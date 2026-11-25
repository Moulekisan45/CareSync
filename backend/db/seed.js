const bcrypt = require('bcryptjs');
const { getDB, initializeDatabase } = require('./database');

function seed() {
  initializeDatabase();
  const db = getDB();

  // Clear existing data
  db.exec('DELETE FROM prescriptions');
  db.exec('DELETE FROM appointments');
  db.exec('DELETE FROM doctor_profiles');
  db.exec('DELETE FROM users');

  const hash = bcrypt.hashSync('password123', 10);

  const insertUser = db.prepare(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)'
  );

  // Insert patients
  insertUser.run('Rahul Sharma', 'rahul@email.com', hash, 'patient', '9876543210');
  insertUser.run('Priya Patel', 'priya@email.com', hash, 'patient', '9876543211');
  insertUser.run('Amit Kumar', 'amit@email.com', hash, 'patient', '9876543212');

  // Insert doctors (as users)
  const doc1 = insertUser.run('Dr. Ananya Verma', 'ananya@email.com', hash, 'doctor', '9876543220');
  const doc2 = insertUser.run('Dr. Vikram Singh', 'vikram@email.com', hash, 'doctor', '9876543221');
  const doc3 = insertUser.run('Dr. Meera Iyer', 'meera@email.com', hash, 'doctor', '9876543222');
  const doc4 = insertUser.run('Dr. Rajesh Gupta', 'rajesh@email.com', hash, 'doctor', '9876543223');

  // Insert doctor profiles
  const insertProfile = db.prepare(
    `INSERT INTO doctor_profiles (user_id, specialization, experience_years, consultation_fee, available_days, start_time, end_time, bio)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertProfile.run(doc1.lastInsertRowid, 'Cardiologist', 12, 800, 'Mon,Tue,Wed,Thu,Fri', '09:00', '17:00',
    'Specialist in cardiovascular diseases with 12 years of experience at AIIMS. Expert in ECG interpretation and cardiac risk assessment.');
  insertProfile.run(doc2.lastInsertRowid, 'Dermatologist', 8, 600, 'Mon,Tue,Wed,Fri', '10:00', '16:00',
    'Expert in skin disorders, allergies, acne treatment, and cosmetic dermatology.');
  insertProfile.run(doc3.lastInsertRowid, 'Pediatrician', 15, 700, 'Mon,Tue,Wed,Thu', '09:00', '14:00',
    'Child healthcare specialist with 15 years of experience in neonatal and pediatric care.');
  insertProfile.run(doc4.lastInsertRowid, 'Orthopedic Surgeon', 10, 900, 'Tue,Wed,Thu,Fri', '11:00', '18:00',
    'Bone and joint specialist, sports injury expert with experience in arthroscopic surgery.');

  // Insert sample appointments
  const insertAppt = db.prepare(
    `INSERT INTO appointments (patient_id, doctor_id, appointment_date, time_slot, status, symptoms)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertAppt.run(1, 1, '2026-12-01', '10:00 AM', 'confirmed', 'Chest pain and shortness of breath');
  insertAppt.run(2, 2, '2026-12-01', '11:00 AM', 'confirmed', 'Persistent skin rash on arms');
  insertAppt.run(3, 3, '2026-12-02', '09:30 AM', 'completed', 'Child fever for 3 days');

  // Insert a sample prescription for the completed appointment
  db.prepare(
    `INSERT INTO prescriptions (appointment_id, diagnosis, medicines, notes) VALUES (?, ?, ?, ?)`
  ).run(3, 'Viral Fever', 'Paracetamol 500mg (3x daily), Cetirizine 10mg (1x at night)', 'Ensure adequate hydration. Follow up in 5 days if fever persists.');

  console.log('\n🌱 Database seeded successfully!\n');
  console.log('📋 Test Credentials (password for all: password123):');
  console.log('   Patient:  rahul@email.com');
  console.log('   Patient:  priya@email.com');
  console.log('   Patient:  amit@email.com');
  console.log('   Doctor:   ananya@email.com  (Cardiologist)');
  console.log('   Doctor:   vikram@email.com  (Dermatologist)');
  console.log('   Doctor:   meera@email.com   (Pediatrician)');
  console.log('   Doctor:   rajesh@email.com  (Orthopedic)\n');
}

seed();
