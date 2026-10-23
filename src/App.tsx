import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AdminResource, RecordData, deleteRecord, getCurrentUser, getOverview, getRegistrationStatus, getResource, health, loginDashboard, registerDashboard, saveRecord } from './api';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'checkbox' | 'url' | 'select'; required?: boolean; options?: string[]; hint?: string; related?: AdminResource };
type ResourceConfig = { title: string; singular: string; eyebrow: string; fields: Field[]; columns: string[] };

const resourceConfig: Record<AdminResource, ResourceConfig> = {
  competitions: { title: 'Competitions', singular: 'competition', eyebrow: 'TOURNAMENT SETUP', fields: [
    { key: 'name', label: 'Competition name', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'season', label: 'Season', required: true, hint: 'Example: 2027' }, { key: 'country', label: 'Region or host', hint: 'Africa' }, { key: 'startsAt', label: 'Start date', type: 'datetime-local' }, { key: 'endsAt', label: 'End date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'season', 'country', 'starts_at', 'published'] },
  matches: { title: 'Matches', singular: 'match', eyebrow: 'FIXTURES & RESULTS', fields: [
    { key: 'competitionId', label: 'Competition', required: true, related: 'competitions' }, { key: 'stage', label: 'Stage' }, { key: 'groupCode', label: 'Group' }, { key: 'homeTeamId', label: 'Home team', required: true, related: 'teams' }, { key: 'awayTeamId', label: 'Away team', required: true, related: 'teams' }, { key: 'venueId', label: 'Venue', related: 'venues' }, { key: 'kickoffAt', label: 'Kick-off time', type: 'datetime-local', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'live', 'half_time', 'finished', 'postponed', 'cancelled'] }, { key: 'homeScore', label: 'Home score', type: 'number' }, { key: 'awayScore', label: 'Away score', type: 'number' }, { key: 'broadcast', label: 'Broadcast' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['kickoff_at', 'home_team_id', 'away_team_id', 'status', 'published'] },
  teams: { title: 'Teams', singular: 'team', eyebrow: 'NATIONAL TEAMS', fields: [
    { key: 'name', label: 'Team name', required: true }, { key: 'shortName', label: 'Short name' }, { key: 'countryCode', label: 'Country code', hint: 'Three letters, for example UGA' }, { key: 'region', label: 'African region' }, { key: 'crestUrl', label: 'Crest image URL', type: 'url' }, { key: 'coach', label: 'Head coach' }, { key: 'competitionId', label: 'Competition', related: 'competitions' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'region', 'coach', 'published'] },
  players: { title: 'Players', singular: 'player', eyebrow: 'SQUADS & PROFILES', fields: [
    { key: 'name', label: 'Player name', required: true }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'competitionId', label: 'Competition', related: 'competitions' }, { key: 'position', label: 'Position' }, { key: 'shirtNumber', label: 'Shirt number', type: 'number' }, { key: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { key: 'club', label: 'Club' }, { key: 'photoUrl', label: 'Player photo URL', type: 'url' }, { key: 'stats', label: 'Statistics JSON', type: 'textarea', hint: 'Example: {"goals": 2, "assists": 1}' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'team_id', 'position', 'shirt_number', 'published'] },
  standings: { title: 'Groups & tables', singular: 'standing row', eyebrow: 'COMPETITION TABLES', fields: [
    { key: 'competitionId', label: 'Competition', required: true, related: 'competitions' }, { key: 'groupCode', label: 'Group', required: true }, { key: 'teamId', label: 'Team', required: true, related: 'teams' }, { key: 'position', label: 'Position', type: 'number', required: true }, { key: 'played', label: 'Played', type: 'number' }, { key: 'won', label: 'Won', type: 'number' }, { key: 'drawn', label: 'Drawn', type: 'number' }, { key: 'lost', label: 'Lost', type: 'number' }, { key: 'goalsFor', label: 'Goals for', type: 'number' }, { key: 'goalsAgainst', label: 'Goals against', type: 'number' }, { key: 'goalDifference', label: 'Goal difference', type: 'number' }, { key: 'points', label: 'Points', type: 'number' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['group_code', 'team_id', 'position', 'played', 'goal_difference', 'points', 'published'] },
  'match-events': { title: 'Match events', singular: 'match event', eyebrow: 'GOALS, CARDS & CHANGES', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'playerId', label: 'Player', related: 'players' }, { key: 'relatedPlayerId', label: 'Related player', hint: 'For assists or substitutions', related: 'players' }, { key: 'eventType', label: 'Event type', type: 'select', required: true, options: ['goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution', 'var', 'kickoff', 'half_time', 'full_time'] }, { key: 'minute', label: 'Minute', type: 'number', required: true }, { key: 'addedTime', label: 'Added time', type: 'number' }, { key: 'detail', label: 'Event details', type: 'textarea' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['match_id', 'event_type', 'minute', 'team_id', 'player_id', 'published'] },
  'match-statistics': { title: 'Match statistics', singular: 'match statistic', eyebrow: 'LIVE MATCH DATA', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'statistic', label: 'Statistic name', required: true, hint: 'Example: possession' }, { key: 'homeValue', label: 'Home value', type: 'number' }, { key: 'awayValue', label: 'Away value', type: 'number' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['match_id', 'statistic', 'home_value', 'away_value', 'published'] },
  lineups: { title: 'Line-ups', singular: 'line-up entry', eyebrow: 'MATCH SQUADS', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'teamId', label: 'Team', required: true, related: 'teams' }, { key: 'playerId', label: 'Player', required: true, related: 'players' }, { key: 'isStarting', label: 'Starting player', type: 'checkbox' }, { key: 'shirtNumber', label: 'Shirt number', type: 'number' }, { key: 'position', label: 'Position' }, { key: 'formation', label: 'Formation', hint: 'Example: 4-3-3' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['match_id', 'team_id', 'player_id', 'is_starting', 'shirt_number', 'published'] },
  venues: { title: 'Venues', singular: 'venue', eyebrow: 'STADIUM GUIDE', fields: [
    { key: 'name', label: 'Stadium name', required: true }, { key: 'city', label: 'City', required: true }, { key: 'country', label: 'Country' }, { key: 'address', label: 'Street address' }, { key: 'capacity', label: 'Capacity', type: 'number' }, { key: 'latitude', label: 'Latitude', type: 'number' }, { key: 'longitude', label: 'Longitude', type: 'number' }, { key: 'timezone', label: 'Timezone', hint: 'Example: Africa/Kampala' }, { key: 'accessibilityInfo', label: 'Accessibility', type: 'textarea' }, { key: 'transportInfo', label: 'Transport information', type: 'textarea' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'city', 'country', 'capacity', 'published'] },
  news: { title: 'News & updates', singular: 'article', eyebrow: 'EDITORIAL', fields: [
    { key: 'title', label: 'Headline', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'summary', label: 'Summary', type: 'textarea' }, { key: 'body', label: 'Article body', type: 'textarea' }, { key: 'author', label: 'Author' }, { key: 'category', label: 'Category' }, { key: 'region', label: 'Region' }, { key: 'imageUrl', label: 'Image URL', type: 'url' }, { key: 'imageRights', label: 'Image rights / attribution' }, { key: 'publishedAt', label: 'Publish date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'category', 'author', 'published_at', 'published'] },
  events: { title: 'Fan events', singular: 'event', eyebrow: 'HOST CITIES', fields: [
    { key: 'title', label: 'Event name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'city', label: 'City', required: true }, { key: 'region', label: 'Region' }, { key: 'venueId', label: 'Venue', related: 'venues' }, { key: 'startsAt', label: 'Starts at', type: 'datetime-local', required: true }, { key: 'endsAt', label: 'Ends at', type: 'datetime-local' }, { key: 'bookingUrl', label: 'Booking URL', type: 'url' }, { key: 'organizer', label: 'Organizer' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'city', 'starts_at', 'organizer', 'published'] },
  media: { title: 'Media library', singular: 'media item', eyebrow: 'PHOTOS & VIDEO', fields: [
    { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'mediaType', label: 'Media type', type: 'select', required: true, options: ['image', 'video', 'audio'] }, { key: 'url', label: 'Asset URL', type: 'url', required: true }, { key: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url' }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'territory', label: 'Licensed territory' }, { key: 'rightsStart', label: 'Rights start', type: 'datetime-local' }, { key: 'rightsEnd', label: 'Rights end', type: 'datetime-local' }, { key: 'publishedAt', label: 'Publish date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'media_type', 'territory', 'rights_end', 'published'] },
};

const nav: { label: string; resource?: AdminResource; icon: string }[] = [
  { label: 'Overview', icon: '⌂' },
  { label: 'Matches', resource: 'matches', icon: '◉' },
  { label: 'Competitions', resource: 'competitions', icon: '◈' },
  { label: 'Teams', resource: 'teams', icon: '♧' },
  { label: 'Players', resource: 'players', icon: '♙' },
  { label: 'Groups & tables', resource: 'standings', icon: '▤' },
  { label: 'Match events', resource: 'match-events', icon: '⌁' },
  { label: 'Match statistics', resource: 'match-statistics', icon: '▥' },
  { label: 'Line-ups', resource: 'lineups', icon: '☷' },
  { label: 'Venues', resource: 'venues', icon: '⌖' },
  { label: 'News & updates', resource: 'news', icon: '▧' },
  { label: 'Fan events', resource: 'events', icon: '▦' },
  { label: 'Media library', resource: 'media', icon: '▷' },
];

const metricConfig = [
  { key: 'matches', label: 'Matches', icon: '◉', tone: 'green' },
  { key: 'teams', label: 'Teams', icon: '♧', tone: 'blue' },
  { key: 'players', label: 'Players', icon: '♙', tone: 'gold' },
  { key: 'articles', label: 'Articles', icon: '▧', tone: 'violet' },
] as const;

const chartKeys = ['matches', 'teams', 'players', 'articles', 'events', 'venues'] as const;

function pretty(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Published' : 'Draft';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function dateInputValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return date.toISOString().slice(0, 16);
}

function recordField(record: RecordData | null | false, key: string): unknown {
  if (!record || typeof record !== 'object') return '';
  const databaseKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return record[key] ?? record[databaseKey] ?? '';
}

function relatedLabel(record: RecordData): string {
  if (record.home_team && record.away_team) {
    const kickoff = record.kickoff_at ? new Date(String(record.kickoff_at)).toLocaleDateString() : '';
    return `${record.home_team} vs ${record.away_team}${kickoff ? ` · ${kickoff}` : ''}`;
  }
  const name = String(record.name ?? record.title ?? record.slug ?? 'Record');
  return record.season ? `${name} · ${record.season}` : name;
}

function App() {
  const [apiOnline, setApiOnline] = useState(false);
  const [tokenDraft, setTokenDraft] = useState('');
  const [token, setToken] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [accountName, setAccountName] = useState('Admin');
  const [activeLabel, setActiveLabel] = useState('Overview');
  const [overview, setOverview] = useState<Record<string, number>>({});
  const [rows, setRows] = useState<RecordData[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<RecordData | null | false>(false);
  const [saving, setSaving] = useState(false);
  const [lookups, setLookups] = useState<Record<string, RecordData[]>>({});

  const activeNav = nav.find((item) => item.label === activeLabel) ?? nav[0];
  const activeResource = activeNav.resource;
  const config = activeResource ? resourceConfig[activeResource] : null;

  useEffect(() => {
    let alive = true;
    health().then((value) => { if (alive) setApiOnline(value); });
    const timer = window.setInterval(() => health().then((value) => { if (alive) setApiOnline(value); }), 15000);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    let alive = true;
    async function restoreSession() {
      const saved = sessionStorage.getItem('afconDashboardSession');
      if (saved) {
        try {
          const user = await getCurrentUser(saved);
          if (!alive) return;
          setToken(saved);
          setAccountName(user.display_name || user.email);
          setAuthReady(true);
          return;
        } catch {
          sessionStorage.removeItem('afconDashboardSession');
        }
      }
      try {
        const status = await getRegistrationStatus();
        if (!alive) return;
        setRegistrationOpen(status.registrationOpen);
        setAuthMode(status.registrationOpen ? 'register' : 'login');
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not reach the backend.');
      } finally {
        if (alive) setAuthReady(true);
      }
    }
    restoreSession();
    return () => { alive = false; };
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = authMode === 'register'
        ? await registerDashboard(nameDraft.trim(), emailDraft.trim(), passwordDraft)
        : await loginDashboard(emailDraft.trim(), passwordDraft);
      sessionStorage.setItem('afconDashboardSession', result.token);
      setToken(result.token);
      setAccountName(result.user.display_name || result.user.email);
      setRegistrationOpen(false);
      setNotice(authMode === 'register' ? 'Owner account created.' : 'Signed in successfully.');
      try { setOverview((await getOverview(result.token)).data); } catch { setOverview({}); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in to the backend.');
    } finally {
      setBusy(false);
    }
  }

  async function loadResource(resource: AdminResource, currentToken = token) {
    if (!currentToken) return;
    setBusy(true);
    setError('');
    try {
      const result = await getResource(currentToken, resource);
      setRows(result.data);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Could not load records.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token && activeResource) loadResource(activeResource);
    else setRows([]);
    // load only when the selected section or token changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResource, token]);

  useEffect(() => {
    let alive = true;
    const related = editor !== false && config
      ? [...new Set(config.fields.flatMap((field) => field.related ? [field.related] : []))]
      : [];
    setLookups({});
    if (!token || related.length === 0) return () => { alive = false; };
    Promise.all(related.map(async (resource) => [resource, await getResource(token, resource).then((result) => result.data)] as const))
      .then((entries) => {
        if (!alive) return;
        const byResource = Object.fromEntries(entries);
        const byField: Record<string, RecordData[]> = {};
        for (const field of config?.fields ?? []) if (field.related) byField[field.key] = byResource[field.related] ?? [];
        setLookups(byField);
      })
      .catch(() => { if (alive) setLookups({}); });
    return () => { alive = false; };
  }, [editor, activeResource, token]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? rows.filter((row) => Object.values(row).some((value) => pretty(value).toLowerCase().includes(query))) : rows;
  }, [rows, search]);

  function navigate(label: string) {
    setActiveLabel(label);
    setSearch('');
    setError('');
    setNotice('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeResource || !config || !token) return;
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const value: RecordData = {};
    for (const field of config.fields) {
      const raw = form.get(field.key);
      if (field.type === 'checkbox') {
        value[field.key] = raw === 'on';
      } else if (raw !== null && String(raw).trim() !== '') {
        let normalized: unknown = String(raw).trim();
        if (field.type === 'number') normalized = Number(normalized);
        if (field.type === 'datetime-local') normalized = new Date(String(normalized)).toISOString();
        if (field.key === 'stats') {
          try { normalized = JSON.parse(String(normalized)); }
          catch { setError('Statistics must be valid JSON.'); setSaving(false); return; }
        }
        value[field.key] = normalized;
      }
    }
    const id = editor && typeof editor === 'object'
      ? activeResource === 'match-statistics'
        ? `${editor.match_id}:${editor.statistic}`
        : String(editor.id ?? '')
      : undefined;
    try {
      await saveRecord(token, activeResource, value, id || undefined);
      setEditor(false);
      setNotice(`${config.singular[0].toUpperCase()}${config.singular.slice(1)} ${id ? 'updated' : 'created'}.`);
      await loadResource(activeResource);
      const summary = await getOverview(token);
      setOverview(summary.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The record could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(row: RecordData) {
    if (!activeResource || !token || (!row.id && activeResource !== 'match-statistics')) return;
    const name = String(row.name ?? row.title ?? config?.singular ?? 'record');
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;
    setBusy(true);
    setError('');
    try {
      const id = activeResource === 'match-statistics' ? `${row.match_id}:${row.statistic}` : String(row.id);
      await deleteRecord(token, activeResource, id);
      setNotice(`${config?.singular ?? 'Record'} deleted.`);
      const [resourceResult, summary] = await Promise.all([getResource(token, activeResource), getOverview(token)]);
      setRows(resourceResult.data);
      setOverview(summary.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The record could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) return <main className="auth-shell"><section className="auth-card"><div className="brand-ball">AF</div><span className="eyebrow">AFCON FAN CONTROL ROOM</span><h1>Checking your session</h1><p>Connecting to the dashboard securely?</p></section></main>;

  if (!token) return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-ball">AF</div>
        <span className="eyebrow">{authMode === 'register' ? 'FIRST-TIME SETUP' : 'SECURE DASHBOARD ACCESS'}</span>
        <h1>{authMode === 'register' ? 'Create owner account' : 'Welcome back'}</h1>
        <p>{authMode === 'register' ? 'Set up the owner account for the AFCON Fan dashboard.' : 'Sign in to manage content shown in the AFCON Fan app.'}</p>
        <form className="auth-form" onSubmit={connect}>
          {authMode === 'register' && <label>Your name<input autoComplete="name" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} required /></label>}
          <label>Email address<input type="email" autoComplete="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete={authMode === 'register' ? 'new-password' : 'current-password'} minLength={authMode === 'register' ? 12 : undefined} value={passwordDraft} onChange={(event) => setPasswordDraft(event.target.value)} required />{authMode === 'register' && <small>Use at least 12 characters.</small>}</label>
          {error && <div className="auth-error">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Please wait?' : authMode === 'register' ? 'Create account' : 'Sign in'}</button>
        </form>
        <button className="auth-switch" onClick={() => { setError(''); setAuthMode(authMode === 'register' ? 'login' : 'register'); }}>{authMode === 'register' ? 'Already have an account? Sign in' : 'Create the first owner account'}</button>
        {!apiOnline && <div className="auth-hint">Backend not reachable. Check the API at <code>http://localhost:8080</code> and allow the Vite origin in ALLOWED_ORIGINS.</div>}
      </section>
      <div className="auth-footer">OFFICIAL AFCON FAN CONTROL ROOM <span>Competition updates. One trusted source.</span></div>
    </main>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-ball">AF</div>
          <div><strong>AFCON FAN</strong><span>CONTROL ROOM</span></div>
        </div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="nav-list">
          {nav.map((item) => (
            <button key={item.label} className={`nav-item ${activeLabel === item.label ? 'active' : ''}`} onClick={() => navigate(item.label)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {activeLabel === item.label && <span className="nav-active-mark" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help-icon">?</div>
          <div><strong>Need a hand?</strong><span>Read the dashboard guide</span></div>
          <span className="sidebar-arrow">↗</span>
        </div>
        <div className="sidebar-user"><div className="user-avatar">AD</div><div><strong>Admin workspace</strong><span>AFCON FAN</span></div><button title="Disconnect" onClick={() => { sessionStorage.removeItem('afconDashboardSession'); setToken(''); setOverview({}); setRows([]); setAuthMode('login'); setNotice('Signed out.'); }}>↪</button></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>AFCON FAN</span><i>/</i><strong>{activeLabel}</strong></div>
          <div className="top-actions">
            <span className={`connection-pill ${apiOnline ? 'online' : 'offline'}`}><i />{apiOnline ? 'API online' : 'API offline'}</span>
            <button className="top-icon" title="Notifications">♧<b /></button>
            <div className="top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          {error && <div className="toast error"><span>!</span>{error}<button onClick={() => setError('')}>×</button></div>}
          {notice && <div className="toast success"><span>✓</span>{notice}<button onClick={() => setNotice('')}>×</button></div>}

          {activeLabel === 'Overview' ? (
            <>
              <div className="page-heading"><div><div className="eyebrow">THURSDAY, MATCHDAY CONTROL</div><h1>Good morning, {accountName.split(' ')[0]} <span>✦</span></h1><p>Here’s the latest overview of your tournament workspace.</p></div><button className="button button-light" onClick={() => token ? getOverview(token).then((result) => setOverview(result.data)).catch((err) => setError(String(err))) : setError('Connect the backend to refresh tournament data.')}>↻ <span>Refresh data</span></button></div>
              {!token && <section className="connect-card"><div className="connect-symbol">⌘</div><div className="connect-copy"><strong>Connect your admin API</strong><span>Enter the ADMIN_API_TOKEN from backend/.env. The token stays in this browser session only.</span></div><form onSubmit={connect}><input type="password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} placeholder="Admin API token" aria-label="Admin API token" /><button className="button button-primary" disabled={busy}>{busy ? 'Connecting…' : 'Connect'}</button></form></section>}
              <section className="hero-card"><div className="hero-pattern" /><div className="hero-copy"><div className="hero-kicker"><span className="hero-dot" /> TOURNAMENT OPERATIONS</div><h2>Everything fans need,<br />ready for matchday.</h2><p>Manage verified fixtures, team profiles and stories from one place.</p><button className="button button-gold" onClick={() => navigate('Matches')}>Manage matches <span>→</span></button></div><div className="hero-pitch"><div className="pitch-line center-line" /><div className="pitch-circle" /><div className="pitch-box pitch-left" /><div className="pitch-box pitch-right" /><div className="pitch-ball">⚽</div></div><div className="hero-footnote"><span>✦</span> Together in football</div></section>
              <div className="section-title-row"><div><h2>Workspace overview</h2><p>Content totals across the tournament</p></div><div className="period-tag">ALL CONTENT <span>⌄</span></div></div>
              <section className="metric-grid">{metricConfig.map((metric) => <article className="metric-card" key={metric.key}><div className={`metric-icon ${metric.tone}`}>{metric.icon}</div><div className="metric-label">{metric.label}</div><strong>{overview[metric.key] ?? '—'}</strong><div className="metric-foot"><span className="metric-live-dot" /> {token ? `${overview.published_matches ?? 0} matches published` : 'Connect to load live totals'}</div><span className="metric-more">•••</span></article>)}</section>
              <section className="overview-bottom"><article className="panel activity-panel"><div className="panel-heading"><div><h3>Content at a glance</h3><p>Draft and published content</p></div><button onClick={() => navigate('News & updates')}>Open editorial <span>→</span></button></div><div className="activity-chart"><div className="chart-y"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><div className="chart-area"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="chart-bars">{['Matches', 'Teams', 'Players', 'Articles', 'Events', 'Venues'].map((label, index) => { const count = overview[chartKeys[index]] ?? 0; return <div className="bar-group" key={label}><div className="bar-pair"><i style={{ height: `${token ? Math.min(100, Math.max(5, count * 12)) : 0}%` }} /><i style={{ height: `${token ? Math.min(100, Math.max(4, count * 7)) : 0}%` }} /></div><span>{label}</span></div>; })}</div></div></div><div className="chart-legend"><span><i className="legend-a" /> Total records</span><span><i className="legend-b" /> Published</span></div></article><article className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Jump into a common task</p></div></div><div className="quick-actions">{[{ label: 'Add a fixture', resource: 'Matches', icon: '◉', color: 'green' }, { label: 'Add a team', resource: 'Teams', icon: '♧', color: 'blue' }, { label: 'Write an update', resource: 'News & updates', icon: '▧', color: 'gold' }, { label: 'Add a venue', resource: 'Venues', icon: '⌖', color: 'violet' }].map((item) => <button key={item.label} onClick={() => { navigate(item.resource); setEditor(null); }}><span className={`quick-icon ${item.color}`}>{item.icon}</span><strong>{item.label}</strong><span className="quick-arrow">→</span></button>)}</div></article></section>
              <section className="bottom-strip"><div className="verified-mark">✓</div><div><strong>Keep tournament data verified</strong><span>Review source and kick-off details before publishing content to fans.</span></div><button onClick={() => navigate('Matches')}>Review fixtures <span>→</span></button></section>
            </>
          ) : (
            <>
              <div className="page-heading resource-heading"><div><div className="eyebrow">{config?.eyebrow}</div><h1>{config?.title}</h1><p>Manage records shown in the AFCON Fan app.</p></div><button className="button button-primary" onClick={() => token ? setEditor(null) : setError('Connect the admin API from Overview before editing records.')}><span>＋</span> Add {config?.singular}</button></div>
              {!token && <section className="connect-card"><div className="connect-symbol">⌘</div><div className="connect-copy"><strong>Admin connection needed</strong><span>Connect your backend token from Overview to view or edit records.</span></div><button className="button button-primary" onClick={() => navigate('Overview')}>Open overview</button></section>}
              <section className="panel records-panel"><div className="records-toolbar"><div><h2>{config?.title} <span>{rows.length}</span></h2><p>Manage and publish tournament information</p></div><div className="records-tools"><div className="table-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></div><button className="button button-light" onClick={() => activeResource && loadResource(activeResource)}>↻</button></div></div>{busy ? <div className="table-empty"><div className="spinner" /><strong>Loading records…</strong></div> : !token ? <div className="table-empty"><span className="empty-icon">⌘</span><strong>Connect to load {config?.title.toLowerCase()}</strong><p>Your content will appear here once the backend is connected.</p></div> : filteredRows.length === 0 ? <div className="table-empty"><span className="empty-icon">＋</span><strong>{search ? 'No matching records' : `No ${config?.title.toLowerCase()} yet`}</strong><p>{search ? 'Try a different search.' : `Add your first ${config?.singular} to start filling the app.`}</p>{!search && <button className="button button-primary" onClick={() => setEditor(null)}>Add {config?.singular}</button>}</div> : <div className="table-scroll"><table><thead><tr>{config?.columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}<th /></tr></thead><tbody>{filteredRows.map((row, index) => <tr key={String(row.id ?? index)}>{config?.columns.map((column) => <td key={column}>{column === 'published' ? <span className={`status-tag ${row[column] ? 'published' : 'draft'}`}><i />{row[column] ? 'Published' : 'Draft'}</span> : column.endsWith('_at') && row[column] ? new Date(String(row[column])).toLocaleString() : <span title={pretty(row[column])}>{pretty(row[column])}</span>}</td>)}<td><div className="row-actions"><button className="row-edit" onClick={() => setEditor(row)} aria-label={`Edit ${config?.singular}`}>Edit</button><button className="row-delete" onClick={() => removeRecord(row)} aria-label={`Delete ${config?.singular}`}>Delete</button></div></td></tr>)}</tbody></table></div>}</section>
              <div className="records-note"><span>ⓘ</span>Only published records appear in the fan app. Confirm rights, source and dates before publishing.</div>
            </>
          )}
        </div>
      </main>

      {editor !== false && config && activeResource && <div className="modal-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(false); }}><form className="editor-modal" onSubmit={save}><div className="modal-header"><div><div className="eyebrow">{editor && typeof editor === 'object' ? 'EDIT RECORD' : 'NEW RECORD'}</div><h2>{editor && typeof editor === 'object' ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2></div><button type="button" className="modal-close" onClick={() => setEditor(false)}>×</button></div><div className="modal-fields">{config.fields.map((field) => { const currentValue = recordField(editor, field.key); return <label key={field.key} className={`form-field ${field.type === 'textarea' ? 'wide' : ''} ${field.type === 'checkbox' ? 'check-field' : ''}`}><span>{field.label}{field.required && <i> *</i>}</span>{field.type === 'checkbox' ? <input name={field.key} type="checkbox" defaultChecked={Boolean(currentValue)} /> : field.type === 'textarea' ? <textarea name={field.key} defaultValue={field.key === 'stats' ? JSON.stringify(currentValue || {}, null, 2) : String(currentValue)} placeholder={field.hint} rows={field.key === 'body' ? 5 : 3} required={field.required} /> : field.related ? <select name={field.key} defaultValue={String(currentValue)} required={field.required}><option value="">Select {field.label.toLowerCase()}…</option>{(lookups[field.key] ?? []).map((option) => <option key={String(option.id)} value={String(option.id)}>{relatedLabel(option)}</option>)}</select> : field.type === 'select' ? <select name={field.key} defaultValue={String(currentValue)} required={field.required}><option value="">Select…</option>{field.options?.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select> : <input name={field.key} type={field.type ?? 'text'} defaultValue={field.type === 'datetime-local' ? dateInputValue(currentValue) : String(currentValue)} placeholder={field.hint} required={field.required} />}{field.hint && field.type !== 'text' && <small>{field.hint}</small>}</label>; })}</div><div className="modal-footer"><button type="button" className="button button-light" onClick={() => setEditor(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button></div></form></div>}
    </div>
  );
}

export default App;
