import { useState, useEffect } from 'react'

interface SimplePasswordGateProps {
  children: React.ReactNode
}

const EXPECTED_HASH = import.meta.env.VITE_CALCULATOR_PASSWORD_HASH || "4fe1272f143be7882a6513c767800660df5ec3392d697c7a546fcd786914d1c0"

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

export default function SimplePasswordGate({ children }: SimplePasswordGateProps) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    // Check sessionStorage on mount
    const authStatus = sessionStorage.getItem('calculator-auth')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }

    // Listen for theme changes
    const handleThemeChange = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }

    const observer = new MutationObserver(() => {
      handleThemeChange()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!password) {
      setError('Please enter a password')
      return
    }

    const inputHash = await sha256(password)

    if (inputHash === EXPECTED_HASH) {
      sessionStorage.setItem('calculator-auth', 'true')
      setIsAuthenticated(true)
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'}`}>
      <div className={`w-full max-w-md rounded-lg border p-8 shadow-lg ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <h1 className={`mb-2 text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Cross Connect Calculator</h1>
        <p className={`mb-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Please enter the password to access the calculator</p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="password" className={`mb-2 block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-1 ${
                isDarkMode
                  ? 'border-gray-600 bg-gray-700 text-white focus:border-blue-400 focus:ring-blue-400'
                  : 'border-gray-300 text-gray-900 focus:border-blue-500 focus:ring-blue-500'
              }`}
              placeholder="Enter password"
              autoFocus
            />
          </div>

          {error && (
            <div className={`mb-4 rounded-md px-3 py-2 text-sm ${
              isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-50 text-red-700'
            }`}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDarkMode
                ? 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-400'
                : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
            }`}
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}
