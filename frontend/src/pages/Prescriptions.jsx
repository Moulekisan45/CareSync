import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Prescriptions() {
  const { user } = useAuth();
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/prescriptions')
      .then((res) => setPrescriptions(res.data.prescriptions))
      .catch((err) => console.error('Error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {user?.role === 'doctor' ? 'Issued Prescriptions' : 'My Prescriptions'}
      </h1>
      <p className="text-gray-500 mb-8">
        {user?.role === 'doctor' ? 'History of prescriptions you have issued' : 'View your clinical prescriptions and diagnoses'}
      </p>

      {prescriptions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-6xl block mb-4">💊</span>
          <p className="text-lg">No prescriptions yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {prescriptions.map((rx) => (
            <div key={rx.id} className="card">
              <div className="flex flex-col sm:flex-row justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {user?.role === 'patient' ? `Dr. ${rx.doctor_name}` : rx.patient_name}
                  </h3>
                  {user?.role === 'patient' && (
                    <p className="text-medical-600 text-sm">{rx.specialization}</p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <span>📅 {rx.appointment_date}</span>
                  <span className="ml-3">🕐 {rx.time_slot}</span>
                </div>
              </div>

              {rx.symptoms && (
                <div className="mb-3 p-3 bg-yellow-50 rounded-lg">
                  <p className="text-sm"><span className="font-medium text-yellow-800">Symptoms:</span> <span className="text-yellow-700">{rx.symptoms}</span></p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-3 bg-red-50 rounded-lg">
                  <p className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-1">Diagnosis</p>
                  <p className="text-red-700 font-medium">{rx.diagnosis}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <p className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-1">Medicines</p>
                  <p className="text-green-700">{rx.medicines}</p>
                </div>
              </div>

              {rx.notes && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">Doctor's Notes</p>
                  <p className="text-blue-700 text-sm">{rx.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
