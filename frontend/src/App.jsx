import React, { useEffect, useMemo, useState } from 'react';
import { api, WS_URL } from './api';
import SeismicObservatory from './components/SeismicObservatory';

const defaultLogin = {
  username: '',
  password: '',
};

function Login({ onLogin }) {
  const [form, setForm] = useState(defaultLogin);
  const [recovery, setRecovery] = useState(false);
  const [question, setQuestion] = useState('');
  const [recoverUser, setRecoverUser] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();

    try {
      const d = await api.login(form.username, form.password);

      localStorage.setItem('token', d.token);
      localStorage.setItem('user', JSON.stringify(d.user));

      onLogin(d.user);
    } catch (e) {
      setError(e.message);
    }
  }

  async function getQuestion() {
    try {
      const d = await api.recoveryQuestion(recoverUser);
      setQuestion(d.question);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function reset(e) {
    e.preventDefault();

    try {
      await api.recoveryReset({
        username: recoverUser,
        security_answer: answer,
        new_password: newPassword,
      });

      setRecovery(false);
      setError('Password reset completed. Previous sessions were revoked.');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-lockup">
          <div className="brand-orbit"><img src ="/stations/ncpor.jpg" alt="NCPOR"/> </div>

          <div>
            <div className="brand-mark">National Center for Polar and Ocean Research</div>
            <div className="brand-sub">
              DIGITAL TWIN MISSION CONTROL
            </div>
          </div>
        </div>

        <div className="login-kicker">
          SECURE ANTARCTIC OPERATIONS NETWORK
        </div>

        <h1 className="loghead">Mission Control</h1>

        <p className="muted">
          Real-time station telemetry, logistics and controlled operational
          workflows for Indian Antarctic research stations.
        </p>

        {!recovery ? (
          <form onSubmit={submit} className="stack">
            <input
              placeholder="Clearance identity"
              value={form.username}
              onChange={(e) =>
                setForm({
                  ...form,
                  username: e.target.value,
                })
              }
              required
            />

            <input
              type="password"
              placeholder="Access key"
              value={form.password}
              onChange={(e) =>
                setForm({
                  ...form,
                  password: e.target.value,
                })
              }
              required
            />

            <button className="primary">
              ESTABLISH SECURE SESSION
            </button>

            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setRecovery(true);
                setError('');
              }}
            >
              Forgot password?
            </button>
          </form>
        ) : (
          <div className="stack">
            <input
              placeholder="Username"
              value={recoverUser}
              onChange={(e) => setRecoverUser(e.target.value)}
            />

            <button
              className="secondary"
              onClick={getQuestion}
            >
              SHOW RECOVERY QUESTION
            </button>

            {question && (
              <form onSubmit={reset} className="stack">
                <div className="question-box">
                  {question}
                </div>

                <input
                  placeholder="Recovery answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />

                <input
                  type="password"
                  placeholder="New password (12+ chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />

                <button className="primary">
                  RESET PASSWORD
                </button>
              </form>
            )}

            <button
              className="link-btn"
              onClick={() => setRecovery(false)}
            >
              ← Back to login
            </button>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}

        <div className="security-note">
          WELCOME! Please enter your credentials to proceed.
        </div>
      </section>
    </main>
  );
}

function MandatoryPasswordChange({ user, onComplete }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();

    try {
      await api.changePassword({
        current_password: current,
        new_password: next,
      });

      const u = {
        ...user,
        must_change_password: false,
      };

      localStorage.setItem('user', JSON.stringify(u));
      onComplete(u);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">
          SECURITY GATE // FIRST LOGIN
        </div>

        <h1>Change temporary key</h1>

        <p className="muted">
          Your commander-issued credential is temporary. Operational access
          remains locked until you establish a private password.
        </p>

        <form className="stack" onSubmit={submit}>
          <input
            type="password"
            placeholder="Temporary/current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="New password (12+ characters)"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
          />

          <button className="primary">
            ESTABLISH PERMANENT KEY
          </button>
        </form>

        {error && <div className="error-box">{error}</div>}
      </section>
    </main>
  );
}

function MetricCard({
  metric,
  admin,
  onOverride,
  onRelease,
  onEmergency,
}) {
  const [value, setValue] = useState(metric.current_value);

  useEffect(() => {
    setValue(metric.current_value);
  }, [metric.current_value]);

  const outside =
    Number(metric.current_value) < Number(metric.min_value) ||
    Number(metric.current_value) > Number(metric.max_value);

  const digits =
    metric.unit === '%' ||
    Math.abs(Number(metric.current_value)) % 1 !== 0
      ? 1
      : 0;

  return (
    <article
      className={`metric-card ${
        metric.is_overridden ? 'locked' : ''
      }`}
    >
      <div className="metric-head">
        <span>{metric.domain}</span>

        <span
          className={`badge ${
            metric.is_overridden
              ? 'warning'
              : outside
                ? 'danger'
                : 'ok'
          }`}
        >
          {metric.is_overridden
            ? 'LOCKED'
            : outside
              ? 'ALERT'
              : 'LIVE'}
        </span>
      </div>

      <h3>{metric.metric_name}</h3>

      <div className="metric-value">
        {Number(metric.current_value).toFixed(digits)}
        <small>{metric.unit}</small>
      </div>

      <div className="metric-range">
        Envelope {metric.min_value} → {metric.max_value}{' '}
        {metric.unit}
      </div>

      {admin && (
        <div className="metric-actions">
          {!metric.is_overridden ? (
            <>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />

              <button
                onClick={() => onOverride(metric.id, value)}
              >
                LOCK VALUE
              </button>
            </>
          ) : (
            <button onClick={() => onRelease(metric.id)}>
              RELEASE STREAM
            </button>
          )}
        </div>
      )}

      <button
        className="danger-outline"
        onClick={() => onEmergency(metric.id)}
      >
        EMERGENCY OVERRIDE
      </button>
    </article>
  );
}

function LogisticsPanel({
  items,
  title = 'STATION LOGISTICS',
}) {
  const grouped = useMemo(
    () =>
      items.reduce((m, x) => {
        (m[x.category] ??= []).push(x);
        return m;
      }, {}),
    [items]
  );

  return (
    <section className="panel logistics-panel">
      <div className="panel-heading">
        <div>
          <div className="panel-title">{title}</div>

          <div className="panel-sub">
            Fuel, life support, consumables, mobility and communications
            readiness
          </div>
        </div>

        <span className="live-dot"></span>
      </div>

      <div className="logistics-grid">
        {Object.entries(grouped).map(([category, rows]) => (
          <div className="logistics-group" key={category}>
            <div className="group-title">{category}</div>

            {rows.map((x) => {
              const pct = x.capacity
                ? Math.max(
                    0,
                    Math.min(
                      100,
                      (Number(x.current_quantity) /
                        Number(x.capacity)) *
                        100
                    )
                  )
                : null;

              return (
                <div className="logistic-row" key={x.id}>
                  <div className="logistic-main">
                    <strong>{x.item_name}</strong>

                    <span>
                      {x.storage_location} · {x.eta}
                    </span>
                  </div>

                  <div className="logistic-number">
                    {Number(
                      x.current_quantity
                    ).toLocaleString()}
                    <small>{x.unit}</small>
                  </div>

                  <div className="logistic-status">
                    <span
                      className={`status ${String(
                        x.status
                      ).toLowerCase()}`}
                    >
                      {x.status}
                    </span>

                    {pct !== null && (
                      <div className="progress">
                        <i style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminPanel({
  stations,
  users,
  pending,
  audit,
  onRefresh,
}) {
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    station_id: stations[0]?.id || '',
    security_question: 'Assigned research vessel?',
    security_answer: '',
  });

  const [reset, setReset] = useState({
    user_id: '',
    temporary_password: '',
    security_question: '',
    security_answer: '',
  });

  const [newStation, setNewStation] = useState({
    code: '',
    name: '',
    description: '',
  });

  async function createScientist(e) {
    e.preventDefault();

    try {
      await api.createScientist(newUser);
      alert('Scientist account created.');
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function resetUser(e) {
    e.preventDefault();

    try {
      await api.resetUser(reset);
      alert('Credentials reset.');
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  async function createStation(e) {
    e.preventDefault();

    try {
      await api.createStation(newStation);
      alert('Station created.');
      onRefresh();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <section className="admin-page">
      <div className="admin-grid">
        <div className="panel">
          <div className="panel-title">
            PERSONNEL CONTROL
          </div>

          <form
            className="stack"
            onSubmit={createScientist}
          >
            <input
              placeholder="New scientist username"
              value={newUser.username}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  username: e.target.value,
                })
              }
            />

            <input
              type="password"
              placeholder="Temporary password (12+ chars)"
              value={newUser.password}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  password: e.target.value,
                })
              }
            />

            <select
              value={newUser.station_id}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  station_id: e.target.value,
                })
              }
            >
              {stations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              placeholder="Security question"
              value={newUser.security_question}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  security_question: e.target.value,
                })
              }
            />

            <input
              placeholder="Security answer"
              value={newUser.security_answer}
              onChange={(e) =>
                setNewUser({
                  ...newUser,
                  security_answer: e.target.value,
                })
              }
            />

            <button className="primary">
              ADD SCIENTIST
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title">
            ADMIN CREDENTIAL RECOVERY
          </div>

          <p className="muted">
            For a user who forgot both password and recovery
            answer.
          </p>

          <form className="stack" onSubmit={resetUser}>
            <select
              value={reset.user_id}
              onChange={(e) =>
                setReset({
                  ...reset,
                  user_id: e.target.value,
                })
              }
            >
              <option value="">Select account</option>

              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} — {u.station_name || 'HQ'}
                </option>
              ))}
            </select>

            <input
              type="password"
              placeholder="Temporary password (12+ chars)"
              value={reset.temporary_password}
              onChange={(e) =>
                setReset({
                  ...reset,
                  temporary_password: e.target.value,
                })
              }
            />

            <input
              placeholder="New security question (optional)"
              value={reset.security_question}
              onChange={(e) =>
                setReset({
                  ...reset,
                  security_question: e.target.value,
                })
              }
            />

            <input
              placeholder="New security answer (optional)"
              value={reset.security_answer}
              onChange={(e) =>
                setReset({
                  ...reset,
                  security_answer: e.target.value,
                })
              }
            />

            <button className="warning-btn">
              RESET USER CREDENTIALS
            </button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-title">
            STATION REGISTRY
          </div>

          <form className="stack" onSubmit={createStation}>
            <input
              placeholder="Station code e.g. DGR"
              value={newStation.code}
              onChange={(e) =>
                setNewStation({
                  ...newStation,
                  code: e.target.value,
                })
              }
            />

            <input
              placeholder="Station name"
              value={newStation.name}
              onChange={(e) =>
                setNewStation({
                  ...newStation,
                  name: e.target.value,
                })
              }
            />

            <input
              placeholder="Description"
              value={newStation.description}
              onChange={(e) =>
                setNewStation({
                  ...newStation,
                  description: e.target.value,
                })
              }
            />

            <button className="secondary">
              REGISTER STATION
            </button>
          </form>
        </div>
      </div>

      <div className="panel full">
        <div className="panel-heading">
          <div>
            <div className="panel-title">
              PENDING SCIENTIFIC CHANGE REQUESTS
            </div>

            <div className="panel-sub">
              Dual-key operational approval queue
            </div>
          </div>

          <span className="count-badge">
            {pending.length}
          </span>
        </div>

        {pending.length ? (
          pending.map((p) => (
            <div className="queue-row" key={p.id}>
              <div>
                <strong>
                  {p.station_name} / {p.metric_name}
                </strong>

                <div className="muted">
                  @{p.requested_by_username} proposes{' '}
                  {p.proposed_value}
                </div>

                <div className="small">
                  {p.justification}
                </div>
              </div>

              <div>
                <button
                  className="approve"
                  onClick={async () => {
                    await api.resolve({
                      request_id: p.id,
                      action: 'APPROVED',
                    });
                    onRefresh();
                  }}
                >
                  APPROVE
                </button>

                <button
                  className="reject"
                  onClick={async () => {
                    await api.resolve({
                      request_id: p.id,
                      action: 'REJECTED',
                    });
                    onRefresh();
                  }}
                >
                  REJECT
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            No pending change requests.
          </div>
        )}
      </div>

      <div className="panel full">
        <div className="panel-title">
          AUDIT HISTORY — RECENT
        </div>

        <div className="audit-list">
          {audit.map((a) => (
            <div className="audit-row" key={a.id}>
              <span>
                {new Date(a.created_at).toLocaleString()}
              </span>

              <strong>{a.action}</strong>

              <span>{a.username || 'SYSTEM'}</span>

              <span>{a.station_name || 'HQ'}</span>

              <code>{JSON.stringify(a.details)}</code>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dashboard({ user, onLogout }) {
  const [stations, setStations] = useState([]);
  const [selected, setSelected] = useState(
    user.role === 'admin' ? null : user.station_id
  );
  const [metrics, setMetrics] = useState([]);
  const [logistics, setLogistics] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [tab, setTab] = useState('mission');
  const [split, setSplit] = useState(false);
  const [passwords, setPasswords] = useState({
    current: '',
    next: '',
  });

  const [proposal, setProposal] = useState({
    metric_id: '',
    proposed_value: '',
    justification: '',
  });

  const stationMetrics = useMemo(() => {
    const m = {};

    stations.forEach((s) => {
      m[s.id] = metrics.filter(
        (x) => x.station_id === s.id
      );
    });

    return m;
  }, [stations, metrics]);

  const stationLogistics = useMemo(() => {
    const m = {};

    stations.forEach((s) => {
      m[s.id] = logistics.filter(
        (x) => x.station_id === s.id
      );
    });

    return m;
  }, [stations, logistics]);

  async function refresh() {
    try {
      const s = await api.stations();
      setStations(s);

      const sid =
        user.role === 'visiting_scientist'
          ? user.station_id
          : split
            ? null
            : selected;

      setMetrics(await api.metrics(sid));
      setLogistics(await api.logistics(sid));
      setAlerts(await api.emergencyAlerts());

      if (user.role === 'admin') {
        setPending(await api.pending());
        setUsers(await api.users());
        setAudit(await api.audit());
      } 
      else if(user.role==='visiting_scientist'){
        setPending(await api.myRequests());
      }
    } catch (e) {
      if (/session|token|unauthorized/i.test(e.message)) {
        onLogout();
      }
    }
  }

  useEffect(() => {
    const timer = setInterval(()=>{
      refresh();
    },3000);
    return()=> clearInterval(timer);
  }, [selected, split, user.role, user.station_id]);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'AUTH',
          token: localStorage.getItem('token'),
        })
      );
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'AUTH_OK') {
        ws.send(
          JSON.stringify({
            type: 'SUBSCRIBE',
            station_ids:
              user.role === 'admin'
                ? ['ALL']
                : [user.station_id],
          })
        );
      }

      if (msg.type === 'TELEMETRY_UPDATE') {
        const incoming = msg.data;

        setMetrics((prev) =>
          prev.some((m) => m.id === incoming.id)
            ? prev.map((m) =>
                m.id === incoming.id ? incoming : m
              )
            : prev
        );
      }
    };

    return () => ws.close();
  }, [user.role, user.station_id]);

  async function logout() {
    try {
      await api.logout();
    } catch {}

    localStorage.clear();
    onLogout();
  }

  async function emergency(metricId) {
    const reason = window.prompt(
      'Emergency reason / operational justification:'
    );

    if (!reason) return;

    await api.emergency({
      metric_id: metricId,
      reason,
    });

    await refresh();
  }

  async function changePassword(e) {
    e.preventDefault();

    try {
      await api.changePassword({
        current_password: passwords.current,
        new_password: passwords.next,
      });

      alert('Password changed.');

      setPasswords({
        current: '',
        next: '',
      });
    } catch (e) {
      alert(e.message);
    }
  }

  async function propose(e) {
    e.preventDefault();

    try {
      await api.propose(proposal);

      setProposal({
        metric_id: '',
        proposed_value: '',
        justification: '',
      });

      await refresh();
    } catch (e) {
      alert(e.message);
    }
  }

  const selectedStation =
    stations.find((s) => s.id === selected) ||
    stations.find((s) => s.id === user.station_id) ||
    stations[0];

  const selectedLogistics = selectedStation
    ? stationLogistics[selectedStation.id] || []
    : [];

  const selectedMetrics = selectedStation
    ? stationMetrics[selectedStation.id] || []
    : metrics;

  return (
    <div className="console">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-orbit small">N</div>

          <div>
            <strong>NCPOR</strong>
            <span>DIGITAL TWIN</span>
          </div>
        </div>

        <div className="side-status">
          <i /> SYSTEM ONLINE
        </div>

        <nav>
          <button
            className={tab === 'mission' ? 'active' : ''}
            onClick={() => setTab('mission')}
          >
            ⌂
            <span>
              {user.role === 'admin'
                ? 'Dashboard'
                : 'Home'}
            </span>
          </button>

          <button
            className={tab === 'telemetry' ? 'active' : ''}
            onClick={() => setTab('telemetry')}
          >
            ◈ <span>Telemetry</span>
          </button>

          <button
            className={tab === 'logistics' ? 'active' : ''}
            onClick={() => setTab('logistics')}
          >
            ▦ <span>Logistics</span>
          </button>

          <button
          className={tab==='seismic' ? 'active' : ''}
          onClick={()=>setTab('seismic')}
          >
            <span>Seismic Observatory</span>
          </button>

          <button
            className={tab === 'alerts' ? 'active' : ''}
            onClick={() => setTab('alerts')}
          >
            <span>Alerts</span>

            {alerts.length > 0 && (
              <b>{alerts.length}</b>
            )}
          </button>

          {user.role === 'visiting_scientist' && (
            <button
              className={tab === 'requests' ? 'active' : ''}
              onClick={() => setTab('requests')}
            >
              □ <span>Requests</span>

              {pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          )}

          {user.role === 'admin' && (
            <button
              className={tab === 'admin' ? 'active' : ''}
              onClick={() => setTab('admin')}
            >
              <span>Command Admin</span>
            </button>
          )}

          <button
            className={tab === 'security' ? 'active' : ''}
            onClick={() => setTab('security')}
          >
            ◉ <span>My Profile / Security</span>
          </button>
        </nav>

        <div className="sidebar-user">
          <span className="online-dot" />

          <strong>{user.username}</strong>

          <small>
            {user.role === 'admin'
              ? 'Station Commander'
              : 'Research Scientist'}
          </small>

          <span>
            {user.station_name || 'All Stations'}
          </span>

          <button onClick={logout}>Disconnect</button>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div>
            <div className="eyebrow">
              INDIAN ANTARCTIC PROGRAM // NCPOR
            </div>

            <h1>
              {user.role === 'admin'
                ? 'MISSION CONTROL'
                : 'RESEARCH STATION WORKSPACE'}
            </h1>
          </div>

          <div className="header-right">
            <span className="header-pill">
              ● SYSTEM ONLINE
            </span>

            <span className="header-pill">
              TELEMETRY LINK: ACTIVE
            </span>

            {user.role === 'admin' && (
              <select
                className="station-select"
                value={split ? 'split' : selected || ''}
                onChange={(e) => {
                  if (e.target.value === 'split') {
                    setSplit(true);
                  } else {
                    setSplit(false);
                    setSelected(Number(e.target.value));
                  }
                }}
              >
                <option value="split">SPLIT VIEW</option>

                {stations.map((s) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}

            <div className="avatar">
              {user.username[0]?.toUpperCase()}
            </div>
          </div>
        </header>

        {tab === 'mission' && (
          <>
            <section className={`hero-panel station-hero ${selectedStation?.name?.toLowerCase()==='bharati' ? 'bharati' : 'maitri'}`}>
              <div>
                <div className="hero-kicker">
                  {selectedStation?.name?.toUpperCase() ||
                    'ANTARCTIC STATION'}{' '}
                  RESEARCH STATION
                </div>

                <h2>
                  {selectedStation?.name || 'All Stations'}{' '}
                  <span>Operations Console</span>
                </h2>

                <p>
                  {selectedStation?.description ||
                    'Multi-station command overview with real-time telemetry, emergencies, controlled changes and logistics readiness.'}
                </p>
              </div>

              <div className="hero-stats">
                <div>
                  <small>LINK</small>
                  <strong>ACTIVE</strong>
                </div>

                <div>
                  <small>MODE</small>
                  <strong>
                    {user.role === 'admin'
                      ? 'COMMAND'
                      : 'RESEARCH'}
                  </strong>
                </div>
              </div>
            </section>

            {alerts.length > 0 && (
              <section className="alert-strip">
                <strong>
                  {alerts.length} ACTIVE EMERGENCY EVENT
                  {alerts.length > 1 ? 'S' : ''}
                </strong>

                {alerts.slice(0, 3).map((a) => (
                  <span key={a.id}>
                    {a.station_name} / {a.metric_name}
                  </span>
                ))}

                <button onClick={() => setTab('alerts')}>
                  VIEW ALERTS →
                </button>
              </section>
            )}

            {split && user.role === 'admin' ? (
              <div className="split-grid">
                {stations.map((s) => (
                  <section
                    className="station-card"
                    key={s.id}
                  >
                    <div className="station-card-head">
                      <div>
                        <span className="live-dot" />
                        {s.name}
                      </div>

                      <small>{s.code}</small>
                    </div>

                    <div className="mini-metrics">
                      {(stationMetrics[s.id] || [])
                        .slice(0, 4)
                        .map((m) => (
                          <div key={m.id}>
                            <span>{m.metric_name}</span>

                            <strong>
                              {Number(
                                m.current_value
                              ).toFixed(
                                m.unit === '%' ? 1 : 0
                              )}{' '}
                              <em>{m.unit}</em>
                            </strong>
                          </div>
                        ))}
                    </div>

                    <div className="mini-logistics">
                      {(stationLogistics[s.id] || [])
                        .filter((x) =>
                          [
                            'diesel_fuel',
                            'potable_water',
                            'food_stores',
                            'oxygen_cylinders',
                          ].includes(x.item_key)
                        )
                        .map((x) => (
                          <span key={x.id}>
                            {x.item_name}:{' '}
                            <b>
                              {Number(
                                x.current_quantity
                              ).toLocaleString()}{' '}
                              {x.unit}
                            </b>
                          </span>
                        ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <>
                <section className="kpi-grid">
                  {selectedMetrics.slice(0, 6).map((m) => (
                    <MetricCard
                      key={m.id}
                      metric={m}
                      admin={user.role === 'admin'}
                      onOverride={async (id, value) => {
                        await api.override({
                          metric_id: id,
                          manual_value: value,
                        });

                        refresh();
                      }}
                      onRelease={async (id) => {
                        await api.release({
                          metric_id: id,
                        });

                        refresh();
                      }}
                      onEmergency={emergency}
                    />
                  ))}
                </section>

                <LogisticsPanel items={selectedLogistics} />

                <section className="lower-grid">
                  <div className="panel">
                    <div className="panel-title">
                      RECENT ALERTS
                    </div>

                    {alerts.slice(0, 5).map((a) => (
                      <div className="list-row" key={a.id}>
                        <div>
                          <strong>{a.metric_name}</strong>

                          <span>
                            {a.station_name} · {a.reason}
                          </span>
                        </div>

                        <span className="status high">
                          ACTIVE
                        </span>
                      </div>
                    ))}

                    {!alerts.length && (
                      <div className="empty-state">
                        No active emergencies.
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel-title">
                      LIVE TELEMETRY
                    </div>

                    <TelemetryChart
                      metrics={selectedMetrics}
                    />
                  </div>
                </section>
              </>
            )}
          </>
        )}

        {tab === 'telemetry' && (
          <>
            <div className="section-title">
              <div>
                <div className="eyebrow">LIVE DATA</div>
                <h2>Telemetry Matrix</h2>
              </div>

              <span className="header-pill">
                WEBSOCKET STREAM
              </span>
            </div>

            <section className="kpi-grid">
              {selectedMetrics.map((m) => (
                <MetricCard
                  key={m.id}
                  metric={m}
                  admin={user.role === 'admin'}
                  onOverride={async (id, value) => {
                    await api.override({
                      metric_id: id,
                      manual_value: value,
                    });

                    refresh();
                  }}
                  onRelease={async (id) => {
                    await api.release({
                      metric_id: id,
                    });

                    refresh();
                  }}
                  onEmergency={emergency}
                />
              ))}
            </section>
          </>
        )}

        {tab === 'logistics' && (
          <>
            <div className="section-title">
              <div>
                <div className="eyebrow">
                  OPERATIONS READINESS
                </div>

                <h2>
                  {user.role === 'admin'
                    ? 'All Station Logistics'
                    : 'Station Logistics'}
                </h2>
              </div>
            </div>

            {split && user.role === 'admin' ? (
              <div className="logistics-split">
                {stations.map((s) => (
                  <LogisticsPanel
                    key={s.id}
                    items={stationLogistics[s.id] || []}
                    title={`${s.name.toUpperCase()} LOGISTICS`}
                  />
                ))}
              </div>
            ) : (
              <LogisticsPanel items={selectedLogistics} />
            )}
          </>
        )}

        {tab==='seismic'&&<SeismicObservatory/>}

        {tab === 'alerts' && (
          <section className="panel">
            <div className="panel-title">
              ACTIVE EMERGENCIES
            </div>

            {alerts.map((a) => (
              <div className="emergency-row" key={a.id}>
                <div>
                  <strong>
                    {a.station_name} / {a.metric_name}
                  </strong>

                  <span>{a.reason}</span>

                  <small>
                    Triggered by @{a.triggered_by_username} ·{' '}
                    {new Date(
                      a.created_at
                    ).toLocaleString()}
                  </small>
                </div>

                {user.role === 'admin' && (
                  <button
                    className="reject"
                    onClick={async () => {
                      await api.rollbackEmergency({
                        event_id: a.id,
                      });

                      refresh();
                    }}
                  >
                    RESOLVE
                  </button>
                )}
              </div>
            ))}

            {!alerts.length && (
              <div className="empty-state">
                No active emergencies.
              </div>
            )}
          </section>
        )}

        {tab === 'requests' &&
          user.role === 'visiting_scientist' && (
            <section className="request-layout">
              <div className="panel">
                <div className="panel-title">
                  SUBMIT CHANGE REQUEST
                </div>

                <form
                  className="stack"
                  onSubmit={propose}
                >
                  <select
                    value={proposal.metric_id}
                    required
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        metric_id: e.target.value,
                      })
                    }
                  >
                    <option value="">
                      Select asset / parameter
                    </option>

                    {selectedMetrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.metric_name}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="0.1"
                    placeholder="Proposed value"
                    value={proposal.proposed_value}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        proposed_value: e.target.value,
                      })
                    }
                  />

                  <textarea
                    placeholder="Scientific justification"
                    value={proposal.justification}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        justification: e.target.value,
                      })
                    }
                  />

                  <button className="primary">
                    SUBMIT FOR DUAL-KEY APPROVAL
                  </button>
                </form>
              </div>

              <div className="panel">
                <div className="panel-title">
                  REQUEST QUEUE
                </div>

                {pending.map((p) => (
                  <div className="list-row" key={p.id}>
                    <div>
                      <strong>{p.metric_name}</strong>

                      <span>
                        {p.station_name} · {p.proposed_value}
                      </span>
                    </div>

                    <span className="status pending">
                      {p.status}
                    </span>
                  </div>
                ))}

                {!pending.length && (
                  <div className="empty-state">
                    No pending requests.
                  </div>
                )}
              </div>
            </section>
          )}

        {tab === 'admin' && user.role === 'admin' && (
          <AdminPanel
            stations={stations}
            users={users}
            pending={pending}
            audit={audit}
            onRefresh={refresh}
          />
        )}

        {tab === 'security' && (
          <section className="panel security-panel">
            <div className="panel-title">
              ACCOUNT SECURITY
            </div>

            <form
              className="stack"
              onSubmit={changePassword}
            >
              <input
                type="password"
                placeholder="Current password"
                value={passwords.current}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    current: e.target.value,
                  })
                }
              />

              <input
                type="password"
                placeholder="New password (12+ chars)"
                value={passwords.next}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    next: e.target.value,
                  })
                }
              />

              <button className="primary">
                CHANGE PASSWORD
              </button>
            </form>

            <p className="muted">
              All sensitive actions are audited. If both password
              and recovery answer are forgotten, an administrator
              must reset the account from Command Admin.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

function TelemetryChart({ metrics }) {
  const values = metrics
    .map((m) => Number(m.current_value))
    .filter(Number.isFinite);

  if (!values.length) {
    return (
      <div className="empty-state">
        Waiting for telemetry...
      </div>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map(
      (v, i) =>
        `${(i / (values.length - 1 || 1)) * 100},${
          90 - ((v - min) / range) * 75
        }`
    )
    .join(' ');

  return (
    <div className="chart">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline points={points} />
      </svg>

      <div className="chart-labels">
        <span>LOW</span>
        <span>LIVE VALUE RANGE</span>
        <span>HIGH</span>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  });

  if (!user || !localStorage.getItem('token')) {
    return <Login onLogin={setUser} />;
  }

  if (user.must_change_password) {
    return (
      <MandatoryPasswordChange
        user={user}
        onComplete={setUser}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        localStorage.clear();
        setUser(null);
      }}
    />
  );
}