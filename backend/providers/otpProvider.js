const crypto = require('crypto');

class MockOtpProvider {
  async sendOtp(maskedPhone, otpCode, purpose) {
    // Development mock: never log full phone or sensitive PII in production logs
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📱 [MockOTP] Purpose=${purpose} Phone=${maskedPhone} Code=${otpCode}`);
    }
    return { provider: 'mock', delivered: true, dev_otp: process.env.NODE_ENV !== 'production' ? otpCode : undefined };
  }
}

function getOtpProvider() {
  const mode = process.env.OTP_PROVIDER || 'mock';
  if (mode === 'mock') return new MockOtpProvider();
  return new MockOtpProvider();
}

function generateOtpCode() {
  return String(crypto.randomInt(100000, 999999));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function maskPhone(phone) {
  if (!phone || phone.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, phone.length - 4))}${phone.slice(-4)}`;
}

module.exports = { getOtpProvider, generateOtpCode, hashOtp, maskPhone };
