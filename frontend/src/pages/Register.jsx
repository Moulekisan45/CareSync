import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    role: 'patient',
    specialization: '', experience_years: '', consultation_fee: '', bio: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await register(form);
      navigate(user.role === 'doctor' ? '/doctor/dashboard' : '/doctors');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">🏥</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Create Account</h1>
          <p className="text-gray-500 mt-2">Join CareSync as a Patient or Doctor</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Role Selection */}
            <div className="flex gap-4 mb-2">
              <label className={`flex-1 text-center py-3 rounded-lg cursor-pointer border-2 transition-all font-medium ${
                form.role === 'patient' ? 'border-medical-500 bg-medical-50 text-medical-700' : 'border-gray-200 hover:border-gray-300 text-gray-500'
              }`}>
                <input type="radio" name="role" value="patient" checked={form.role === 'patient'} onChange={handleChange} className="sr-only" />
                👤 Patient
              </label>
              <label className={`flex-1 text-center py-3 rounded-lg cursor-pointer border-2 transition-all font-medium ${
                form.role === 'doctor' ? 'border-medical-500 bg-medical-50 text-medical-700' : 'border-gray-200 hover:border-gray-300 text-gray-500'
              }`}>
                <input type="radio" name="role" value="doctor" checked={form.role === 'doctor'} onChange={handleChange} className="sr-only" />
                🩺 Doctor
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input name="name" className="input-field" placeholder="John Doe" value={form.name} onChange={handleChange} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input name="email" type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={handleChange} required />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input name="password" type="password" className="input-field" placeholder="Min 6 characters" value={form.password} onChange={handleChange} required minLength={6} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input name="phone" className="input-field" placeholder="9876543210" value={form.phone} onChange={handleChange} />
            </div>

            {/* Doctor-specific fields */}
            {form.role === 'doctor' && (
              <div className="space-y-4 pt-4 border-t border-gray-100">
                <h3 className="font-semibold text-gray-700">Doctor Profile</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                  <input name="specialization" className="input-field" placeholder="e.g., Cardiologist" value={form.specialization} onChange={handleChange} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Experience (Years)</label>
                    <input name="experience_years" type="number" className="input-field" placeholder="5" value={form.experience_years} onChange={handleChange} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
                    <input name="consultation_fee" type="number" className="input-field" placeholder="500" value={form.consultation_fee} onChange={handleChange} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea name="bio" className="input-field" rows="3" placeholder="Brief professional bio..." value={form.bio} onChange={handleChange}></textarea>
                </div>
              </div>
            )}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-medical-600 hover:text-medical-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
