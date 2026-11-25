import { useState, useEffect } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await api.get('/appointments');
      setAppointments(res.data.appointments);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const cancelAppointment = async (id) => {
    if (!confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to cancel.');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Appointments</h1>
      <p className="text-gray-500 mb-8">View and manage your booked appointments</p>

      {appointments.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-6xl block mb-4">📅</span>
          <p className="text-lg">No appointments yet.</p>
          <a href="/doctors" className="text-medical-600 hover:underline mt-2 inline-block">Browse Doctors →</a>
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.map((appt) => (
            <div key={appt.id} className="card flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{appt.doctor_name}</h3>
                  <StatusBadge status={appt.status} />
                </div>
                <p className="text-medical-600 text-sm font-medium">{appt.specialization}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
                  <span>📅 {appt.appointment_date}</span>
                  <span>🕐 {appt.time_slot}</span>
                  <span>💰 ₹{appt.consultation_fee}</span>
                </div>
                {appt.symptoms && (
                  <p className="mt-2 text-sm text-gray-500">
                    <span className="font-medium text-gray-600">Symptoms:</span> {appt.symptoms}
                  </p>
                )}
              </div>

              {appt.status === 'confirmed' && (
                <div className="flex items-center">
                  <button
                    onClick={() => cancelAppointment(appt.id)}
                    className="btn-danger text-sm"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
