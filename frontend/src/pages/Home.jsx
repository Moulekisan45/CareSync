import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user } = useAuth();

  return (
    <div className="min-h-[85vh]">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-medical-600 via-medical-700 to-medical-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Your Health,{' '}
              <span className="text-medical-200">Synchronized.</span>
            </h1>
            <p className="mt-6 text-lg text-medical-100 leading-relaxed">
              Book appointments with top specialists, manage your clinical records,
              and receive digital prescriptions — all in one seamless platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              {user ? (
                <Link
                  to={user.role === 'doctor' ? '/doctor/dashboard' : '/doctors'}
                  className="bg-white text-medical-700 font-semibold py-3 px-8 rounded-lg hover:bg-medical-50 transition-all shadow-lg"
                >
                  Go to Dashboard →
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="bg-white text-medical-700 font-semibold py-3 px-8 rounded-lg hover:bg-medical-50 transition-all shadow-lg"
                  >
                    Get Started Free →
                  </Link>
                  <Link
                    to="/login"
                    className="border-2 border-white/30 text-white font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-all"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          Why Choose CareSync?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="card text-center">
            <div className="text-4xl mb-4">🩺</div>
            <h3 className="text-lg font-semibold text-gray-900">Browse Specialists</h3>
            <p className="text-gray-500 mt-2">
              Find doctors by specialization, experience, and consultation fees.
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">📅</div>
            <h3 className="text-lg font-semibold text-gray-900">Smart Slot Booking</h3>
            <p className="text-gray-500 mt-2">
              Real-time availability with 30-minute slots and double-booking prevention.
            </p>
          </div>
          <div className="card text-center">
            <div className="text-4xl mb-4">💊</div>
            <h3 className="text-lg font-semibold text-gray-900">Digital Prescriptions</h3>
            <p className="text-gray-500 mt-2">
              Receive and access your prescriptions and diagnosis records anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Tech Stack Section */}
      <div className="bg-gray-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-6">Built With</h3>
          <div className="flex flex-wrap justify-center gap-6 text-gray-500 font-medium">
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">⚛️ React</span>
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">🟢 Node.js</span>
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">🚂 Express</span>
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">🗄️ SQLite</span>
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">🔐 JWT Auth</span>
            <span className="bg-white px-4 py-2 rounded-lg shadow-sm">🎨 Tailwind CSS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
