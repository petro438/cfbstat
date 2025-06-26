import React, { useState, useEffect } from 'react';

const PassingStatsPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState('yards_per_attempt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Filters
  const [season, setSeason] = useState('2025');
  const [conference, setConference] = useState('all');
  const [conferenceOnly, setConferenceOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(false);
  const [side, setSide] = useState('offense'); // 'offense' or 'defense'
  const [viewMode, setViewMode] = useState('basic'); // 'basic' or 'advanced'
  const [perGame, setPerGame] = useState(false); // false = totals, true = per game

  const conferences = [
    'all', 'SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 
    'American Athletic', 'Mountain West', 'Conference USA', 'MAC', 'Sun Belt'
  ];

  // Get percentile color (with defense flip for certain stats)
  const getPercentileColor = (percentile, isDefenseStat = false) => {
    // For defense, flip the colors for most stats (except sacks and qb_hurries which are good for defense)
    const effectivePercentile = isDefenseStat ? 100 - percentile : percentile;
    
    if (effectivePercentile >= 96) return '#58c36c';
    if (effectivePercentile >= 91) return '#6aca7c';
    if (effectivePercentile >= 86) return '#7cd08b';
    if (effectivePercentile >= 81) return '#8dd69b';
    if (effectivePercentile >= 76) return '#9fddaa';
    if (effectivePercentile >= 71) return '#b0e3ba';
    if (effectivePercentile >= 66) return '#c2e9c9';
    if (effectivePercentile >= 61) return '#d4f0d9';
    if (effectivePercentile >= 56) return '#e5f6e8';
    if (effectivePercentile >= 51) return '#f7fcf8';
    if (effectivePercentile >= 46) return '#fdf5f4';
    if (effectivePercentile >= 41) return '#fbe1df';
    if (effectivePercentile >= 36) return '#f9cdc9';
    if (effectivePercentile >= 31) return '#f7b9b4';
    if (effectivePercentile >= 26) return '#f5a59f';
    if (effectivePercentile >= 21) return '#f2928a';
    if (effectivePercentile >= 16) return '#f07e74';
    if (effectivePercentile >= 11) return '#ee6a5f';
    if (effectivePercentile >= 6) return '#ec564a';
    return '#ea4335';
  };

  // Format stat display with rank
  const formatStatWithRank = (value, rank, percentile, isPercentage = false, isMobile = false, isDefenseStat = false) => {
    const bgColor = getPercentileColor(percentile, isDefenseStat);
    const effectivePercentile = isDefenseStat ? 100 - percentile : percentile;
    const textColor = effectivePercentile <= 40 ? '#ffffff' : '#000000';
    
    return (
      <div style={{ backgroundColor: bgColor, color: textColor }} className="stat-cell">
        <div className="stat-value">
          {isPercentage ? `${value}%` : value}
        </div>
        {!isMobile && <div className="stat-rank">#{rank}</div>}
      </div>
    );
  };

  const loadPassingStats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        conference_only: conferenceOnly.toString(),
        regular_season_only: regularSeasonOnly.toString(),
        side: side,
        per_game: perGame.toString()
      });
      
      if (conference !== 'all') {
        params.append('conference', conference);
      }

      const response = await fetch(`http://localhost:5000/api/leaderboards/passing/${season}?${params}`);
      const result = await response.json();
      
      if (result.teams) {
        setData(result.teams);
      }
    } catch (error) {
      console.error('Error loading passing stats:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPassingStats();
  }, [season, conference, conferenceOnly, regularSeasonOnly, side, perGame]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      // Set default sort direction based on stat type
      const lowerIsBetter = ['interceptions', 'sacks', 'qb_hurries'].includes(field);
      setSortDirection(lowerIsBetter ? 'asc' : 'desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    // Convert to numbers for numeric fields
    if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }
    
    if (sortDirection === 'asc') {
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    } else {
      return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
    }
  });

  const getColumnHeader = (field, label, mobileLabel = null) => (
    <th 
      onClick={() => handleSort(field)}
      className="sortable-header"
      style={{ cursor: 'pointer' }}
    >
      <span className="desktop-header">{label}</span>
      <span className="mobile-header">{mobileLabel || label}</span>
      {sortField === field && (
        <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
      )}
    </th>
  );

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div>Loading passing stats...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Trebuchet MS, sans-serif',
      padding: '8px',
      backgroundColor: '#ffffff'
    }}>
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold', 
          margin: '0 0 16px 0',
          color: '#212529'
        }}>
          Passing Stats Dashboard
        </h1>

        {/* Tab Controls */}
        <div style={{ marginBottom: '12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setSide('offense')}
              style={{
                padding: '8px 16px',
                backgroundColor: side === 'offense' ? '#007bff' : '#f8f9fa',
                color: side === 'offense' ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Offense
            </button>
            <button
              onClick={() => setSide('defense')}
              style={{
                padding: '8px 16px',
                backgroundColor: side === 'defense' ? '#007bff' : '#f8f9fa',
                color: side === 'defense' ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Defense
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('basic')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'basic' ? '#28a745' : '#f8f9fa',
                color: viewMode === 'basic' ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Basic
            </button>
            <button
              onClick={() => setViewMode('advanced')}
              style={{
                padding: '8px 16px',
                backgroundColor: viewMode === 'advanced' ? '#28a745' : '#f8f9fa',
                color: viewMode === 'advanced' ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Advanced
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPerGame(false)}
              style={{
                padding: '8px 16px',
                backgroundColor: !perGame ? '#dc3545' : '#f8f9fa',
                color: !perGame ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Total
            </button>
            <button
              onClick={() => setPerGame(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: perGame ? '#dc3545' : '#f8f9fa',
                color: perGame ? '#ffffff' : '#212529',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'Trebuchet MS, sans-serif',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
            >
              Per Game
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '12px', 
          marginBottom: '16px',
          alignItems: 'center'
        }}>
          <select
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            style={{
              padding: '6px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif'
            }}
          >
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>

          <select
            value={conference}
            onChange={(e) => setConference(e.target.value)}
            style={{
              padding: '6px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif'
            }}
          >
            {conferences.map(conf => (
              <option key={conf} value={conf}>
                {conf === 'all' ? 'All Conferences' : conf}
              </option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={conferenceOnly}
              onChange={(e) => setConferenceOnly(e.target.checked)}
            />
            Conference Games Only
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={regularSeasonOnly}
              onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            />
            Regular Season Only
          </label>
        </div>
      </div>

      {/* Data Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          lineHeight: '1.2'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              {getColumnHeader('team_name', 'Team')}
              {getColumnHeader('games_played', 'GP')}
              {getColumnHeader('total_completions', 'COMP')}
              {getColumnHeader('total_attempts', 'ATT')}
              {getColumnHeader('completion_percentage', 'COMP%')}
              {getColumnHeader('net_passing_yards', 'YARDS')}
              {getColumnHeader('yards_per_attempt', 'YARDS/ATT', 'YARDS/\nATT')}
              {getColumnHeader('passing_tds', 'TDS')}
              {getColumnHeader('interceptions', 'INT')}
              {getColumnHeader('sacks', 'SACKS')}
              {viewMode === 'advanced' && getColumnHeader('qb_hurries', 'HURRIES')}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((team, index) => (
              <tr 
                key={team.team_name}
                style={{
                  backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                  borderBottom: '1px solid #dee2e6'
                }}
              >
                <td style={{ 
                  padding: '4px 8px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {team.logo_url && (
                      <img 
                        src={team.logo_url} 
                        alt={team.team_name}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                        onClick={() => window.location.href = `/team/${team.team_name.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                    )}
                    <span 
                      className="team-name-display"
                      style={{ cursor: 'pointer' }}
                      onClick={() => window.location.href = `/team/${team.team_name.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {team.team_name}
                    </span>
                  </div>
                </td>
                <td style={{ 
                  padding: '4px 8px',
                  fontFamily: 'Consolas, monospace',
                  textAlign: 'center'
                }}>
                  {team.games_played}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.total_completions, 
                    team.total_completions_rank, 
                    team.total_completions_percentile,
                    false,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.total_attempts, 
                    team.total_attempts_rank, 
                    team.total_attempts_percentile,
                    false,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.completion_percentage, 
                    team.completion_percentage_rank, 
                    team.completion_percentage_percentile,
                    true,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.net_passing_yards, 
                    team.net_passing_yards_rank, 
                    team.net_passing_yards_percentile,
                    false,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.yards_per_attempt, 
                    team.yards_per_attempt_rank, 
                    team.yards_per_attempt_percentile,
                    false,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.passing_tds, 
                    team.passing_tds_rank, 
                    team.passing_tds_percentile,
                    false,
                    window.innerWidth <= 768,
                    side === 'defense'
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.interceptions, 
                    team.interceptions_rank, 
                    team.interceptions_percentile,
                    false,
                    window.innerWidth <= 768,
                    // Interceptions: good for defense (green), bad for offense (red)
                    side === 'defense' ? false : true
                  )}
                </td>
                <td style={{ padding: '2px' }}>
                  {formatStatWithRank(
                    team.sacks, 
                    team.sacks_rank, 
                    team.sacks_percentile,
                    false,
                    window.innerWidth <= 768,
                    // Sacks: good for defense (green), bad for offense (red) 
                    side === 'defense' ? false : true
                  )}
                </td>
                {viewMode === 'advanced' && (
                  <td style={{ padding: '2px' }}>
                    {formatStatWithRank(
                      team.qb_hurries, 
                      team.qb_hurries_rank, 
                      team.qb_hurries_percentile,
                      false,
                      window.innerWidth <= 768,
                      // QB Hurries: good for defense (green), bad for offense (red)
                      side === 'defense' ? false : true
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .stat-cell {
          padding: 4px 8px;
          text-align: center;
          border-radius: 2px;
          font-family: 'Consolas', monospace;
          position: relative;
        }
        
        .stat-value {
          font-weight: bold;
          font-size: 13px;
        }
        
        .stat-rank {
          font-size: 9px;
          opacity: 0.8;
          position: absolute;
          bottom: 2px;
          right: 4px;
        }
        
        .sortable-header {
          padding: 8px 4px;
          text-align: center;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 11px;
          border-bottom: 2px solid #dee2e6;
        }
        
        .desktop-header {
          display: block;
        }
        
        .mobile-header {
          display: none;
        }
        
        .sortable-header:hover {
          background-color: #e9ecef;
        }
        
        @media (max-width: 768px) {
          .desktop-header {
            display: none;
          }
          
          .mobile-header {
            display: block;
            white-space: pre-line;
            line-height: 1.1;
          }
          
          .team-name-display {
            display: none;
          }
          
          .stat-cell {
            padding: 2px 4px;
          }
          
          .stat-value {
            font-size: 11px;
          }
          
          .stat-rank {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

export default PassingStatsPage;