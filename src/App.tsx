import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { AdminResource, ApiError, RecordData, deleteRecord, getOverview, getResource, health, saveLineupBatch, saveRecord, uploadPlayerImage, uploadVenueImage } from './api';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'checkbox' | 'url' | 'select' | 'file' | 'stats'; required?: boolean; options?: string[]; hint?: string; related?: AdminResource };
type ResourceConfig = { title: string; singular: string; eyebrow: string; fields: Field[]; columns: string[]; allowCreate?: boolean; allowDelete?: boolean };

const playerStatOptions = [
  { key: 'appearances', label: 'Appearances' },
  { key: 'minutes_played', label: 'Minutes played' },
  { key: 'goals', label: 'Goals' },
  { key: 'assists', label: 'Assists' },
  { key: 'yellow_cards', label: 'Yellow cards' },
  { key: 'red_cards', label: 'Red cards' },
  { key: 'penalty_goals', label: 'Penalty goals' },
  { key: 'shots', label: 'Shots' },
  { key: 'shots_on_target', label: 'Shots on target' },
  { key: 'dribbles_attempted', label: 'Dribbles attempted' },
  { key: 'successful_dribbles', label: 'Successful dribbles' },
  { key: 'times_fouled', label: 'Times fouled' },
  { key: 'big_chances_created', label: 'Big chances created' },
  { key: 'big_chances_missed', label: 'Big chances missed' },
  { key: 'distance_covered_km', label: 'Distance covered (km)' },
  { key: 'sprints', label: 'Sprints' },
  { key: 'clean_sheets', label: 'Clean sheets' },
  { key: 'saves', label: 'Saves' },
  { key: 'penalty_saves', label: 'Penalty saves' },
] as const;

const lineupPositionOptions = ['GK', 'RB', 'CB', 'LB', 'RWB', 'LWB', 'DM', 'CM', 'AM', 'RM', 'LM', 'RW', 'LW', 'ST', 'CF'];
const formationOptions = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2', '3-4-3', '4-1-4-1'];

type LineupPlayer = {
  playerId: string;
  position: string;
  shirtNumber: string;
  isStarting: boolean;
};

function existingLineupPlayers(
  rows: RecordData[],
  matchId: string,
  teamId: string,
): LineupPlayer[] {
  if (!matchId || !teamId) return [];
  return rows
    .filter((row) => row.match_id === matchId && row.team_id === teamId)
    .map((row) => ({
      playerId: String(row.player_id ?? ''),
      position: String(row.position ?? 'CM'),
      shirtNumber: row.shirt_number == null ? '' : String(row.shirt_number),
      isStarting: Boolean(row.is_starting),
    }));
}

type LineupLine = 'attack' | 'advanced' | 'midfield' | 'defence' | 'goalkeeper';

function lineupLine(position: string, formation: string): LineupLine {
  const value = position.toUpperCase();
  if (['GK', 'GOALKEEPER'].includes(value)) return 'goalkeeper';
  if (['RB', 'LB', 'CB', 'RWB', 'LWB', 'DEF', 'DEFENDER'].includes(value)) return 'defence';
  if (['ST', 'CF', 'FW', 'RF', 'LF', 'FORWARD', 'STRIKER'].includes(value)) return 'attack';
  if (['4-2-3-1', '4-1-4-1'].includes(formation) && ['AM', 'RM', 'LM', 'RW', 'LW'].includes(value)) return 'advanced';
  if (formation === '3-5-2' && ['RW', 'LW', 'RM', 'LM'].includes(value)) return 'midfield';
  if (['RW', 'LW'].includes(value)) return 'attack';
  return 'midfield';
}

function LineupGraphic({
  teamName,
  formation,
  players,
  compact = false,
}: {
  teamName: string;
  formation: string;
  players: RecordData[];
  compact?: boolean;
}) {
  const starters = players.filter((player) => Boolean(player.is_starting));
  const substitutes = players.filter((player) => !player.is_starting);
  const lineOrder: LineupLine[] = ['attack', 'advanced', 'midfield', 'defence', 'goalkeeper'];
  const lines = lineOrder.map((line) => starters.filter((player) =>
    lineupLine(String(player.position ?? ''), formation || '') === line,
  ));
  return (
    <div className={`lineup-graphic ${compact ? 'compact' : ''}`}>
      <header className="lineup-graphic-header">
        <div><span>CONFIRMED LINE-UP</span><strong>{teamName || 'Team'}</strong></div>
        <b>{formation || 'Formation TBC'}</b>
      </header>
      <div className="lineup-pitch">
        <div className="lineup-pitch-half" />
        <div className="lineup-center-circle" />
        {lines.map((linePlayers, lineIndex) => (
          <div className="lineup-pitch-row" key={lineOrder[lineIndex]}>
            {linePlayers.map((player) => (
              <div className="lineup-pitch-player" key={String(player.player_id ?? player.playerId)}>
                {player.photo_url ? (
                  <img src={String(player.photo_url)} alt="" />
                ) : (
                  <span className="lineup-player-initial">{String(player.player_name ?? player.name ?? '?').slice(0, 1)}</span>
                )}
                <b>{String(player.player_name ?? player.name ?? 'Player')}</b>
                <small>{String(player.position ?? '')}{player.shirt_number == null ? '' : ` · #${player.shirt_number}`}</small>
              </div>
            ))}
          </div>
        ))}
      </div>
      {!compact && substitutes.length > 0 && (
        <footer className="lineup-substitutes">
          <strong>Substitutes</strong>
          <span>          {substitutes.map((player) => `${String(player.player_name ?? player.name ?? 'Player')}${player.position ? ` (${String(player.position)})` : ''}`).join(' · ')}</span>
        </footer>
      )}
    </div>
  );
}

function LineupDashboardPreview({ rows }: { rows: RecordData[] }) {
  const groups = new Map<string, RecordData[]>();
  for (const row of rows) {
    const key = `${String(row.match_id)}:${String(row.team_id)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const previews = [...groups.entries()].slice(0, 4);
  if (!previews.length) return null;
  return (
    <section className="lineup-preview-section">
      <div className="section-title-row"><div><h2>Line-up previews</h2><p>Starting players arranged by their positions</p></div></div>
      <div className="lineup-preview-grid">
        {previews.map(([key, players]) => (
          <LineupGraphic
            key={key}
            teamName={String(players[0]?.team_name ?? 'Team')}
            formation={String(players[0]?.formation ?? '')}
            players={players}
            compact
          />
        ))}
      </div>
    </section>
  );
}

function LineupEditor({
  lookups,
  rows,
  editor,
}: {
  lookups: Record<string, RecordData[]>;
  rows: RecordData[];
  editor: RecordData | null | false;
}) {
  const initialMatch = editor && typeof editor === 'object' ? String(editor.match_id ?? '') : '';
  const initialTeam = editor && typeof editor === 'object' ? String(editor.team_id ?? '') : '';
  const [matchId, setMatchId] = useState(initialMatch);
  const [teamId, setTeamId] = useState(initialTeam);
  const [formation, setFormation] = useState(
    editor && typeof editor === 'object' ? String(editor.formation ?? '4-3-3') : '4-3-3',
  );
  const [published, setPublished] = useState(
    editor && typeof editor === 'object' ? Boolean(editor.published) : false,
  );
  const [players, setPlayers] = useState(() => existingLineupPlayers(rows, initialMatch, initialTeam));
  const matches = lookups.matchId ?? [];
  const allTeams = lookups.teamId ?? [];
  const allPlayers = lookups.playerId ?? [];
  const selectedMatch = matches.find((match) => String(match.id) === matchId);
  const teamIds = selectedMatch
    ? [String(selectedMatch.home_team_id ?? ''), String(selectedMatch.away_team_id ?? '')].filter(Boolean)
    : [];
  const teams = allTeams.filter((team) => teamIds.includes(String(team.id)));
  const roster = allPlayers.filter((player) => String(player.team_id ?? '') === teamId);
  const previewPlayers = players.map((player) => {
    const record = roster.find((item) => String(item.id) === player.playerId);
    return {
      ...player,
      player_id: player.playerId,
      player_name: record?.name ?? 'Player',
      photo_url: record?.photo_url,
      shirt_number: player.shirtNumber ? Number(player.shirtNumber) : null,
    };
  });
  const previewTeamName = teams.find((team) => String(team.id) === teamId)?.name;

  function changeMatch(value: string) {
    setMatchId(value);
    setTeamId('');
    setPlayers([]);
  }

  function changeTeam(value: string) {
    setTeamId(value);
    setPlayers(existingLineupPlayers(rows, matchId, value));
  }

  return (
    <div className="lineup-editor">
      <input
        type="hidden"
        name="lineupBatch"
        value={JSON.stringify({
          matchId,
          teamId,
          formation,
          published,
          players: players.map((player) => ({
            playerId: player.playerId,
            position: player.position,
            shirtNumber: player.shirtNumber ? Number(player.shirtNumber) : null,
            isStarting: player.isStarting,
          })),
        })}
      />
      <label className="lineup-form-field">
        <span>Match *</span>
        <select required value={matchId} onChange={(event) => changeMatch(event.target.value)}>
          <option value="">Select a match…</option>
          {matches.map((match) => (
            <option key={String(match.id)} value={String(match.id)}>
              {relatedLabel(match)}
            </option>
          ))}
        </select>
      </label>
      <label className="lineup-form-field">
        <span>Team *</span>
        <select required value={teamId} disabled={!matchId} onChange={(event) => changeTeam(event.target.value)}>
          <option value="">Select the team…</option>
          {teams.map((team) => <option key={String(team.id)} value={String(team.id)}>{String(team.name ?? 'Team')}</option>)}
        </select>
      </label>
      <label className="lineup-form-field">
        <span>Formation *</span>
        <select required value={formation} onChange={(event) => setFormation(event.target.value)}>
          {formationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <div className="lineup-squad-editor">
        <div className="lineup-squad-heading"><strong>Squad members</strong><span>{players.filter((player) => player.isStarting).length}/11 starters · {players.length}/30 squad members</span></div>
        {players.map((player, index) => (
          <div className="lineup-member-row" key={`${index}-${player.playerId}`}>
            <select
              aria-label={`Player ${index + 1}`}
              required
              value={player.playerId}
              onChange={(event) => setPlayers((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, playerId: event.target.value } : item))}
            >
              <option value="">Select player…</option>
              {roster.map((record) => (
                <option
                  key={String(record.id)}
                  value={String(record.id)}
                  disabled={players.some((item, rowIndex) => item.playerId === String(record.id) && rowIndex !== index)}
                >
                  {String(record.name ?? 'Player')}{record.shirt_number ? ` · #${record.shirt_number}` : ''}
                </option>
              ))}
            </select>
            <select
              aria-label={`Position ${index + 1}`}
              value={player.position}
              onChange={(event) => setPlayers((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, position: event.target.value } : item))}
            >
              {lineupPositionOptions.map((position) => <option key={position} value={position}>{position}</option>)}
            </select>
            <input
              aria-label={`Shirt number ${index + 1}`}
              type="number"
              min="1"
              max="99"
              placeholder="#"
              value={player.shirtNumber}
              onChange={(event) => setPlayers((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, shirtNumber: event.target.value } : item))}
            />
            <label className="lineup-starter-toggle">
              <input
                type="checkbox"
                checked={player.isStarting}
                disabled={!player.isStarting && players.filter((item) => item.isStarting).length >= 11}
                onChange={(event) => setPlayers((current) => current.map((item, rowIndex) => rowIndex === index ? { ...item, isStarting: event.target.checked } : item))}
              />
              Starter
            </label>
            <button type="button" className="player-stat-remove" aria-label={`Remove player ${index + 1}`} onClick={() => setPlayers((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
          </div>
        ))}
        <button
          type="button"
          className="button button-light"
          disabled={!teamId || players.length >= 30 || players.length >= roster.length}
          onClick={() => setPlayers((current) => [...current, {
            playerId: '',
            position: current.length === 0 ? 'GK' : 'CM',
            shirtNumber: '',
            isStarting: current.filter((player) => player.isStarting).length < 11,
          }])}
        >
          Add squad member
        </button>
        {teamId && roster.length === 0 && <small>Add this team’s players in the Players section before building the lineup.</small>}
      </div>
      {previewPlayers.length > 0 && (
        <LineupGraphic
          teamName={String(previewTeamName ?? 'Team')}
          formation={formation}
          players={previewPlayers}
        />
      )}
      <label className="lineup-publish-toggle">
        <input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} />
        Publish line-up to the app
      </label>
    </div>
  );
}

function PlayerStatsEditor({ initialStats }: { initialStats: unknown }) {
  const parsedStats = initialStats && typeof initialStats === 'object' && !Array.isArray(initialStats)
    ? initialStats as Record<string, unknown>
    : {};
  const [stats, setStats] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      Object.entries(parsedStats)
        .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1])),
    ),
  );
  const [newStat, setNewStat] = useState('');
  const labels = new Map<string, string>(playerStatOptions.map(({ key, label }) => [key, label]));
  for (const key of Object.keys(stats)) {
    if (!labels.has(key)) labels.set(key, key.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()));
  }
  const selected = Object.keys(stats);
  const available = playerStatOptions.filter(({ key }) => !selected.includes(key));

  function updateStat(key: string, value: string) {
    setStats((current) => {
      if (!value.trim()) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const number = Number(value);
      return Number.isFinite(number) && number >= 0
        ? { ...current, [key]: number }
        : current;
    });
  }

  return (
    <div className="player-stats-editor">
      <input type="hidden" name="stats" value={JSON.stringify(stats)} />
      {selected.map((key) => (
        <div className="player-stat-row" key={key}>
          <span>{labels.get(key) ?? key}</span>
          <input
            aria-label={`${labels.get(key) ?? key} value`}
            type="number"
            min="0"
            step="any"
            value={stats[key] ?? ''}
            onChange={(event) => updateStat(key, event.target.value)}
          />
          <button type="button" className="player-stat-remove" onClick={() => {
            setStats((current) => {
              const next = { ...current };
              delete next[key];
              return next;
            });
          }}>Remove</button>
        </div>
      ))}
      {available.length > 0 && (
        <div className="player-stat-add">
          <select aria-label="Choose a player statistic" value={newStat} onChange={(event) => setNewStat(event.target.value)}>
            <option value="">Choose a statistic…</option>
            {available.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button type="button" className="button button-light" disabled={!newStat} onClick={() => {
            setStats((current) => ({ ...current, [newStat]: 0 }));
            setNewStat('');
          }}>Add statistic</button>
        </div>
      )}
      <small>Choose the statistics you have verified, then enter their values.</small>
    </div>
  );
}

function PlayerImageField({ initialUrl, hint }: { initialUrl: unknown; hint?: string }) {
  const originalUrl = typeof initialUrl === 'string' ? initialUrl : '';
  const [previewUrl, setPreviewUrl] = useState(originalUrl);

  useEffect(() => {
    setPreviewUrl(originalUrl);
  }, [originalUrl]);

  useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  return (
    <div className="player-image-editor">
      <input
        name="playerImage"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          setPreviewUrl(file ? URL.createObjectURL(file) : originalUrl);
        }}
      />
      {hint && <small>{hint}</small>}
      {previewUrl && <img className="player-image-preview" src={previewUrl} alt="Player image preview" />}
    </div>
  );
}

const resourceConfig: Record<AdminResource, ResourceConfig> = {
  competitions: { title: 'Competitions', singular: 'competition', eyebrow: 'TOURNAMENT SETUP', fields: [
    { key: 'name', label: 'Competition name', required: true }, { key: 'season', label: 'Season', required: true, hint: 'Example: 2027' }, { key: 'country', label: 'Region or host', hint: 'Africa' }, { key: 'startsAt', label: 'Start date', type: 'datetime-local' }, { key: 'endsAt', label: 'End date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'season', 'country', 'starts_at', 'published'] },
  matches: { title: 'Matches', singular: 'match', eyebrow: 'FIXTURES & RESULTS', fields: [
    { key: 'competitionId', label: 'Competition', required: true, related: 'competitions' }, { key: 'stage', label: 'Stage' }, { key: 'groupCode', label: 'Group' }, { key: 'homeTeamId', label: 'Home team', required: true, related: 'teams' }, { key: 'awayTeamId', label: 'Away team', required: true, related: 'teams' }, { key: 'venueId', label: 'Venue', related: 'venues' }, { key: 'kickoffAt', label: 'Kick-off time', type: 'datetime-local', required: true }, { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'live', 'half_time', 'finished', 'postponed', 'cancelled'] }, { key: 'homeScore', label: 'Home score', type: 'number' }, { key: 'awayScore', label: 'Away score', type: 'number' }, { key: 'broadcast', label: 'Broadcast' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['kickoff_at', 'home_team_id', 'away_team_id', 'status', 'published'] },
  teams: { title: 'Teams', singular: 'team', eyebrow: 'NATIONAL TEAMS', fields: [
    { key: 'name', label: 'Team name', required: true }, { key: 'shortName', label: 'Short name' }, { key: 'countryCode', label: 'Country code', hint: 'ISO code (UGA) or calling code (+256)' }, { key: 'region', label: 'African region' }, { key: 'coach', label: 'Head coach' }, { key: 'competitionId', label: 'Competition', related: 'competitions' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'region', 'coach', 'published'] },
  players: { title: 'Players', singular: 'player', eyebrow: 'SQUADS & PROFILES', fields: [
    { key: 'name', label: 'Player name', required: true }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'competitionId', label: 'Competition', related: 'competitions' }, { key: 'position', label: 'Position' }, { key: 'shirtNumber', label: 'Shirt number', type: 'number' }, { key: 'dateOfBirth', label: 'Date of birth', type: 'date' }, { key: 'club', label: 'Club' }, { key: 'playerImage', label: 'Player image (optional)', type: 'file', hint: 'JPEG, PNG, or WebP up to 8 MB' }, { key: 'stats', label: 'Player statistics', type: 'stats' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'photo_url', 'team_id', 'position', 'shirt_number', 'published'] },
  standings: { title: 'Groups & tables', singular: 'standing row', eyebrow: 'COMPETITION TABLES', fields: [
    { key: 'competitionId', label: 'Competition', required: true, related: 'competitions' }, { key: 'groupCode', label: 'Group', required: true }, { key: 'teamId', label: 'Team', required: true, related: 'teams' }, { key: 'position', label: 'Position', type: 'number', required: true }, { key: 'played', label: 'Played', type: 'number' }, { key: 'won', label: 'Won', type: 'number' }, { key: 'drawn', label: 'Drawn', type: 'number' }, { key: 'lost', label: 'Lost', type: 'number' }, { key: 'goalsFor', label: 'Goals for', type: 'number' }, { key: 'goalsAgainst', label: 'Goals against', type: 'number' }, { key: 'goalDifference', label: 'Goal difference', type: 'number' }, { key: 'points', label: 'Points', type: 'number' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['group_code', 'team_id', 'position', 'played', 'goal_difference', 'points', 'published'] },
  'match-events': { title: 'Match events', singular: 'match event', eyebrow: 'GOALS, CARDS & CHANGES', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'playerId', label: 'Player', related: 'players' }, { key: 'relatedPlayerId', label: 'Related player', hint: 'For assists or substitutions', related: 'players' }, { key: 'eventType', label: 'Event type', type: 'select', required: true, options: ['goal', 'own_goal', 'penalty', 'yellow_card', 'red_card', 'substitution', 'var', 'kickoff', 'half_time', 'full_time'] }, { key: 'minute', label: 'Minute', type: 'number', required: true }, { key: 'addedTime', label: 'Added time', type: 'number' }, { key: 'detail', label: 'Event details', type: 'textarea' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['match_id', 'event_type', 'minute', 'team_id', 'player_id', 'published'] },
  'match-statistics': { title: 'Match statistics', singular: 'match statistic', eyebrow: 'LIVE MATCH DATA', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'statistic', label: 'Statistic name', required: true, hint: 'Example: possession' }, { key: 'homeValue', label: 'Home value', type: 'number' }, { key: 'awayValue', label: 'Away value', type: 'number' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['match_id', 'statistic', 'home_value', 'away_value', 'published'] },
  lineups: { title: 'Line-ups', singular: 'team line-up', eyebrow: 'MATCH SQUADS', fields: [
    { key: 'matchId', label: 'Match', required: true, related: 'matches' }, { key: 'teamId', label: 'Team', required: true, related: 'teams' }, { key: 'playerId', label: 'Players', required: true, related: 'players' },
  ], columns: ['match_id', 'team_name', 'formation', 'player_name', 'position', 'is_starting', 'shirt_number', 'published'] },
  venues: { title: 'Venues', singular: 'venue', eyebrow: 'STADIUM GUIDE', fields: [
    { key: 'name', label: 'Stadium name', required: true }, { key: 'city', label: 'City', required: true }, { key: 'country', label: 'Country' }, { key: 'address', label: 'Street address' }, { key: 'venueImage', label: 'Venue image (optional)', type: 'file', hint: 'JPEG, PNG, or WebP up to 8 MB' }, { key: 'capacity', label: 'Capacity (people)', type: 'number', hint: 'Enter the number of people, for example 5000' }, { key: 'timezone', label: 'Timezone', hint: 'Example: Africa/Kampala' }, { key: 'accessibilityInfo', label: 'Accessibility', type: 'textarea' }, { key: 'transportInfo', label: 'Transport information', type: 'textarea' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['name', 'image_url', 'city', 'country', 'capacity', 'published'] },
  news: { title: 'News & updates', singular: 'article', eyebrow: 'EDITORIAL', fields: [
    { key: 'title', label: 'Headline', required: true }, { key: 'slug', label: 'URL slug', required: true }, { key: 'summary', label: 'Summary', type: 'textarea' }, { key: 'body', label: 'Article body', type: 'textarea' }, { key: 'author', label: 'Author' }, { key: 'category', label: 'Category' }, { key: 'region', label: 'Region' }, { key: 'imageUrl', label: 'Image URL', type: 'url' }, { key: 'imageRights', label: 'Image rights / attribution' }, { key: 'publishedAt', label: 'Publish date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'category', 'author', 'published_at', 'published'] },
  events: { title: 'Fan events', singular: 'event', eyebrow: 'HOST CITIES', fields: [
    { key: 'title', label: 'Event name', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'city', label: 'City', required: true }, { key: 'region', label: 'Region' }, { key: 'venueId', label: 'Venue', related: 'venues' }, { key: 'startsAt', label: 'Starts at', type: 'datetime-local', required: true }, { key: 'endsAt', label: 'Ends at', type: 'datetime-local' }, { key: 'bookingUrl', label: 'Booking URL', type: 'url' }, { key: 'organizer', label: 'Organizer' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'city', 'starts_at', 'organizer', 'published'] },
  media: { title: 'Media library', singular: 'media item', eyebrow: 'PHOTOS & VIDEO', fields: [
    { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'mediaType', label: 'Media type', type: 'select', required: true, options: ['image', 'video', 'audio'] }, { key: 'url', label: 'Asset URL', type: 'url', required: true }, { key: 'thumbnailUrl', label: 'Thumbnail URL', type: 'url' }, { key: 'teamId', label: 'Team', related: 'teams' }, { key: 'territory', label: 'Licensed territory' }, { key: 'rightsStart', label: 'Rights start', type: 'datetime-local' }, { key: 'rightsEnd', label: 'Rights end', type: 'datetime-local' }, { key: 'publishedAt', label: 'Publish date', type: 'datetime-local' }, { key: 'published', label: 'Publish to the app', type: 'checkbox' },
  ], columns: ['title', 'media_type', 'territory', 'rights_end', 'published'] },
  'community-posts': { title: 'Community posts', singular: 'post', eyebrow: 'FAN COMMUNITY', fields: [
    { key: 'status', label: 'Moderation status', type: 'select', required: true, options: ['pending', 'published', 'hidden', 'removed'] },
  ], columns: ['display_name', 'content', 'status', 'created_at', 'likes_count', 'comments_count'], allowCreate: false, allowDelete: false },
  'community-comments': { title: 'Community comments', singular: 'comment', eyebrow: 'FAN COMMUNITY', fields: [
    { key: 'status', label: 'Moderation status', type: 'select', required: true, options: ['pending', 'published', 'hidden', 'removed'] },
  ], columns: ['display_name', 'content', 'status', 'created_at'], allowCreate: false, allowDelete: false },
  'community-reports': { title: 'Community reports', singular: 'report', eyebrow: 'FAN COMMUNITY', fields: [
    { key: 'status', label: 'Review status', type: 'select', required: true, options: ['open', 'resolved', 'dismissed'] },
  ], columns: ['target_type', 'reported_content', 'reason', 'reporter_name', 'status', 'created_at'], allowCreate: false, allowDelete: false },
};

const nav: { label: string; resource?: AdminResource; icon: string }[] = [
  { label: 'Overview', icon: '⌂' },
  { label: 'Competitions', resource: 'competitions', icon: '◈' },
  { label: 'Teams', resource: 'teams', icon: '♧' },
  { label: 'Venues', resource: 'venues', icon: '⌖' },
  { label: 'Players', resource: 'players', icon: '♙' },
  { label: 'Matches', resource: 'matches', icon: '◉' },
  { label: 'Groups & tables', resource: 'standings', icon: '▤' },
  { label: 'Line-ups', resource: 'lineups', icon: '☷' },
  { label: 'Match events', resource: 'match-events', icon: '⌁' },
  { label: 'Match statistics', resource: 'match-statistics', icon: '▥' },
  { label: 'News & updates', resource: 'news', icon: '▧' },
  { label: 'Fan events', resource: 'events', icon: '▦' },
  { label: 'Media library', resource: 'media', icon: '▷' },
  { label: 'Community posts', resource: 'community-posts', icon: '☷' },
  { label: 'Community comments', resource: 'community-comments', icon: '☏' },
  { label: 'Community reports', resource: 'community-reports', icon: '⚑' },
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
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
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
  const [previewMode, setPreviewMode] = useState(false);
  const [authReady, setAuthReady] = useState(false);
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
          const result = await getOverview(saved);
          if (!alive) return;
          setToken(saved);
          setOverview(result.data);
          setAuthReady(true);
          return;
        } catch {
          sessionStorage.removeItem('afconDashboardSession');
        }
      }
      if (alive) setAuthReady(true);
    }
    restoreSession();
    return () => { alive = false; };
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const adminToken = tokenDraft.trim();
      const result = await getOverview(adminToken);
      sessionStorage.setItem('afconDashboardSession', adminToken);
      setToken(adminToken);
      setPreviewMode(false);
      setOverview(result.data);
      setAccountName('Admin');
      setNotice('Dashboard connected successfully.');
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401
        ? 'Admin token rejected. Use ADMIN_API_TOKEN from backend/.env, not AI_PROVIDER_API_KEY or a fan account login.'
        : err instanceof Error ? err.message : 'Could not connect to the backend.');
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
    if (!activeResource || !config) return;
    if (!token) {
      setError('Connect the admin API before saving records.');
      return;
    }
    setSaving(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const value: RecordData = {};
    for (const field of config.fields) {
      if (field.type === 'file') continue;
      const raw = form.get(field.key);
      if (field.type === 'checkbox') {
        value[field.key] = raw === 'on';
      } else if (raw !== null && String(raw).trim() !== '') {
        let normalized: unknown = String(raw).trim();
        if (field.type === 'number') normalized = Number(normalized);
        if (field.type === 'datetime-local') normalized = new Date(String(normalized)).toISOString();
        if (field.key === 'stats') {
          try {
            const parsedStats: unknown = JSON.parse(String(normalized));
            if (!parsedStats || typeof parsedStats !== 'object' || Array.isArray(parsedStats)) {
              throw new Error('Statistics must be an object.');
            }
            normalized = parsedStats;
          } catch {
            setError('Choose valid player statistics and enter numeric values.');
            setSaving(false);
            return;
          }
        }
        value[field.key] = normalized;
      } else if (field.key === 'imageUrl' && editor && typeof editor === 'object') {
        value[field.key] = null;
      }
    }
    const id = editor && typeof editor === 'object'
      ? activeResource === 'match-statistics'
        ? `${editor.match_id}:${editor.statistic}`
        : String(editor.id ?? '')
      : undefined;
    try {
      if (activeResource === 'lineups') {
        const lineupBatch = form.get('lineupBatch');
        if (typeof lineupBatch !== 'string') throw new Error('Complete the line-up before saving.');
        const lineup = JSON.parse(lineupBatch) as {
          matchId: string;
          teamId: string;
          formation: string;
          published: boolean;
          players: Array<{ playerId: string; position: string; shirtNumber: number | null; isStarting: boolean }>;
        };
        if (!lineup.matchId || !lineup.teamId || lineup.players.length === 0 || lineup.players.some((player) => !player.playerId)) {
          throw new Error('Select a match, a team, and a player for every squad row.');
        }
        await saveLineupBatch(token, lineup);
        setEditor(false);
        setNotice(`Line-up ${id ? 'updated' : 'saved'}.`);
        await loadResource(activeResource);
        return;
      }
      if (activeResource === 'venues') {
        const image = form.get('venueImage');
        if (image instanceof File && image.size > 0) {
          if (image.size > 8 * 1024 * 1024) {
            throw new Error('Venue images must be 8 MB or smaller.');
          }
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
            throw new Error('Choose a JPEG, PNG, or WebP venue image.');
          }
          value.imageUrl = await uploadVenueImage(token, image);
        }
      }
      if (activeResource === 'players') {
        const image = form.get('playerImage');
        if (image instanceof File && image.size > 0) {
          if (image.size > 8 * 1024 * 1024) {
            throw new Error('Player images must be 8 MB or smaller.');
          }
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type)) {
            throw new Error('Choose a JPEG, PNG, or WebP player image.');
          }
          value.photoUrl = await uploadPlayerImage(token, image);
        }
      }
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
    if (!activeResource || config?.allowDelete === false || !token || (!row.id && activeResource !== 'match-statistics')) return;
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

  if (!token && !previewMode) return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-ball">AF</div>
        <span className="eyebrow">SECURE DASHBOARD ACCESS</span>
        <h1>Connect to your backend</h1>
        <p>Enter ADMIN_API_TOKEN from backend/.env. It is separate from the AI key and fan account login.</p>
        <form className="auth-form" onSubmit={connect}>
          <label>Admin API token<input type="password" autoComplete="current-password" value={tokenDraft} onChange={(event) => setTokenDraft(event.target.value)} required /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy || !tokenDraft.trim()}>{busy ? 'Connecting…' : 'Connect dashboard'}</button>
        </form>
        {import.meta.env.DEV && <button type="button" className="button button-light auth-submit" onClick={() => { setPreviewMode(true); setAccountName('Guest'); setError(''); }}>Continue in local preview</button>}
        {import.meta.env.DEV && <p className="auth-hint">Preview shows the dashboard layout only. Live data and editing still require a valid admin token.</p>}
        {!apiOnline && <div className="auth-hint">Backend not reachable. Start the API at <code>http://localhost:8080</code> and allow this dashboard origin in <code>APP_ORIGINS</code>.</div>}
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
        <div className="sidebar-user"><div className="user-avatar">{previewMode ? 'PV' : 'AD'}</div><div><strong>{previewMode ? 'Preview workspace' : 'Admin workspace'}</strong><span>AFCON FAN</span></div><button title={previewMode ? 'Exit preview' : 'Disconnect'} onClick={() => { sessionStorage.removeItem('afconDashboardSession'); setToken(''); setPreviewMode(false); setOverview({}); setRows([]); setNotice('Signed out.'); }}>↪</button></div>
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
          {previewMode && <section className="connect-card" role="status"><div className="connect-symbol">◉</div><div className="connect-copy"><strong>Local preview — view only</strong><span>Backend records and editing are unavailable until you connect with a valid admin API token.</span></div><button className="button button-primary" onClick={() => setPreviewMode(false)}>Connect backend</button></section>}
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
              <div className="page-heading resource-heading"><div><div className="eyebrow">{config?.eyebrow}</div><h1>{config?.title}</h1><p>{activeResource?.startsWith('community-') ? 'Review fan content before it appears in the community feed.' : 'Manage records shown in the AFCON Fan app.'}</p></div>{config?.allowCreate !== false && <button className="button button-primary" onClick={() => token ? setEditor(null) : setError('Connect the admin API from Overview before editing records.')}><span>＋</span> Add {config?.singular}</button>}</div>
              {!token && <section className="connect-card"><div className="connect-symbol">⌘</div><div className="connect-copy"><strong>Admin connection needed</strong><span>Connect your backend token from Overview to view or edit records.</span></div><button className="button button-primary" onClick={() => navigate('Overview')}>Open overview</button></section>}
              {activeResource === 'lineups' && <LineupDashboardPreview rows={rows} />}
              <section className="panel records-panel">
                <div className="records-toolbar">
                  <div>
                    <h2>{config?.title} <span>{rows.length}</span></h2>
                    <p>{activeResource?.startsWith('community-') ? 'Review and moderate user-generated content' : 'Manage and publish tournament information'}</p>
                  </div>
                  <div className="records-tools">
                    <div className="table-search">
                      <span>⌕</span>
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" />
                    </div>
                    <button className="button button-light" onClick={() => activeResource && loadResource(activeResource)}>↻</button>
                  </div>
                </div>
                {busy ? (
                  <div className="table-empty"><div className="spinner" /><strong>Loading records…</strong></div>
                ) : !token ? (
                  <div className="table-empty">
                    <span className="empty-icon">⌘</span>
                    <strong>Connect to load {config?.title.toLowerCase()}</strong>
                    <p>Your content will appear here once the backend is connected.</p>
                  </div>
                ) : filteredRows.length === 0 ? (
                  <div className="table-empty">
                    <span className="empty-icon">＋</span>
                    <strong>{search ? 'No matching records' : `No ${config?.title.toLowerCase()} yet`}</strong>
                    <p>{search ? 'Try a different search.' : `There is no ${config?.singular} to review yet.`}</p>
                    {!search && config?.allowCreate !== false && (
                      <button className="button button-primary" onClick={() => setEditor(null)}>Add {config?.singular}</button>
                    )}
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          {config?.columns.map((column) => (
                            <th key={column}>
                              {column === 'image_url' || column === 'photo_url'
                                ? 'Image'
                                : activeResource === 'venues' && column === 'capacity'
                                  ? 'Capacity (people)'
                                  : column.replaceAll('_', ' ')}
                            </th>
                          ))}
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((row, index) => (
                          <tr key={String(row.id ?? index)}>
                            {config?.columns.map((column) => {
                              const value = row[column];
                              let content: ReactNode;
                              if (column === 'published') {
                                content = <span className={`status-tag ${value ? 'published' : 'draft'}`}><i />{value ? 'Published' : 'Draft'}</span>;
                              } else if (activeResource === 'venues' && column === 'image_url') {
                                content = value
                                  ? <img className="venue-image-preview" src={String(value)} alt={`${row.name ?? 'Venue'} venue`} loading="lazy" />
                                  : <span className="venue-image-empty">No image</span>;
                              } else if (activeResource === 'players' && column === 'photo_url') {
                                content = value
                                  ? <img className="player-table-image" src={String(value)} alt={`${row.name ?? 'Player'} player`} loading="lazy" />
                                  : <span className="venue-image-empty">No image</span>;
                              } else if (activeResource === 'venues' && column === 'capacity' && value != null) {
                                content = <span>{pretty(value)} people</span>;
                              } else if (column.endsWith('_at') && value) {
                                content = new Date(String(value)).toLocaleString();
                              } else {
                                content = <span title={pretty(value)}>{pretty(value)}</span>;
                              }
                              return <td key={column}>{content}</td>;
                            })}
                            <td>
                              <div className="row-actions">
                                <button className="row-edit" onClick={() => setEditor(row)} aria-label={`Review ${config?.singular}`}>
                                  {config?.allowDelete === false ? 'Review' : 'Edit'}
                                </button>
                                {config?.allowDelete !== false && (
                                  <button className="row-delete" onClick={() => removeRecord(row)} aria-label={`Delete ${config?.singular}`}>Delete</button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
              <div className="records-note"><span>ⓘ</span>Only published records appear in the fan app. Confirm rights, source and dates before publishing.</div>
            </>
          )}
        </div>
      </main>

      {editor !== false && config && activeResource && (
        <div className="modal-scrim" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditor(false);
        }}>
          <form className="editor-modal" onSubmit={save}>
            <div className="modal-header">
              <div>
                <div className="eyebrow">{editor && typeof editor === 'object' ? 'EDIT RECORD' : 'NEW RECORD'}</div>
                <h2>{editor && typeof editor === 'object' ? `Edit ${config.singular}` : `Add ${config.singular}`}</h2>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditor(false)}>×</button>
            </div>
            <div className="modal-fields">
              {activeResource === 'lineups' ? (
                <LineupEditor lookups={lookups} rows={rows} editor={editor} />
              ) : config.fields.map((field) => {
                const currentValue = recordField(editor, field.key);
                return (
                  <label
                    key={field.key}
                    className={`form-field ${field.type === 'textarea' || field.type === 'stats' || field.type === 'file' ? 'wide' : ''} ${field.type === 'checkbox' ? 'check-field' : ''}`}
                  >
                    <span>{field.label}{field.required && <i> *</i>}</span>
                    {field.type === 'checkbox' ? (
                      <input name={field.key} type="checkbox" defaultChecked={Boolean(currentValue)} />
                    ) : field.type === 'stats' ? (
                      <PlayerStatsEditor initialStats={currentValue} />
                    ) : field.key === 'playerImage' ? (
                      <PlayerImageField initialUrl={recordField(editor, 'photoUrl')} hint={field.hint} />
                    ) : field.type === 'textarea' ? (
                      <textarea
                        name={field.key}
                        defaultValue={String(currentValue)}
                        placeholder={field.hint}
                        rows={field.key === 'body' ? 5 : 3}
                        required={field.required}
                      />
                    ) : field.related ? (
                      <select name={field.key} defaultValue={String(currentValue)} required={field.required}>
                        <option value="">Select {field.label.toLowerCase()}…</option>
                        {(lookups[field.key] ?? []).map((option) => (
                          <option key={String(option.id)} value={String(option.id)}>{relatedLabel(option)}</option>
                        ))}
                      </select>
                    ) : field.type === 'select' ? (
                      <select name={field.key} defaultValue={String(currentValue)} required={field.required}>
                        <option value="">Select…</option>
                        {field.options?.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
                      </select>
                    ) : (
                      <input
                        name={field.key}
                        type={field.type ?? 'text'}
                        defaultValue={field.type === 'datetime-local' ? dateInputValue(currentValue) : String(currentValue)}
                        placeholder={field.hint}
                        required={field.required}
                      />
                    )}
                    {field.hint && field.type !== 'text' && field.type !== 'file' && <small>{field.hint}</small>}
                  </label>
                );
              })}
            </div>
            <div className="modal-footer">
              <button type="button" className="button button-light" onClick={() => setEditor(false)}>Cancel</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save record'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;
