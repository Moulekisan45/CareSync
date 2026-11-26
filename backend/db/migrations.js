const { timeStringToMinutes } = require('../utils/time');

function hasColumn(db, tableName, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some((c) => c.name === columnName);
}

function addColumnIfMissing(db, tableName, columnDef) {
  const colName = columnDef.trim().split(/\s+/)[0];
  if (!hasColumn(db, tableName, colName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef}`);
  }
}

const migrations = [
  {
    id: '001_foundation_departments_settings_rbac',
    up(db) {
      // 1. Hospital settings & departments
      db.exec(`
        CREATE TABLE IF NOT EXISTS hospital_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          is_general_medicine INTEGER NOT NULL DEFAULT 0,
          urgent_care_guidance TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_user_id INTEGER,
          actor_role TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          details_json TEXT,
          ip_address TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS otp_verifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL,
          otp_hash TEXT NOT NULL,
          purpose TEXT NOT NULL DEFAULT 'registration',
          expires_at DATETIME NOT NULL,
          verified_at DATETIME,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS family_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          primary_user_id INTEGER NOT NULL,
          patient_uid TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          relationship TEXT NOT NULL,
          date_of_birth TEXT,
          gender TEXT,
          phone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (primary_user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS doctor_breaks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          day_of_week TEXT NOT NULL DEFAULT 'ALL',
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          label TEXT DEFAULT 'Break',
          FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS hospital_holidays (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          holiday_date TEXT NOT NULL,
          title TEXT NOT NULL,
          department_id INTEGER,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS doctor_leaves (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          leave_date TEXT NOT NULL,
          end_date TEXT NOT NULL,
          leave_type TEXT CHECK(leave_type IN ('PLANNED', 'UNEXPECTED')) NOT NULL DEFAULT 'PLANNED',
          reason TEXT,
          status TEXT CHECK(status IN ('ACTIVE', 'CANCELLED')) NOT NULL DEFAULT 'ACTIVE',
          approved_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
        );
      `);

      // 2. Non-destructively upgrade `users` to support 'staff' role and patient protection columns
      if (!hasColumn(db, 'users', 'patient_uid')) {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('BEGIN IMMEDIATE;');
        try {
          db.exec(`
            CREATE TABLE users_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT CHECK(role IN ('patient', 'doctor', 'staff', 'admin')) NOT NULL DEFAULT 'patient',
              phone TEXT,
              patient_uid TEXT UNIQUE,
              phone_verified INTEGER NOT NULL DEFAULT 0,
              preferred_language TEXT CHECK(preferred_language IN ('en', 'ta')) NOT NULL DEFAULT 'en',
              date_of_birth TEXT,
              gender TEXT,
              late_cancellation_count INTEGER NOT NULL DEFAULT 0,
              no_show_count INTEGER NOT NULL DEFAULT 0,
              booking_restricted_until DATETIME,
              restriction_override_by INTEGER,
              restriction_override_reason TEXT,
              deposit_status TEXT CHECK(deposit_status IN ('NONE', 'PAID', 'EXEMPT', 'REFUNDED')) NOT NULL DEFAULT 'NONE',
              fee_exempt INTEGER NOT NULL DEFAULT 0,
              exemption_reason TEXT,
              registered_by_staff_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            INSERT INTO users_new (id, name, email, password_hash, role, phone, created_at)
            SELECT id, name, email, password_hash, role, phone, created_at FROM users;

            DROP TABLE users;
            ALTER TABLE users_new RENAME TO users;
          `);

          // Assign unique patient_uid to existing patients
          const existingPatients = db.prepare("SELECT id FROM users WHERE role = 'patient' AND patient_uid IS NULL").all();
          const year = new Date().getFullYear();
          for (const p of existingPatients) {
            const uid = `CS-${year}-${String(p.id).padStart(5, '0')}`;
            db.prepare('UPDATE users SET patient_uid = ?, phone_verified = 1 WHERE id = ?').run(uid, p.id);
          }

          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        } finally {
          db.exec('PRAGMA foreign_keys = ON;');
        }
      }

      // 3. Extend doctor_profiles non-destructively
      addColumnIfMissing(db, 'doctor_profiles', 'department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL');
      addColumnIfMissing(db, 'doctor_profiles', 'consultation_duration_mins INTEGER NOT NULL DEFAULT 30');
      addColumnIfMissing(db, 'doctor_profiles', 'buffer_mins INTEGER NOT NULL DEFAULT 0');
      addColumnIfMissing(db, 'doctor_profiles', 'is_active INTEGER NOT NULL DEFAULT 1');
      addColumnIfMissing(db, 'doctor_profiles', 'queue_paused INTEGER NOT NULL DEFAULT 0');

      // Seed default General Medicine department if empty so existing flows always have a department
      const deptCount = db.prepare('SELECT COUNT(*) as cnt FROM departments').get().cnt;
      if (deptCount === 0) {
        db.prepare(`
          INSERT INTO departments (code, name, description, is_general_medicine, urgent_care_guidance)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          'GENMED',
          'General Medicine',
          'Primary outpatient care for routine symptoms, fever, infections, and initial triage.',
          1,
          'Seek immediate Emergency / Casualty care for chest pain, severe shortness of breath, sudden weakness/slurred speech, uncontrolled bleeding, or loss of consciousness.'
        );
      }

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone, created_at);
        CREATE INDEX IF NOT EXISTS idx_holidays_date ON hospital_holidays(holiday_date);
        CREATE INDEX IF NOT EXISTS idx_leaves_doctor_date ON doctor_leaves(doctor_id, leave_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
      `);
    }
  },

  {
    id: '002_appointments_lifecycle_waitlist_cancellations',
    up(db) {
      if (!hasColumn(db, 'appointments', 'start_minute')) {
        db.exec('PRAGMA foreign_keys = OFF;');
        db.exec('BEGIN IMMEDIATE;');
        try {
          db.exec(`
            CREATE TABLE appointments_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              patient_id INTEGER NOT NULL,
              doctor_id INTEGER NOT NULL,
              department_id INTEGER,
              family_member_id INTEGER,
              appointment_date TEXT NOT NULL,
              time_slot TEXT NOT NULL,
              duration_mins INTEGER NOT NULL DEFAULT 30,
              start_minute INTEGER NOT NULL DEFAULT 540,
              end_minute INTEGER NOT NULL DEFAULT 570,
              status TEXT CHECK(status IN (
                'pending','confirmed','checked_in','in_consultation','completed','cancelled','no_show','rescheduled'
              )) NOT NULL DEFAULT 'confirmed',
              booking_type TEXT CHECK(booking_type IN (
                'ONLINE','WALK_IN','REFERRAL','EMERGENCY','WAITLIST'
              )) NOT NULL DEFAULT 'ONLINE',
              symptoms TEXT,
              original_appointment_date TEXT,
              original_time_slot TEXT,
              estimated_time_slot TEXT,
              delay_mins INTEGER NOT NULL DEFAULT 0,
              actual_start_at DATETIME,
              actual_end_at DATETIME,
              is_emergency INTEGER NOT NULL DEFAULT 0,
              priority_level INTEGER NOT NULL DEFAULT 0,
              overflow_reschedule_recommended INTEGER NOT NULL DEFAULT 0,
              payment_mode TEXT CHECK(payment_mode IN ('ONLINE','PAY_AT_HOSPITAL','FREE')) NOT NULL DEFAULT 'FREE',
              payment_status TEXT CHECK(payment_status IN (
                'NOT_REQUIRED','PENDING','PAID','FAILED','REFUND_PENDING','REFUNDED','WAIVED'
              )) NOT NULL DEFAULT 'NOT_REQUIRED',
              cancelled_at DATETIME,
              cancel_reason TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (patient_id) REFERENCES users(id),
              FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id),
              FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
              FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL
            );

            INSERT INTO appointments_new (
              id, patient_id, doctor_id, appointment_date, time_slot, status, symptoms,
              original_appointment_date, original_time_slot, estimated_time_slot, created_at
            )
            SELECT
              id, patient_id, doctor_id, appointment_date, time_slot, status, symptoms,
              appointment_date, time_slot, time_slot, created_at
            FROM appointments;

            DROP TABLE appointments;
            ALTER TABLE appointments_new RENAME TO appointments;
          `);

          // Backfill start_minute and end_minute from existing time_slot strings
          const rows = db.prepare('SELECT id, time_slot, duration_mins FROM appointments').all();
          for (const r of rows) {
            const sm = timeStringToMinutes(r.time_slot);
            if (sm !== null) {
              db.prepare('UPDATE appointments SET start_minute = ?, end_minute = ? WHERE id = ?')
                .run(sm, sm + (r.duration_mins || 30), r.id);
            }
          }

          db.exec('COMMIT;');
        } catch (err) {
          db.exec('ROLLBACK;');
          throw err;
        } finally {
          db.exec('PRAGMA foreign_keys = ON;');
        }
      }

      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_active_slot
          ON appointments(doctor_id, appointment_date, time_slot)
          WHERE status NOT IN ('cancelled', 'rescheduled');

        CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date
          ON appointments(doctor_id, appointment_date, status);

        CREATE INDEX IF NOT EXISTS idx_appointments_patient
          ON appointments(patient_id, status);

        CREATE TABLE IF NOT EXISTS appointment_status_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER NOT NULL,
          old_status TEXT,
          new_status TEXT NOT NULL,
          changed_by INTEGER,
          reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS waiting_list (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          doctor_id INTEGER NOT NULL,
          appointment_date TEXT NOT NULL,
          time_slot TEXT NOT NULL,
          patient_id INTEGER NOT NULL,
          family_member_id INTEGER,
          symptoms TEXT,
          status TEXT CHECK(status IN ('WAITING','OFFERED','ACCEPTED','REJECTED','EXPIRED','CANCELLED')) NOT NULL DEFAULT 'WAITING',
          offered_at DATETIME,
          offer_expires_at DATETIME,
          accepted_appointment_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL,
          FOREIGN KEY (accepted_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_waitlist_unique_active_patient
          ON waiting_list(doctor_id, appointment_date, time_slot, patient_id)
          WHERE status IN ('WAITING', 'OFFERED');

        CREATE INDEX IF NOT EXISTS idx_waitlist_slot_fifo
          ON waiting_list(doctor_id, appointment_date, time_slot, status, id);

        CREATE TABLE IF NOT EXISTS cancellation_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER NOT NULL,
          patient_id INTEGER NOT NULL,
          reason TEXT NOT NULL,
          status TEXT CHECK(status IN ('PENDING','APPROVED','REJECTED')) NOT NULL DEFAULT 'PENDING',
          reviewed_by INTEGER,
          review_notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          reviewed_at DATETIME,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
        );
      `);
    }
  },

  {
    id: '003_opd_queue_leave_reschedule',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS opd_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER UNIQUE,
          doctor_id INTEGER NOT NULL,
          department_id INTEGER,
          patient_id INTEGER NOT NULL,
          family_member_id INTEGER,
          queue_date TEXT NOT NULL,
          token_number TEXT NOT NULL,
          token_seq INTEGER NOT NULL,
          source TEXT CHECK(source IN ('ONLINE','WALK_IN','EMERGENCY','REFERRAL')) NOT NULL DEFAULT 'ONLINE',
          priority_score INTEGER NOT NULL DEFAULT 0,
          status TEXT CHECK(status IN ('WAITING','IN_CONSULTATION','COMPLETED','NO_SHOW')) NOT NULL DEFAULT 'WAITING',
          checked_in_at DATETIME,
          grace_expires_at DATETIME,
          called_at DATETIME,
          completed_at DATETIME,
          estimated_wait_mins INTEGER NOT NULL DEFAULT 0,
          staff_override_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
          FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (family_member_id) REFERENCES family_members(id) ON DELETE SET NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_opd_queue_token
          ON opd_queue(doctor_id, queue_date, token_number);

        CREATE INDEX IF NOT EXISTS idx_opd_queue_active
          ON opd_queue(doctor_id, queue_date, status, priority_score DESC, id ASC);

        CREATE TABLE IF NOT EXISTS reschedule_offers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          original_appointment_id INTEGER NOT NULL,
          patient_id INTEGER NOT NULL,
          leave_id INTEGER,
          offer_type TEXT CHECK(offer_type IN ('SAME_DOCTOR_LATER','SUBSTITUTE_DOCTOR','NEXT_WORKING_DAY')) NOT NULL,
          suggested_doctor_id INTEGER NOT NULL,
          suggested_date TEXT NOT NULL,
          suggested_time_slot TEXT NOT NULL,
          status TEXT CHECK(status IN ('PENDING','CONFIRMED','DECLINED','EXPIRED')) NOT NULL DEFAULT 'PENDING',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          responded_at DATETIME,
          FOREIGN KEY (original_appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (leave_id) REFERENCES doctor_leaves(id) ON DELETE SET NULL,
          FOREIGN KEY (suggested_doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS reschedule_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER NOT NULL,
          old_doctor_id INTEGER NOT NULL,
          old_date TEXT NOT NULL,
          old_time_slot TEXT NOT NULL,
          new_doctor_id INTEGER NOT NULL,
          new_date TEXT NOT NULL,
          new_time_slot TEXT NOT NULL,
          reason TEXT,
          confirmed_by_patient INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
        );
      `);
    }
  },

  {
    id: '004_payments_recommendations_referrals_notifications_jobs',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER UNIQUE,
          patient_id INTEGER NOT NULL,
          amount REAL NOT NULL DEFAULT 0,
          currency TEXT NOT NULL DEFAULT 'INR',
          payment_mode TEXT CHECK(payment_mode IN ('ONLINE','PAY_AT_HOSPITAL','FREE')) NOT NULL DEFAULT 'FREE',
          status TEXT CHECK(status IN (
            'NOT_REQUIRED','PENDING','PAID','FAILED','REFUND_PENDING','REFUNDED','WAIVED'
          )) NOT NULL DEFAULT 'NOT_REQUIRED',
          gateway_order_id TEXT UNIQUE,
          gateway_payment_id TEXT,
          receipt_number TEXT UNIQUE,
          refund_amount REAL NOT NULL DEFAULT 0,
          refund_reason TEXT,
          confirmed_by_staff_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (confirmed_by_staff_id) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS payment_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          payment_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          status TEXT NOT NULL,
          gateway_event_id TEXT UNIQUE,
          amount REAL NOT NULL DEFAULT 0,
          payload_json TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS doctor_recommendations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          appointment_id INTEGER UNIQUE NOT NULL,
          doctor_id INTEGER NOT NULL,
          patient_id INTEGER NOT NULL,
          pre_consultation_instructions TEXT,
          required_reports TEXT,
          preparation_notes TEXT,
          referral_department_id INTEGER,
          referral_notes TEXT,
          follow_up_days INTEGER,
          follow_up_notes TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
          FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referral_department_id) REFERENCES departments(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS doctor_recommendation_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          recommendation_id INTEGER NOT NULL,
          appointment_id INTEGER NOT NULL,
          doctor_id INTEGER NOT NULL,
          version INTEGER NOT NULL,
          snapshot_json TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (recommendation_id) REFERENCES doctor_recommendations(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS referrals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_doctor_id INTEGER NOT NULL,
          to_department_id INTEGER NOT NULL,
          to_doctor_id INTEGER,
          patient_id INTEGER NOT NULL,
          source_appointment_id INTEGER,
          notes TEXT NOT NULL,
          priority TEXT CHECK(priority IN ('ROUTINE','PRIORITY')) NOT NULL DEFAULT 'ROUTINE',
          status TEXT CHECK(status IN ('OPEN','BOOKED','COMPLETED','CANCELLED')) NOT NULL DEFAULT 'OPEN',
          booked_appointment_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE CASCADE,
          FOREIGN KEY (to_doctor_id) REFERENCES doctor_profiles(id) ON DELETE SET NULL,
          FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (source_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
          FOREIGN KEY (booked_appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          language TEXT CHECK(language IN ('en','ta')) NOT NULL DEFAULT 'en',
          channel TEXT CHECK(channel IN ('IN_APP','SMS','EMAIL')) NOT NULL DEFAULT 'IN_APP',
          reference_type TEXT,
          reference_id TEXT,
          dedupe_key TEXT UNIQUE,
          is_read INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

        CREATE TABLE IF NOT EXISTS background_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          run_at DATETIME NOT NULL,
          status TEXT CHECK(status IN ('PENDING','PROCESSING','COMPLETED','FAILED')) NOT NULL DEFAULT 'PENDING',
          attempts INTEGER NOT NULL DEFAULT 0,
          max_attempts INTEGER NOT NULL DEFAULT 3,
          last_error TEXT,
          dedupe_key TEXT UNIQUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_due ON background_jobs(status, run_at);
      `);
    }
  },

  {
    id: '005_hospitals_departments_capacity_rbac',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS hospitals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT CHECK(type IN ('DISTRICT_HOSPITAL', 'MEDICAL_COLLEGE')) NOT NULL DEFAULT 'DISTRICT_HOSPITAL',
          address TEXT NOT NULL,
          contact_phone TEXT,
          contact_email TEXT,
          open_time TEXT NOT NULL DEFAULT '08:00',
          close_time TEXT NOT NULL DEFAULT '17:00',
          operating_days TEXT NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS hospital_departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hospital_id INTEGER NOT NULL,
          department_id INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
          UNIQUE(hospital_id, department_id)
        );
      `);

      addColumnIfMissing(db, 'users', 'hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL');
      addColumnIfMissing(db, 'doctor_profiles', 'hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL');
      addColumnIfMissing(db, 'doctor_profiles', 'online_quota INTEGER');
      addColumnIfMissing(db, 'doctor_profiles', 'walkin_quota INTEGER');
      addColumnIfMissing(db, 'doctor_profiles', 'referral_quota INTEGER');
      addColumnIfMissing(db, 'appointments', 'hospital_id INTEGER REFERENCES hospitals(id) ON DELETE SET NULL');
      addColumnIfMissing(db, 'hospital_holidays', 'hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE');

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_hospitals_active ON hospitals(is_active, type);
        CREATE INDEX IF NOT EXISTS idx_hospital_depts ON hospital_departments(hospital_id, department_id, is_active);
        CREATE INDEX IF NOT EXISTS idx_users_hospital ON users(hospital_id, role);
        CREATE INDEX IF NOT EXISTS idx_doctor_profiles_hosp_dept ON doctor_profiles(hospital_id, department_id, is_active);
        CREATE INDEX IF NOT EXISTS idx_appointments_hosp_date ON appointments(hospital_id, appointment_date, status);
        CREATE INDEX IF NOT EXISTS idx_appointments_doc_date_type ON appointments(doctor_id, appointment_date, booking_type, status);
      `);

      // Non-destructive backfill for existing single-hospital databases
      const hospCount = db.prepare('SELECT COUNT(*) as cnt FROM hospitals').get().cnt;
      if (hospCount === 0) {
        const defaultHospId = db.prepare(`
          INSERT INTO hospitals (code, name, type, address, contact_phone, contact_email, open_time, close_time, operating_days, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
          'DGH-01',
          'CareSync District Government Hospital',
          'DISTRICT_HOSPITAL',
          'Government Hospital Road, Chennai - 600001',
          '044-25305000',
          'dgh@tnhealth.gov.in',
          '08:00',
          '17:00',
          'Mon,Tue,Wed,Thu,Fri,Sat'
        ).lastInsertRowid;

        db.prepare('UPDATE doctor_profiles SET hospital_id = ? WHERE hospital_id IS NULL').run(defaultHospId);
        db.prepare('UPDATE appointments SET hospital_id = ? WHERE hospital_id IS NULL').run(defaultHospId);
        db.prepare("UPDATE users SET hospital_id = ? WHERE role = 'staff' AND hospital_id IS NULL").run(defaultHospId);

        const existingDepts = db.prepare('SELECT id FROM departments').all();
        const insHD = db.prepare('INSERT OR IGNORE INTO hospital_departments (hospital_id, department_id, is_active) VALUES (?, ?, 1)');
        for (const d of existingDepts) {
          insHD.run(defaultHospId, d.id);
        }
      }
    }
  }
];

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all();
  const applied = new Set(appliedRows.map((r) => r.id));

  for (const migration of migrations) {
    if (!applied.has(migration.id)) {
      migration.up(db);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id);
    }
  }
}

module.exports = { runMigrations };
