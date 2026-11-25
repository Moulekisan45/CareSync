import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.role === 'doctor' ? '/doctor/dashboard' : '/doctors');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <span className="text-5xl">🏥</span>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to your CareSync account</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-medical-600 hover:text-medical-700 font-medium">
              Register here
            </Link>
          </p>

          {/* Demo Credentials */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Demo Credentials (password: password123)</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setEmail('rahul@email.com'); setPassword('password123'); }}
                className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-3 rounded-lg transition-colors"
              >
                👤 Patient (Rahul)
              </button>
              <button
                type="button"
                onClick={() => { setEmail('ananya@email.com'); setPassword('password123'); }}
                className="text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-3 rounded-lg transition-colors"
              >
                🩺 Doctor (Ananya)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
