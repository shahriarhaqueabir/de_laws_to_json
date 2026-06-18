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
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="bg-[#2a2a2a] w-14 h-14 flex items-center justify-center mx-auto mb-4 rounded-none">
            <ShieldAlert className="w-7 h-7 text-[#c4a86a]" />
          </div>
          <h1 className="text-3xl font-bold text-[#e8e6e3]">
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </h1>
          <p className="text-[#a09e9a] mt-2">
            {mode === 'signin'
              ? 'Sign in to sync bookmarks across devices'
              : 'Create an account to save your progress'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#1a1a1a] border border-[#2a2a2a] p-8 rounded-none space-y-5">
          {error && (
            <div className="bg-[#2a2a2a] border border-red-700 text-red-400 px-4 py-3 text-sm rounded-none">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-[#2a2a2a] border border-green-700 text-green-400 px-4 py-3 text-sm rounded-none">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[#e8e6e3] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-none text-[#e8e6e3] focus:outline-none focus:ring-1 focus:ring-[#c4a86a] transition-all duration-100"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#e8e6e3] mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-none text-[#e8e6e3] focus:outline-none focus:ring-1 focus:ring-[#c4a86a] transition-all duration-100"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c4a86a] text-[#0d0d0d] font-bold py-3 rounded-none hover:bg-[#d4b87a] disabled:opacity-50 transition-all duration-100 active:translate-y-[1px] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#6b6a66] mt-6">
          {mode === 'signin' ? (
            <>No account?{' '}<button onClick={() => { setMode('signup'); setError(null); setSuccess(null); }} className="text-[#c4a86a] hover:underline">Create one</button></>
          ) : (
            <>Already have an account?{' '}<button onClick={() => { setMode('signin'); setError(null); setSuccess(null); }} className="text-[#c4a86a] hover:underline">Sign in</button></>
          )}
        </p>

        <p className="text-center mt-4">
          <Link href="/" className="text-xs text-[#6b6a66] hover:text-[#c4a86a] transition-all duration-100">← Back to search</Link>
        </p>
      </div>
    </div>
  );
}
