import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const propFirms = ['Lucid', 'Apex', 'Tradify', 'MyFundedFutures']
const statuses = ['Active', 'Passed', 'Busted', 'Paused']
const accountTypes = ['Eval', 'Funded']

function formatMoney(value) {
  const num = Number(value || 0)
  return `${num < 0 ? '-' : ''}$${Math.abs(num).toLocaleString()}`
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [firm, setFirm] = useState('Tradify')
  const [accountType, setAccountType] = useState('Eval')
  const [status, setStatus] = useState('Active')
  const [startingBalance, setStartingBalance] = useState('50000')
  const [evalCost, setEvalCost] = useState('0')

  const totals = useMemo(() => {
    const totalCosts = accounts.reduce((sum, account) => sum + Number(account.eval_cost || 0), 0)

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter(a => a.status !== 'Busted').length,
      fundedAccounts: accounts.filter(a => a.account_type === 'Funded').length,
      totalCosts,
    }
  }, [accounts])

  async function loadAccounts() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setAccounts(data || [])
    }

    setLoading(false)
  }

  async function handleAuth(event) {
    event.preventDefault()
    setAuthLoading(true)
    setError('')
    setAuthMessage('')

    const credentials = {
      email: authEmail,
      password: authPassword,
    }

    const response = authMode === 'login'
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials)

    if (response.error) {
      setError(response.error.message)
    } else if (authMode === 'register' && !response.data.session) {
      setAuthMessage('Registration created. Check your email to confirm your account, then log in.')
    } else {
      setSession(response.data.session)
      setAuthEmail('')
      setAuthPassword('')
    }

    setAuthLoading(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAccounts([])
    setSession(null)
  }

  async function addAccount(event) {
    event.preventDefault()

    setError('')

    if (!session?.user?.id) {
      setError('You must be logged in to add an account.')
      return
    }

    const { error } = await supabase.from('accounts').insert({
      user_id: session.user.id,
      name,
      firm,
      account_type: accountType,
      status,
      starting_balance: Number(startingBalance || 0),
      eval_cost: Number(evalCost || 0),
    })

    if (error) {
      setError(error.message)
      return
    }

    setName('')
    setEvalCost('0')

    await loadAccounts()
  }

  async function deleteAccount(id) {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadAccounts()
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (session) {
      loadAccounts()
    } else {
      setAccounts([])
      setLoading(false)
    }
  }, [session])

  if (!session) {
    return (
      <main className="app-shell auth-shell">
        <section className="auth-card">
          <div className="status-pill">SUPABASE AUTH</div>
          <h1>Prop Portfolio Tracker</h1>
          <p>
            Log in or create an account so your prop firm portfolio is saved securely to your Supabase database.
          </p>

          {error ? <div className="error-banner">{error}</div> : null}
          {authMessage ? <div className="success-banner">{authMessage}</div> : null}

          <form className="auth-form" onSubmit={handleAuth}>
            <input
              className="input"
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="Email address"
              required
            />

            <input
              className="input"
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Password"
              minLength={6}
              required
            />

            <button className="primary-button" type="submit" disabled={authLoading}>
              {authLoading ? 'Working...' : authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <button
            className="text-button"
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login')
              setError('')
              setAuthMessage('')
            }}
          >
            {authMode === 'login'
              ? 'Need an account? Register here.'
              : 'Already have an account? Log in here.'}
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <div className="dashboard-layout">
        <aside className="sidebar-card">
          <div className="logo-row">
            <div className="logo-circle">P</div>
            <div>
              <div className="logo-title">PropTrack</div>
              <div className="logo-subtitle">Portfolio OS</div>
            </div>
          </div>

          <div className="user-card">
            <div className="small-label">Signed in as</div>
            <div className="user-email">{session.user.email}</div>
            <button className="secondary-button" type="button" onClick={signOut}>Log Out</button>
          </div>

          <div className="highlight-card">
            <div className="highlight-label">Eval Costs</div>
            <div className="highlight-value">
              {formatMoney(totals.totalCosts)}
            </div>
            <div className="highlight-subtext">
              Backend connected successfully.
            </div>
          </div>
        </aside>

        <section className="main-content">
          <div className="hero-card">
            <div className="status-pill">SUPABASE CONNECTED</div>

            <h1>Prop Portfolio Tracker</h1>

            <p>
              Accounts now persist in your real backend database and are protected by user-level security.
            </p>

            {error ? (
              <div className="error-banner">{error}</div>
            ) : null}

            <div className="stats-grid">
              <div className="stat-card green">
                <div className="label">Accounts</div>
                <div className="value">{totals.totalAccounts}</div>
              </div>

              <div className="stat-card">
                <div className="label">Active</div>
                <div className="value">{totals.activeAccounts}</div>
              </div>

              <div className="stat-card">
                <div className="label">Funded</div>
                <div className="value">{totals.fundedAccounts}</div>
              </div>
            </div>
          </div>

          <div className="panel-card">
            <div className="panel-title">Add Account</div>

            <form className="account-form" onSubmit={addAccount}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account Name" className="input" required />

              <select value={firm} onChange={(e) => setFirm(e.target.value)} className="input">
                {propFirms.map(firm => <option key={firm}>{firm}</option>)}
              </select>

              <select value={accountType} onChange={(e) => setAccountType(e.target.value)} className="input">
                {accountTypes.map(type => <option key={type}>{type}</option>)}
              </select>

              <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                {statuses.map(status => <option key={status}>{status}</option>)}
              </select>

              <input value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} placeholder="Starting Balance" className="input" />

              <input value={evalCost} onChange={(e) => setEvalCost(e.target.value)} placeholder="Eval Cost" className="input" />

              <button className="primary-button" type="submit">
                Add Account
              </button>
            </form>
          </div>

          <div className="panel-card">
            <div className="panel-title">Accounts</div>

            {loading ? (
              <div className="empty-state">Loading...</div>
            ) : accounts.length === 0 ? (
              <div className="empty-state">No accounts yet.</div>
            ) : (
              <div className="accounts-grid">
                {accounts.map(account => (
                  <div className="account-card" key={account.id}>
                    <div className="account-card-top">
                      <div>
                        <div className="account-name">{account.name}</div>
                        <div className="account-meta">
                          {account.firm} • {account.account_type}
                        </div>
                      </div>

                      <button className="delete-button" onClick={() => deleteAccount(account.id)}>
                        ×
                      </button>
                    </div>

                    <div className="account-stats-row">
                      <div>
                        <div className="small-label">Status</div>
                        <div className="small-value">{account.status}</div>
                      </div>

                      <div>
                        <div className="small-label">Eval Cost</div>
                        <div className="small-value">{formatMoney(account.eval_cost)}</div>
                      </div>

                      <div>
                        <div className="small-label">Balance</div>
                        <div className="small-value">{formatMoney(account.starting_balance)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
