'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../components/auth-context';
import { LogIn, Loader2, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const { signIn, signUp, user } = useAuth();
  const router = useRouter();

  if (user) {
    router.push('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password);

    if (result) {
      setError(result);
    } else if (mode === 'signup') {
      setSuccess('Account created! Check your email for confirmation.');
    } else {
      router.push('/');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#070707] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="bg-[#1a1a1a] w-14 h-14 flex items-center justify-center mx-auto mb-4 rounded-none">
            <ShieldAlert className="w-7 h-7 text-[#777777]" />
          </div>
          <h1 className="text-3xl font-bold text-[#cccccc]">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-[#888888] mt-2">
            {mode === 'signin'
              ? 'Sign in to sync bookmarks across devices'
              : 'Create an account to save your progress'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#0e0e0e] border border-[#1a1a1a] p-8 rounded-none space-y-5">
          {error && (
            <div className="bg-[#1a1a1a] border border-red-700 text-red-400 px-4 py-3 text-sm rounded-none">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-[#1a1a1a] border border-green-700 text-green-400 px-4 py-3 text-sm rounded-none">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#cccccc] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#070707] border border-[#1a1a1a] rounded-none text-[#cccccc] focus:outline-none focus:ring-1 focus:ring-[#777777] transition-all duration-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#cccccc] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-[#070707] border border-[#1a1a1a] rounded-none text-[#cccccc] focus:outline-none focus:ring-1 focus:ring-[#777777] transition-all duration-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#777777] text-[#070707] font-bold py-3 rounded-none hover:bg-[#999999] disabled:opacity-50 transition-all duration-100 active:translate-y-[1px] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#555555] mt-6">
          {mode === 'signin' ? (
            <>No account?{' '}<button onClick={() => { setMode('signup'); setError(null); setSuccess(null); }} className="text-[#777777] hover:underline">Create one</button></>
          ) : (
            <>Already have an account?{' '}<button onClick={() => { setMode('signin'); setError(null); setSuccess(null); }} className="text-[#777777] hover:underline">Sign in</button></>
          )}
        </p>

        <p className="text-center mt-4">
          <Link href="/" className="text-xs text-[#555555] hover:text-[#999999] transition-all duration-100">← Back to search</Link>
        </p>
      </div>
    </div>
  );
}
