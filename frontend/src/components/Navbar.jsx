import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-2xl">🏥</span>
            <span className="text-xl font-bold text-medical-700">CareSync</span>
          </Link>

          {/* Navigation Links */}
          {user ? (
            <div className="flex items-center space-x-4">
              {user.role === 'patient' && (
                <>
                  <Link to="/doctors" className="text-gray-600 hover:text-medical-600 font-medium transition-colors">
                    Find Doctors
                  </Link>
                  <Link to="/my-appointments" className="text-gray-600 hover:text-medical-600 font-medium transition-colors">
                    My Appointments
                  </Link>
                  <Link to="/prescriptions" className="text-gray-600 hover:text-medical-600 font-medium transition-colors">
                    Prescriptions
                  </Link>
                </>
              )}
              {user.role === 'doctor' && (
                <>
                  <Link to="/doctor/dashboard" className="text-gray-600 hover:text-medical-600 font-medium transition-colors">
                    Dashboard
                  </Link>
                  <Link to="/prescriptions" className="text-gray-600 hover:text-medical-600 font-medium transition-colors">
                    Prescriptions
                  </Link>
                </>
              )}

              {/* User Info & Logout */}
              <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{user.name}</p>
                  <p className="text-xs text-medical-600 capitalize">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                >
                  Logout
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link to="/login" className="btn-secondary text-sm py-2 px-4">
                Sign In
              </Link>
              <Link to="/register" className="btn-primary text-sm py-2 px-4">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
