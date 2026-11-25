import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function BookAppointment() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [doctor, setDoctor] = useState(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [slotsMessage, setSlotsMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    api.get(`/doctors/${doctorId}`)
      .then((res) => setDoctor(res.data.doctor))
      .catch(() => setError('Doctor not found.'))
      .finally(() => setLoading(false));
  }, [doctorId]);

  const fetchSlots = async (selectedDate) => {
    setDate(selectedDate);
    setSelectedSlot('');
    setSlotsMessage('');
    setSlots([]);

    if (!selectedDate) return;

    try {
      const res = await api.get(`/doctors/${doctorId}/slots`, { params: { date: selectedDate } });
      if (!res.data.available) {
        setSlotsMessage(res.data.message);
      } else {
        setSlots(res.data.slots);
      }
    } catch (err) {
      setSlotsMessage('Failed to load slots.');
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBooking(true);

    try {
      const res = await api.post('/appointments', {
        doctor_id: parseInt(doctorId),
        appointment_date: date,
        time_slot: selectedSlot,
        symptoms
      });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/my-appointments'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed.');
    } finally {
      setBooking(false);
    }
  };

  // Minimum selectable date = today
  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-medical-600"></div>
      </div>
    );
  }

  if (!doctor) {
    return <div className="text-center py-16 text-red-500">Doctor not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Doctor Info */}
      <div className="card mb-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{doctor.name}</h1>
            <p className="text-medical-600 font-medium text-lg">{doctor.specialization}</p>
            <p className="text-gray-500 mt-2">{doctor.bio}</p>
          </div>
          <span className="bg-medical-50 text-medical-700 text-lg font-semibold px-4 py-2 rounded-full whitespace-nowrap">
            ₹{doctor.consultation_fee}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
          <span>📋 {doctor.experience_years} years experience</span>
          <span>📅 {doctor.available_days}</span>
          <span>🕐 {doctor.start_time} – {doctor.end_time}</span>
        </div>
      </div>

      {/* Booking Form */}
      <div className="card">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Book Your Appointment</h2>

        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

        <form onSubmit={handleBook} className="space-y-6">
          {/* Date Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
            <input
              type="date"
              className="input-field"
              min={today}
              value={date}
              onChange={(e) => fetchSlots(e.target.value)}
              required
            />
          </div>

          {/* Time Slots */}
          {slotsMessage && (
            <div className="bg-yellow-50 text-yellow-700 px-4 py-3 rounded-lg text-sm">{slotsMessage}</div>
          )}

          {slots.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Available Time Slots</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.available}
                    onClick={() => setSelectedSlot(slot.time)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all border ${
                      !slot.available
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200 line-through'
                        : selectedSlot === slot.time
                        ? 'bg-medical-600 text-white border-medical-600 shadow-md'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-medical-500 hover:text-medical-600'
                    }`}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Symptoms */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Describe Your Symptoms</label>
            <textarea
              className="input-field"
              rows="3"
              placeholder="Briefly describe your symptoms or reason for visit..."
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={!date || !selectedSlot || booking}
          >
            {booking ? 'Booking...' : `Confirm Booking — ₹${doctor.consultation_fee}`}
          </button>
        </form>
      </div>
    </div>
  );
}
