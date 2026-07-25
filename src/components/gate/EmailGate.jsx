import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';

const EmailGate = ({ onVerified }) => {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setStep('code');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCode = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/verify/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid or expired code.');
        return;
      }
      onVerified(data.token);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
      <Link to="/" className="text-slate-500 hover:text-slate-800 transition text-sm mb-6">
        ← Back to home
      </Link>

      <div className="bg-white rounded-xl shadow-md p-8 max-w-md w-full">
        <div className="flex justify-center mb-4">
          {step === 'email' ? (
            <Mail className="w-8 h-8 text-slate-700" />
          ) : (
            <ShieldCheck className="w-8 h-8 text-slate-700" />
          )}
        </div>

        {step === 'email' && (
          <form onSubmit={handleSendCode}>
            <h2 className="text-2xl font-light text-slate-800 text-center mb-2">
              Enter your email to continue
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              We'll send you a one-time code to view the galleries.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              placeholder="you@example.com"
              required
              autoFocus
              className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-3 focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none"
            />
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Send Code
            </button>
            <p className="text-xs text-slate-400 text-center mt-4">
              We'll only use your email to grant access and let you know about
              new galleries. No spam, and you can ask to be removed at any time.
            </p>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={handleConfirmCode}>
            <h2 className="text-2xl font-light text-slate-800 text-center mb-2">
              Enter your code
            </h2>
            <p className="text-slate-500 text-sm text-center mb-6">
              We sent a code to {email}.
            </p>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(''); }}
              placeholder="6-digit code"
              required
              autoFocus
              className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-3 focus:ring-2 focus:ring-slate-400 focus:border-transparent outline-none text-center text-lg tracking-widest"
            />
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm mb-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-800 text-white px-4 py-3 rounded-lg hover:bg-slate-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Verify
            </button>
            <div className="flex justify-center gap-4 mt-4 text-sm">
              <button
                type="button"
                onClick={handleSendCode}
                disabled={loading}
                className="text-slate-500 hover:text-slate-800 transition"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="text-slate-500 hover:text-slate-800 transition"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EmailGate;
