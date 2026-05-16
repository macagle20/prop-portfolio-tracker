import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabaseClient'

const propFirms = ['Lucid', 'Apex', 'Tradify', 'MyFundedFutures']
const statuses = ['Active', 'Passed', 'Breached', 'Busted', 'Paused']
const accountTypes = ['Eval', 'Funded']
const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const navPages = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
]

function formatMoney(value) {
  const num = Number(value || 0)
  return `${num < 0 ? '-' : ''}$${Math.abs(num).toLocaleString()}`
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function getMonday(date = new Date()) {
  const copy = new Date(date)
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function getWeekDays(weekStart) {
  return dayNames.map((dayName, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)
    return {
      label: dayName,
      shortLabel: dayName.slice(0, 3),
      date,
      dateKey: toDateKey(date),
    }
  })
}

function parseNumber(value) {
  if (value === '' || value === null || value === undefined) return 0
  const cleaned = String(value).replace(/[$,]/g, '')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : 0
}

function isClosedAccount(account) {
  return account.status === 'Breached' || account.status === 'Busted'
}

function PlaceholderPage({ title, description }) {
  return (
    <div className="panel-card placeholder-page">
      <div className="status-pill">COMING SOON</div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')

  const [activePage, setActivePage] = useState('dashboard')
  const [accounts, setAccounts] = useState([])
  const [dailyEntries, setDailyEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [weekStart] = useState(getMonday())
  const [dailyDrafts, setDailyDrafts] = useState({})
  const [savingEntryKey, setSavingEntryKey] = useState('')

  const [name, setName] = useState('')
  const [firm, setFirm] = useState('Tradify')
  const [accountType, setAccountType] = useState('Eval')
  const [status, setStatus] = useState('Active')
  const [startingBalance, setStartingBalance] = useState('50000')
  const [evalCost, setEvalCost] = useState('0')

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart])
  const weekStartKey = weekDays[0].dateKey
  const weekEndKey = weekDays[weekDays.length - 1].dateKey

  const visibleAccounts = useMemo(() => {
    return accounts.filter(account => !isClosedAccount(account))
  }, [accounts])

  const entryByAccountDate = useMemo(() => {
    return dailyEntries.reduce((map, entry) => {
      map[`${entry.account_id}-${entry.entry_date}`] = entry
      return map
    }, {})
  }, [dailyEntries])

  const accountStats = useMemo(() => {
    return accounts.reduce((map, account) => {
      const entries = dailyEntries.filter(entry => entry.account_id === account.id)
      const allTimePnl = entries.reduce((sum, entry) => sum + Number(entry.pnl || 0), 0)
      const weekPnl = entries
        .filter(entry => entry.entry_date >= weekStartKey && entry.entry_date <= weekEndKey)
        .reduce((sum, entry) => sum + Number(entry.pnl || 0), 0)

      map[account.id] = {
        allTimePnl,
        weekPnl,
        currentBalance: Number(account.starting_balance || 0) + allTimePnl,
      }
      return map
    }, {})
  }, [accounts, dailyEntries, weekStartKey, weekEndKey])

  const totals = useMemo(() => {
    const totalCosts = accounts.reduce((sum, account) => sum + Number(account.eval_cost || 0), 0)
    const weeklyPnl = Object.values(accountStats).reduce((sum, stat) => sum + stat.weekPnl, 0)
    const allTimePnl = Object.values(accountStats).reduce((sum, stat) => sum + stat.allTimePnl, 0)
    const activeCombines = accounts.filter(a => a.account_type === 'Eval' && !isClosedAccount(a)).length
    const activeFundedAccounts = accounts.filter(a => a.account_type === 'Funded' && !isClosedAccount(a)).length

    return {
      totalAccounts: accounts.length,
      activeAccounts: activeCombines + activeFundedAccounts,
      activeCombines,
      activeFundedAccounts,
      fundedAccounts: accounts.filter(a => a.account_type === 'Funded').length,
      totalCosts,
      weeklyPnl,
      allTimePnl,
    }
  }, [accounts, accountStats])

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

  async function loadDailyEntries() {
    const { data, error } = await supabase
      .from('daily_entries')
      .select('*')
      .order('entry_date', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setDailyEntries(data || [])
    }
  }

  async function loadDashboardData() {
    setLoading(true)
    await Promise.all([loadAccounts(), loadDailyEntries()])
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
    setDailyEntries([])
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

    await loadDashboardData()
  }

  async function updateAccount(accountId, updates) {
    setError('')

    const { error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', accountId)

    if (error) {
      setError(error.message)
      return
    }

    await loadDashboardData()
  }

  async function moveToFunded(account) {
    await updateAccount(account.id, {
      account_type: 'Funded',
      status: 'Active',
    })
  }

  async function breachAccount(account) {
    await updateAccount(account.id, {
      status: 'Breached',
    })
  }

  async function deleteAccount(id) {
    const confirmed = window.confirm(
      'Delete this account? Deleting removes it from tracking and may prevent accurate metrics for this account later.'
    )

    if (!confirmed) return

    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id)

    if (error) {
      setError(error.message)
      return
    }

    await loadDashboardData()
  }

  function getDailyValue(accountId, dateKey) {
    const draftKey = `${accountId}-${dateKey}`
    if (Object.prototype.hasOwnProperty.call(dailyDrafts, draftKey)) {
      return dailyDrafts[draftKey]
    }

    return entryByAccountDate[draftKey]?.pnl ?? ''
  }

  function updateDailyDraft(accountId, dateKey, value) {
    setDailyDrafts(current => ({
      ...current,
      [`${accountId}-${dateKey}`]: value,
    }))
  }

  async function saveDailyEntry(account, dateKey) {
    if (!session?.user?.id) return

    const draftKey = `${account.id}-${dateKey}`
    const rawValue = getDailyValue(account.id, dateKey)
    const pnl = parseNumber(rawValue)
    const existingEntry = entryByAccountDate[draftKey]

    setSavingEntryKey(draftKey)
    setError('')

    if (existingEntry) {
      const { error } = await supabase
        .from('daily_entries')
        .update({ pnl })
        .eq('id', existingEntry.id)

      if (error) {
        setError(error.message)
        setSavingEntryKey('')
        return
      }
    } else {
      const { error } = await supabase.from('daily_entries').insert({
        account_id: account.id,
        user_id: session.user.id,
        entry_date: dateKey,
        pnl,
      })

      if (error) {
        setError(error.message)
        setSavingEntryKey('')
        return
      }
    }

    setDailyDrafts(current => {
      const next = { ...current }
      delete next[draftKey]
      return next
    })

    await loadDailyEntries()
    setSavingEntryKey('')
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
      loadDashboardData()
    } else {
      setAccounts([])
      setDailyEntries([])
      setLoading(false)
    }
  }, [session])

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-hero-panel">
          <div className="auth-brand-row">
            <div className="logo-circle">F</div>
            <div>
              <div className="logo-title">FundedAF</div>
              <div className="logo-subtitle">Payout OS</div>
            </div>
          </div>

          <div className="status-pill">PROP FIRM PAYOUT TRACKING</div>
          <h1>Track what you paid in and what you pulled out.</h1>
          <p>
            FundedAF separates paper challenge profits from real extracted cash. Track eval costs, funded accounts, payouts, and firm-by-firm ROI in one clean dashboard.
          </p>

          <div className="auth-feature-grid">
            <div className="auth-feature-card">
              <span>01</span>
              <strong>Realized P&L</strong>
              <p>Payouts minus eval costs, not inflated challenge balances.</p>
            </div>
            <div className="auth-feature-card">
              <span>02</span>
              <strong>Cashout ROI</strong>
              <p>See which firms and account types are actually paying you back.</p>
            </div>
            <div className="auth-feature-card">
              <span>03</span>
              <strong>Secure Portfolio</strong>
              <p>Your accounts are protected with Supabase authentication and RLS.</p>
            </div>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-header">
            <div className="auth-eyebrow">Welcome {authMode === 'login' ? 'back' : 'aboard'}</div>
            <h2>{authMode === 'login' ? 'Log in to FundedAF' : 'Create your FundedAF account'}</h2>
            <p>
              {authMode === 'login'
                ? 'Access your payout-focused prop portfolio dashboard and keep tracking what actually hits your bank account.'
                : 'Start tracking your prop firm costs, payouts, and account outcomes from day one.'}
            </p>
          </div>

          {error ? <div className="error-banner">{error}</div> : null}
          {authMessage ? <div className="success-banner">{authMessage}</div> : null}

          <form className="auth-form" onSubmit={handleAuth}>
            <label className="auth-field">
              <span>Email address</span>
              <input
                className="input"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                className="input"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                minLength={6}
                required
              />
            </label>

            <button className="primary-button auth-submit" type="submit" disabled={authLoading}>
              {authLoading ? 'Working...' : authMode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>{authMode === 'login' ? 'New here?' : 'Already registered?'}</span>
          </div>

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
              ? 'Create a FundedAF account'
              : 'Log in to an existing account'}
          </button>
        </section>
      </main>
    )
  }

  const pageDescriptions = {
    payouts: 'Payout and cost tracking will live here. This page will become the clean money ledger without crowding the dashboard.',
    analytics: 'Analytics and modeling will live here. This will use your real eval, funded, payout, and cost data once the core tracker is built.',
    settings: 'Settings will live here. We will add defaults and customization only when the app actually needs them.',
  }

  return (
    <main className="app-shell">
      <div className="dashboard-layout">
        <aside className="sidebar-card">
          <div className="logo-row">
            <div className="logo-circle">F</div>
            <div>
              <div className="logo-title">FundedAF</div>
              <div className="logo-subtitle">Payout OS</div>
            </div>
          </div>

          <div className="user-card">
            <div className="small-label">Signed in as</div>
            <div className="user-email">{session.user.email}</div>
            <button className="secondary-button" type="button" onClick={signOut}>Log Out</button>
          </div>

          <nav className="sidebar-nav" aria-label="FundedAF pages">
            {navPages.map(page => (
              <button
                key={page.id}
                className={`nav-button ${activePage === page.id ? 'active' : ''}`}
                type="button"
                onClick={() => setActivePage(page.id)}
              >
                {page.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="main-content">
          {activePage === 'dashboard' ? (
            <>
              <div className="hero-card">
                <div className="status-pill">SUPABASE CONNECTED</div>

                <h1>FundedAF Dashboard</h1>

                <p>
                  Enter this week's daily P&L below. Balances reflect every saved daily result, not just the current week.
                </p>

                {error ? (
                  <div className="error-banner">{error}</div>
                ) : null}

                <div className="stats-grid dashboard-stats-grid">
                  <div className="stat-card green">
                    <div className="label">This Week P&L</div>
                    <div className="value">{formatMoney(totals.weeklyPnl)}</div>
                  </div>

                  <div className="stat-card">
                    <div className="label">All-Time P&L</div>
                    <div className="value">{formatMoney(totals.allTimePnl)}</div>
                  </div>

                  <div className="stat-card">
                    <div className="label">Active Combines</div>
                    <div className="value">{totals.activeCombines}</div>
                  </div>

                  <div className="stat-card">
                    <div className="label">Active Funded</div>
                    <div className="value">{totals.activeFundedAccounts}</div>
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

              <div className="panel-card weekly-panel accounts-panel">
                <div className="weekly-header clean">
                  <div>
                    <div className="panel-title">Accounts</div>
                    <p className="panel-copy">Current week: {weekStartKey} to {weekEndKey}</p>
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state">Loading...</div>
                ) : visibleAccounts.length === 0 ? (
                  <div className="empty-state">No active accounts yet. Add an account before entering daily profit.</div>
                ) : (
                  <div className="weekly-table-wrap">
                    <table className="weekly-table account-tracking-table">
                      <thead>
                        <tr>
                          <th>Account</th>
                          <th>Balance</th>
                          {weekDays.map(day => <th key={day.dateKey}>{day.shortLabel}<span>{day.dateKey.slice(5)}</span></th>)}
                          <th>Week</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleAccounts.map(account => {
                          const stats = accountStats[account.id] || { currentBalance: account.starting_balance, weekPnl: 0 }

                          return (
                            <tr key={account.id}>
                              <td>
                                <div className="weekly-account-name">{account.name}</div>
                                <div className="account-meta">{account.firm} • {account.account_type}</div>
                              </td>
                              <td className="balance-cell">{formatMoney(stats.currentBalance)}</td>
                              {weekDays.map(day => {
                                const draftKey = `${account.id}-${day.dateKey}`
                                const isSaving = savingEntryKey === draftKey
                                return (
                                  <td key={day.dateKey}>
                                    <input
                                      className="daily-input"
                                      value={getDailyValue(account.id, day.dateKey)}
                                      onChange={(event) => updateDailyDraft(account.id, day.dateKey, event.target.value)}
                                      onBlur={() => saveDailyEntry(account, day.dateKey)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                          event.currentTarget.blur()
                                        }
                                      }}
                                      placeholder="0"
                                    />
                                    {isSaving ? <div className="saving-label">Saving</div> : null}
                                  </td>
                                )
                              })}
                              <td className={stats.weekPnl >= 0 ? 'positive-cell' : 'negative-cell'}>{formatMoney(stats.weekPnl)}</td>
                              <td>
                                <div className="account-action-row">
                                  {account.account_type === 'Eval' ? (
                                    <button className="action-button funded-action" type="button" onClick={() => moveToFunded(account)}>
                                      Move to Funded
                                    </button>
                                  ) : null}
                                  <button className="action-button breach-action" type="button" onClick={() => breachAccount(account)}>
                                    Breached
                                  </button>
                                  <button className="action-button delete-action" type="button" onClick={() => deleteAccount(account.id)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <PlaceholderPage
              title={navPages.find(page => page.id === activePage)?.label}
              description={pageDescriptions[activePage]}
            />
          )}
        </section>
      </div>
    </main>
  )
}
