# CareSync — Smart Clinical Appointment Booking Platform

A full-stack web application for seamless doctor-patient interaction — browse specialists, book appointments with real-time slot availability, and manage digital prescriptions.

Built with **React**, **Node.js/Express**, **SQLite**, **JWT Authentication**, and **Tailwind CSS**.

---

## 📌 Core Computer Science Concepts Demonstrated

| Subject | Concepts Implemented |
| :--- | :--- |
| **Database Management (DBMS)** | Relational schema design (4 normalized tables), Foreign keys, ACID transactions, Composite unique constraints, Parameterized queries (SQL injection prevention). |
| **Computer Networks (CN)** | RESTful API architecture, HTTP methods (GET, POST, PATCH, DELETE), Status codes (200, 201, 400, 401, 403, 409, 500), Stateless JWT authentication. |
| **Operating Systems (OS)** | Concurrency control — double-booking prevention via database-level locking and atomic transactions. |
| **Object-Oriented Design (OOP)** | Separation of concerns (Routes, Middleware, Database layer), Factory pattern for token generation, Role-based polymorphic API responses. |

---

## 🏗️ System Architecture

```
┌───────────────────────────────────────────────────────────┐
│              CareSync Frontend (React + Vite)             │
│   Landing Page │ Patient Portal │ Doctor Clinical Queue   │
│   Auth Context │ Axios API Layer │ Tailwind CSS           │
└──────────────────────────┬────────────────────────────────┘
                           │  REST API (JSON over HTTP)
                           │  Authorization: Bearer <JWT>
                           ▼
┌───────────────────────────────────────────────────────────┐
│               CareSync Backend (Express.js)               │
│   ├─ POST /api/auth/register    (bcrypt password hashing) │
│   ├─ POST /api/auth/login       (JWT token issuance)      │
│   ├─ GET  /api/doctors          (search & filter)         │
│   ├─ GET  /api/doctors/:id/slots (dynamic 30-min slots)   │
│   ├─ POST /api/appointments     (ACID booking engine)     │
│   ├─ PATCH /api/appointments/:id/status                   │
│   ├─ POST /api/prescriptions    (doctor-only)             │
│   └─ Middleware: JWT Auth Guard + Role-Based Access (RBAC) │
└──────────────────────────┬────────────────────────────────┘
                           │  ACID Transactions
                           ▼
┌───────────────────────────────────────────────────────────┐
│              SQLite Database (caresync.db)                 │
│   users │ doctor_profiles │ appointments │ prescriptions  │
│   UNIQUE(doctor_id, appointment_date, time_slot)          │
└───────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Schema (ER Diagram)

```
┌──────────────┐       ┌───────────────────┐
│    users     │       │  doctor_profiles  │
├──────────────┤       ├───────────────────┤
│ id (PK)      │──1:1──│ id (PK)           │
│ name         │       │ user_id (FK→users)│
│ email (UQ)   │       │ specialization    │
│ password_hash│       │ experience_years  │
│ role         │       │ consultation_fee  │
│ phone        │       │ available_days    │
│ created_at   │       │ start_time        │
└──────┬───────┘       │ end_time          │
       │               │ bio               │
       │               └────────┬──────────┘
       │                        │
       │  1:N                   │  1:N
       ▼                        ▼
┌────────────────────────────────────────┐
│            appointments               │
├────────────────────────────────────────┤
│ id (PK)                               │
│ patient_id (FK → users)               │
│ doctor_id  (FK → doctor_profiles)     │
│ appointment_date                      │
│ time_slot                             │
│ status (confirmed/completed/cancelled)│
│ symptoms                              │
│ UNIQUE(doctor_id, date, time_slot)    │ ← Concurrency Guard
└──────────────────┬─────────────────────┘
                   │
                   │  1:1
                   ▼
        ┌─────────────────┐
        │  prescriptions  │
        ├─────────────────┤
        │ id (PK)         │
        │ appointment_id  │
        │ diagnosis       │
        │ medicines       │
        │ notes           │
        └─────────────────┘
```

---

## ✨ Key Features

### 1. Role-Based Access Control (RBAC)
- **Patient Portal:** Browse doctors, book appointments, view prescriptions.
- **Doctor Portal:** View patient queue, update consultation status, write prescriptions.
- Routes are protected by JWT middleware **and** role-based authorization guards.

### 2. Double-Booking Prevention Engine (Concurrency Guard)
- **The Problem:** Two patients booking the same doctor at the same time slot simultaneously.
- **The Solution:**
  1. A composite `UNIQUE(doctor_id, appointment_date, time_slot)` constraint at the database level.
  2. The booking logic is wrapped in an **ACID transaction** (SQLite `IMMEDIATE` mode), so concurrent requests are serialized.
  3. If a race condition occurs, the second request receives **HTTP 409 Conflict** without corrupting data.

### 3. Dynamic Slot Generation
- Automatically generates 30-minute time slots based on each doctor's configured `start_time` and `end_time`.
- Already-booked slots are dynamically filtered out per date.

### 4. Secure Authentication
- Passwords hashed with **bcrypt** (salt rounds = 10).
- Stateless sessions via **JWT (JSON Web Tokens)** with 24-hour expiry.
- Automatic token attachment via Axios interceptors; global 401 handling with auto-logout.

---

## 🚀 How to Run

### Prerequisites
- **Node.js** v18+ and **npm** v9+ ([Download Node.js](https://nodejs.org/))

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/CareSync.git
cd CareSync
```

### 2. Start the Backend
```bash
cd backend
npm install
npm run seed      # Seeds the database with sample doctors & patients
npm start         # Starts API server on http://localhost:5000
```

### 3. Start the Frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev       # Starts React dev server on http://localhost:5173
```

### 4. Open in Browser
Navigate to **http://localhost:5173**

### Demo Credentials (password for all: `password123`)
| Role | Email | Name |
| :--- | :--- | :--- |
| Patient | rahul@email.com | Rahul Sharma |
| Patient | priya@email.com | Priya Patel |
| Doctor | ananya@email.com | Dr. Ananya Verma (Cardiologist) |
| Doctor | vikram@email.com | Dr. Vikram Singh (Dermatologist) |

---

## 📡 REST API Reference

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | ❌ | Register new patient or doctor |
| `POST` | `/api/auth/login` | ❌ | Login and receive JWT |
| `GET` | `/api/auth/me` | ✅ | Get current user profile |
| `GET` | `/api/doctors` | ❌ | List all doctors (optional `?specialization=`) |
| `GET` | `/api/doctors/:id` | ❌ | Get specific doctor profile |
| `GET` | `/api/doctors/:id/slots?date=` | ❌ | Get available slots for a date |
| `POST` | `/api/appointments` | ✅ Patient | Book an appointment |
| `GET` | `/api/appointments` | ✅ | Get user's appointments |
| `PATCH` | `/api/appointments/:id/status` | ✅ Doctor | Update status |
| `DELETE` | `/api/appointments/:id` | ✅ Patient | Cancel appointment |
| `POST` | `/api/prescriptions` | ✅ Doctor | Create prescription |
| `GET` | `/api/prescriptions` | ✅ | Get user's prescriptions |

---

## 📄 Resume Bullet Points (STAR Format)

- *"Developed a full-stack clinical appointment booking platform using React, Node.js/Express, and SQLite, implementing role-based access control (RBAC) with JWT authentication and bcrypt password hashing."*
- *"Engineered a concurrency-safe booking engine using ACID database transactions and composite unique constraints to prevent double-booking race conditions, returning HTTP 409 Conflict on slot collisions."*
- *"Designed a normalized relational schema (3NF) with 4 interlinked tables and foreign key cascading, supporting dynamic 30-minute slot generation with real-time availability filtering."*

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, React Router v6, Tailwind CSS, Axios |
| Backend | Node.js, Express.js |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Build Tool | Vite |

---

## 📁 Project Structure

```
CareSync/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── package.json
│   ├── .env                   # Environment variables
│   ├── db/
│   │   ├── database.js        # SQLite connection & schema
│   │   └── seed.js            # Sample data seeder
│   ├── middleware/
│   │   └── auth.js            # JWT verification & RBAC
│   └── routes/
│       ├── auth.js            # Login / Register / Profile
│       ├── doctors.js         # Doctor listing & slot generation
│       ├── appointments.js    # Booking with concurrency guard
│       └── prescriptions.js   # Prescription CRUD
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx            # Route definitions
│       ├── index.css          # Tailwind + custom components
│       ├── api/axios.js       # Axios instance with interceptors
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── ProtectedRoute.jsx
│       │   └── StatusBadge.jsx
│       └── pages/
│           ├── Home.jsx
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── DoctorsList.jsx
│           ├── BookAppointment.jsx
│           ├── MyAppointments.jsx
│           ├── DoctorDashboard.jsx
│           └── Prescriptions.jsx
├── .gitignore
└── README.md
```
