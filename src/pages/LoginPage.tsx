import { useState } from 'react'
import probeImg from '../assets/probe.png'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function LoginPage() {
  const { user, signIn, signUp } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        // await signUp(email, password, username)
      } else {
        await signIn(email, password)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cover flex items-center justify-center px-4" style={{ backgroundImage: `url(${probeImg})` }}>
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-slate-100 bg-slate-750 text-center mb-2">Starveil: Interstellar Siege</h1>
        <p className="text-slate-500 text-center text-sm mb-8">Space Empire Simulation</p>
        <section></section>
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
                Commander Name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={isSignUp}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                placeholder="Enter your name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="commander@starveil.io"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 uppercase tracking-wider mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : isSignUp ? 'Create Colony' : 'Sign In'}
          </button>
        </form>

        {/* <button
          onClick={() => { setIsSignUp(!isSignUp); setError('') }}
          className="w-full text-center text-sm text-slate-500 hover:text-slate-300 mt-4 transition-colors"
        >
          {isSignUp ? 'Already have a colony? Sign in' : 'New commander? Create a colony'}
        </button> */}
      </div>
    </div>
  )
}
