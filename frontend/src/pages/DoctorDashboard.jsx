import { useState, useEffect } from 'react';
import api from '../api/axios';
import StatusBadge from '../components/StatusBadge';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prescriptionForm, setPrescriptionForm] = useState(null);
  const [prescData, setPrescData] = useState({ diagnosis: '', medicines: '', notes: '' });

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

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/appointments/${id}/status`, { status });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const submitPrescription = async (e) => {
    e.preventDefault();
    try {
      await api.post('/prescriptions', {
        appointment_id: prescriptionForm,
        ...prescData
      });
      setPrescriptionForm(null);
      setPrescData({ diagnosis: '', medicines: '', notes: '' });
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create prescription.');
    }
  };

  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const completed = appointments.filter(a => a.status === 'completed');
  const cancelled = appointments.filter(a => a.status === 'cancelled');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Doctor Dashboard</h1>
      <p className="text-gray-500 mb-8">Manage your patient appointments and prescriptions</p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="card text-center">
          <p className="text-3xl font-bold text-medical-600">{confirmed.length}</p>
          <p className="text-sm text-gray-500 mt-1">Upcoming</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{completed.length}</p>
          <p className="text-sm text-gray-500 mt-1">Completed</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-gray-400">{cancelled.length}</p>
          <p className="text-sm text-gray-500 mt-1">Cancelled</p>
        </div>
      </div>

      {/* Prescription Modal */}
      {prescriptionForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Write Prescription</h3>
            <form onSubmit={submitPrescription} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis</label>
                <input
                  className="input-field"
                  placeholder="e.g., Viral Fever"
                  value={prescData.diagnosis}
                  onChange={(e) => setPrescData({ ...prescData, diagnosis: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicines</label>
                <textarea
                  className="input-field"
                  rows="3"
                  placeholder="e.g., Paracetamol 500mg (3x daily), Cetirizine 10mg (1x night)"
                  value={prescData.medicines}
                  onChange={(e) => setPrescData({ ...prescData, medicines: e.target.value })}
                  required
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  className="input-field"
                  rows="2"
                  placeholder="Follow-up instructions..."
                  value={prescData.notes}
                  onChange={(e) => setPrescData({ ...prescData, notes: e.target.value })}
                ></textarea>
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1">Save Prescription</button>
                <button type="button" onClick={() => setPrescriptionForm(null)} className="btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">📋 Upcoming Appointments</h2>
      {confirmed.length === 0 ? (
        <div className="card text-center text-gray-400 mb-8">
          <p>No upcoming appointments.</p>
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {confirmed.map((appt) => (
            <div key={appt.id} className="card">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{appt.patient_name}</h3>
                    <StatusBadge status={appt.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                    <span>📅 {appt.appointment_date}</span>
                    <span>🕐 {appt.time_slot}</span>
                    <span>📞 {appt.patient_phone || 'N/A'}</span>
                  </div>
                  {appt.symptoms && (
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-medium">Symptoms:</span> {appt.symptoms}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setPrescriptionForm(appt.id);
                      setPrescData({ diagnosis: '', medicines: '', notes: '' });
                    }}
                    className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
                  >
                    💊 Prescribe
                  </button>
                  <button
                    onClick={() => updateStatus(appt.id, 'completed')}
                    className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg transition-all"
                  >
                    ✓ Complete
                  </button>
                  <button
                    onClick={() => updateStatus(appt.id, 'cancelled')}
                    className="btn-danger text-sm"
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">✅ Completed</h2>
          <div className="space-y-3 mb-8">
            {completed.map((appt) => (
              <div key={appt.id} className="card opacity-80">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-700">{appt.patient_name}</h3>
                  <StatusBadge status={appt.status} />
                  <span className="text-sm text-gray-400">📅 {appt.appointment_date} · {appt.time_slot}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
