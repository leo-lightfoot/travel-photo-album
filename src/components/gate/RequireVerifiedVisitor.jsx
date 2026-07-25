import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getStoredToken, setStoredToken, clearStoredToken } from '../../lib/sessionToken';
import EmailGate from './EmailGate';

const RequireVerifiedVisitor = ({ children }) => {
  const [status, setStatus] = useState('checking'); // 'checking' | 'verified' | 'unverified'

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setStatus('unverified');
      return;
    }

    fetch('/api/session/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setStatus('verified');
        } else {
          clearStoredToken();
          setStatus('unverified');
        }
      })
      .catch(() => {
        // Network error -- don't silently let them in or lock them out
        // permanently, just show the gate so they can retry.
        setStatus('unverified');
      });
  }, []);

  const handleVerified = (token) => {
    setStoredToken(token);
    setStatus('verified');
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (status === 'unverified') {
    return <EmailGate onVerified={handleVerified} />;
  }

  return children;
};

export default RequireVerifiedVisitor;
