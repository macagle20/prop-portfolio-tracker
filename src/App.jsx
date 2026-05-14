export default function App() {
  return (
    <main className="app-shell">
      <div className="hero-card">
        <div className="status-pill">LIVE</div>
        <h1>Prop Portfolio Tracker</h1>
        <p>
          Your prop firm operating system is officially running.
        </p>

        <div className="stats-grid">
          <div className="stat-card green">
            <div className="label">Actual Net</div>
            <div className="value">$0</div>
          </div>

          <div className="stat-card">
            <div className="label">Accounts</div>
            <div className="value">0</div>
          </div>

          <div className="stat-card">
            <div className="label">Pass Rate</div>
            <div className="value">0%</div>
          </div>
        </div>
      </div>
    </main>
  )
}
