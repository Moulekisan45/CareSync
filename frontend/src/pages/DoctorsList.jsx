import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

export default function DoctorsList() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async (spec = '') => {
    setLoading(true);
    try {
      const res = await api.get('/doctors', { params: spec ? { specialization: spec } : {} });
      setDoctors(res.data.doctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDoctors(search);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Find a Doctor</h1>
          <p className="text-gray-500 mt-1">Browse our specialists and book your appointment</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            className="input-field w-64"
            placeholder="Search specialization..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="btn-primary">Search</button>
          {search && (
            <button type="button" onClick={() => { setSearch(''); fetchDoctors(); }} className="btn-secondary">
              Clear
            </button>
          )}
        </form>
      </div>

      {doctors.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <span className="text-6xl block mb-4">🔍</span>
          <p className="text-lg">No doctors found. Try a different search term.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doc) => (
            <div key={doc.profile_id} className="card flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{doc.name}</h3>
                    <p className="text-medical-600 font-medium">{doc.specialization}</p>
                  </div>
                  <span className="bg-medical-50 text-medical-700 text-sm font-semibold px-3 py-1 rounded-full">
                    ₹{doc.consultation_fee}
                  </span>
                </div>

                <p className="text-gray-500 text-sm mt-3 line-clamp-2">{doc.bio || 'No bio available.'}</p>

                <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-500">
                  <span>📋 {doc.experience_years} yrs exp</span>
                  <span>📅 {doc.available_days}</span>
                  <span>🕐 {doc.start_time} – {doc.end_time}</span>
                </div>
              </div>

              <Link
                to={`/book/${doc.profile_id}`}
                className="btn-primary text-center mt-5 block"
              >
                Book Appointment
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
