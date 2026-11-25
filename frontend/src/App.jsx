import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DoctorsList from './pages/DoctorsList';
import BookAppointment from './pages/BookAppointment';
import MyAppointments from './pages/MyAppointments';
import DoctorDashboard from './pages/DoctorDashboard';
import Prescriptions from './pages/Prescriptions';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <Register />} />

          {/* Patient Routes */}
          <Route path="/doctors" element={
            <ProtectedRoute role="patient"><DoctorsList /></ProtectedRoute>
          } />
          <Route path="/book/:doctorId" element={
            <ProtectedRoute role="patient"><BookAppointment /></ProtectedRoute>
          } />
          <Route path="/my-appointments" element={
            <ProtectedRoute role="patient"><MyAppointments /></ProtectedRoute>
          } />

          {/* Doctor Routes */}
          <Route path="/doctor/dashboard" element={
            <ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>
          } />

          {/* Shared Routes */}
          <Route path="/prescriptions" element={
            <ProtectedRoute><Prescriptions /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
