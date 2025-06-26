import React, { useState, useEffect } from 'react';

const LuckLeaderboard = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [conferenceFilter, setConferenceFilter] = useState('all');
  const [conferenceOnlyGames, setConferenceOnlyGames] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(false);
  const [sortColumn, setSortColumn] = useState('expected_vs_actual');
  const [sortDirection, setSortDirection] = useState('asc');
  const [conferences, setConferences] = useState([]);

  useEffect(() => {
    fetchLuckData();
  }, [selectedSeason, conferenceFilter, conferenceOnlyGames, regularSeasonOnly]);

  const fetchLuckData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        includePostseason: (!regularSeasonOnly).toString(),
        conferenceOnly: conferenceOnlyGames.toString()
      });
      
      if (conferenceFilter !== 'all') {
        params.append('conference', conferenceFilter);
      }
      
      const response = await fetch(`http://localhost:5000/api/leaderboards/luck/${selectedSeason}?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch luck data: ${response.status}`);
      }
      
      const data = await response.json();
      const teamsData = data.teams || [];
      
      // Extract unique conferences
      const uniqueConferences = [...new Set(teamsData.map(team => team.conference))].sort();
      setConferences(uniqueConferences);
      
      setTeams(teamsData);
      setError(null);
    } catch (err) {
      console.error('Error fetching luck data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sorting function
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort teams
  const sortedTeams = React.useMemo(() => {
    return [...teams].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null values
      if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      // Convert to numbers if possible
      if (typeof aVal === 'string' && !isNaN(aVal)) aVal = parseFloat(aVal);
      if (typeof bVal === 'string' && !isNaN(bVal)) bVal = parseFloat(bVal);
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [teams, sortColumn, sortDirection]);

  // Get rank color for team rank badges  
  const getRankColor = (rank) => {
    if (!rank || rank < 1) return { bg: '#6c757d', text: '#fff' };
    
    const percentile = ((134 - rank + 1) / 134) * 100;
    
    if (percentile >= 96) return { bg: '#58c36c', text: '#fff' };
    if (percentile >= 91) return { bg: '#6aca7c', text: '#fff' };
    if (percentile >= 86) return { bg: '#7cd08b', text: '#fff' };
    if (percentile >= 81) return { bg: '#8dd69b', text: '#000' };
    if (percentile >= 76) return { bg: '#9fddaa', text: '#000' };
    if (percentile >= 71) return { bg: '#b0e3ba', text: '#000' };
    if (percentile >= 66) return { bg: '#c2e9c9', text: '#000' };
    if (percentile >= 61) return { bg: '#d4f0d9', text: '#000' };
    if (percentile >= 56) return { bg: '#e5f6e8', text: '#000' };
    if (percentile >= 51) return { bg: '#f7fcf8', text: '#000' };
    if (percentile >= 46) return { bg: '#fdf5f4', text: '#000' };
    if (percentile >= 41) return { bg: '#fbe1df', text: '#000' };
    if (percentile >= 36) return { bg: '#f9cdc9', text: '#000' };
    if (percentile >= 31) return { bg: '#f7b9b4', text: '#000' };
    if (percentile >= 26) return { bg: '#f5a59f', text: '#000' };
    if (percentile >= 21) return { bg: '#f2928a', text: '#fff' };
    if (percentile >= 16) return { bg: '#f07e74', text: '#fff' };
    if (percentile >= 11) return { bg: '#ee6a5f', text: '#fff' };
    if (percentile >= 6) return { bg: '#ec564a', text: '#fff' };
    return { bg: '#ea4335', text: '#fff' };
  };

  // Color coding for luck metrics
  const getLuckColor = (value, type) => {
    if (value === null || value === undefined) return '#f8f9fa';
    
    if (type === 'expected_difference') {
      // For Expected vs Actual differences (ACTUAL - EXPECTED)
      // Positive = lucky/overperformed (green), Negative = unlucky/underperformed (red)
      if (value >= 3) return '#58c36c';       // Very lucky (deep green)
      if (value >= 2) return '#7cd08b';       // Lucky (green)
      if (value >= 1) return '#b0e3ba';       // Slightly lucky (light green)
      if (value >= 0.5) return '#d4f0d9';     // Mildly lucky
      if (value <= -3) return '#ea4335';      // Very unlucky (deep red)
      if (value <= -2) return '#f2928a';      // Unlucky (red)
      if (value <= -1) return '#f9cdc9';      // Slightly unlucky (light red)
      if (value <= -0.5) return '#fbe1df';    // Mildly unlucky
      return '#f7fcf8';                       // Neutral (near zero)
    } else if (type === 'deserved_difference') {
      // For Deserved vs Actual differences (DESERVED - ACTUAL)
      // Positive = unlucky/deserved better (green), Negative = lucky/overperformed (red)
      if (value >= 3) return '#58c36c';       // Very unlucky (deep green)
      if (value >= 2) return '#7cd08b';       // Unlucky (green)
      if (value >= 1) return '#b0e3ba';       // Slightly unlucky (light green)
      if (value >= 0.5) return '#d4f0d9';     // Mildly unlucky
      if (value <= -3) return '#ea4335';      // Very lucky (deep red)
      if (value <= -2) return '#f2928a';      // Lucky (red)
      if (value <= -1) return '#f9cdc9';      // Slightly lucky (light red)
      if (value <= -0.5) return '#fbe1df';    // Mildly lucky
      return '#f7fcf8';                       // Neutral (near zero)
    } else if (type === 'expected_vs_deserved') {
      // For Expected vs Deserved differences (DESERVED - EXPECTED)
      // Positive = better performance than markets expected (green), Negative = worse performance (red)
      if (value >= 3) return '#58c36c';       // Much better than expected (deep green)
      if (value >= 2) return '#7cd08b';       // Better than expected (green)
      if (value >= 1) return '#b0e3ba';       // Slightly better (light green)
      if (value >= 0.5) return '#d4f0d9';     // Mildly better
      if (value <= -3) return '#ea4335';      // Much worse than expected (deep red)
      if (value <= -2) return '#f2928a';      // Worse than expected (red)
      if (value <= -1) return '#f9cdc9';      // Slightly worse (light red)
      if (value <= -0.5) return '#fbe1df';    // Mildly worse
      return '#f7fcf8';                       // Neutral (near zero)
    } else if (type === 'turnover_margin') {
      // Higher is better (positive turnover margin)
      if (value >= 15) return '#58c36c';      // Very good
      if (value >= 10) return '#7cd08b';      // Good  
      if (value >= 5) return '#b0e3ba';       // Slightly good
      if (value >= 0) return '#f7fcf8';       // Neutral
      if (value >= -5) return '#fbe1df';      // Slightly bad
      if (value >= -10) return '#f2928a';     // Bad
      return '#ea4335';                       // Very bad
    }
    
    return '#f8f9fa'; // Default
  };

  const formatStat = (value, decimals = 1) => {
    if (value === null || value === undefined) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : value;
  };

  // Sortable header component
  const SortableHeader = ({ column, children, style = {} }) => (
    <th 
      style={{
        ...headerStyle,
        ...style,
        cursor: 'pointer',
        backgroundColor: sortColumn === column ? '#007bff' : '#f8f9fa',
        color: sortColumn === column ? 'white' : 'inherit'
      }}
      onClick={() => handleSort(column)}
    >
      {children} {sortColumn === column && (sortDirection === 'asc' ? '↑' : '↓')}
    </th>
  );

  const cellStyle = {
    padding: '8px',
    border: '1px solid #dee2e6',
    textAlign: 'center',
    fontSize: '13px',
    fontFamily: 'Consolas, monospace'
  };

  const headerStyle = {
    ...cellStyle,
    backgroundColor: '#f8f9fa',
    fontWeight: 'bold',
    fontSize: '11px',
    textTransform: 'uppercase',
    fontFamily: '"Trebuchet MS", Arial, sans-serif'
  };

  const groupHeaderStyle = {
    ...headerStyle,
    backgroundColor: '#e9ecef',
    fontSize: '10px',
    color: '#6c757d'
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px',
        fontFamily: '"Trebuchet MS", Arial, sans-serif'
      }}>
        Loading luck data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '40px',
        color: '#d32f2f',
        fontFamily: '"Trebuchet MS", Arial, sans-serif'
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: '"Trebuchet MS", Arial, sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        backgroundColor: '#343a40',
        color: 'white',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ margin: '0', fontSize: '28px' }}>🍀 LUCK LEADERBOARD</h1>
        <div style={{ fontSize: '16px', opacity: 0.9, marginTop: '8px' }}>
          Measuring fortune, misfortune, and everything in between
        </div>
      </div>

      {/* Explainer Section */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#343a40' }}>How These Stats Work</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '15px',
          fontSize: '14px',
          lineHeight: '1.4'
        }}>
          <div>
            <strong style={{ color: '#007bff' }}>Expected Wins:</strong> Based on closing betting line before each individual game, not a preseason win total. If a team was favored by 7 points, they had roughly a 70% chance to win that game.
          </div>
          <div>
            <strong style={{ color: '#28a745' }}>Deserved Wins:</strong> Based on postgame win probability, which attempts to remove luck and determine which team would win if the game were played an infinite number of times.
          </div>
          <div>
            <strong style={{ color: '#ffc107' }}>Turnover Luck:</strong> Fumble recovery rates and interception-to-deflection ratios that measure how lucky or unlucky a team has been with turnovers throughout the season.
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Season:</label>
          <select 
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>

        <div>
          <label style={{ marginRight: '8px', fontWeight: 'bold' }}>Conference:</label>
          <select 
            value={conferenceFilter}
            onChange={(e) => setConferenceFilter(e.target.value)}
            style={{
              padding: '8px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            <option value="all">All Conferences</option>
            {conferences.map(conf => (
              <option key={conf} value={conf}>{conf}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={conferenceOnlyGames}
              onChange={(e) => setConferenceOnlyGames(e.target.checked)}
            />
            <span style={{ fontWeight: 'bold' }}>Conference Games Only</span>
          </label>
        </div>

        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={regularSeasonOnly}
              onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            />
            <span style={{ fontWeight: 'bold' }}>Regular Season Only</span>
          </label>
        </div>
        
        <div style={{ fontSize: '14px', color: '#6c757d' }}>
          {teams.length} teams • Updated {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Table */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: '0 20px 20px',
        overflowX: 'auto'
      }}>
        <style>
          {`
            /* Desktop: Show full team names */
            @media (min-width: 769px) {
              .team-name-desktop { display: inline !important; }
              .team-name-mobile { display: none !important; }
            }
            
            /* Mobile: Show abbreviations */
            @media (max-width: 768px) {
              .team-name-desktop { display: none !important; }
              .team-name-mobile { display: inline !important; }
            }
          `}
        </style>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          border: '1px solid #dee2e6',
          fontSize: '13px'
        }}>
          <thead>
            {/* Group headers */}
            <tr>
              <th style={groupHeaderStyle} rowSpan="2">Team</th>
              <th style={groupHeaderStyle} rowSpan="2">Record</th>
              <th style={{...groupHeaderStyle, borderRight: '3px solid #007bff'}} colSpan="2">Expected vs Actual</th>
              <th style={{...groupHeaderStyle, borderRight: '3px solid #28a745'}} colSpan="2">Deserved vs Actual</th>
              <th style={groupHeaderStyle}></th>
              <th style={groupHeaderStyle}></th>
              <th style={{...groupHeaderStyle, borderRight: '3px solid #ffc107'}} colSpan="3">Turnover Luck</th>
            </tr>
            
            {/* Individual column headers */}
            <tr>
              <SortableHeader column="expected_wins" style={{fontSize: '10px'}}>Expected<br/>Wins</SortableHeader>
              <SortableHeader column="expected_vs_actual" style={{fontSize: '10px', borderRight: '3px solid #007bff'}}>Difference</SortableHeader>
              <SortableHeader column="deserved_wins" style={{fontSize: '10px'}}>Deserved<br/>Wins</SortableHeader>
              <SortableHeader column="deserved_vs_actual" style={{fontSize: '10px', borderRight: '3px solid #28a745'}}>Difference</SortableHeader>
              <SortableHeader column="expected_vs_deserved" style={{fontSize: '10px', borderRight: '3px solid #6f42c1'}}>Expected vs<br/>Deserved</SortableHeader>
              <SortableHeader column="close_game_record" style={{fontSize: '10px', borderRight: '3px solid #dc3545'}}>Close Games<br/>(≤8 pts)</SortableHeader>
              <SortableHeader column="fumble_recovery_rate" style={{fontSize: '10px'}}>Fumble<br/>Recovery %</SortableHeader>
              <SortableHeader column="interception_rate" style={{fontSize: '10px'}}>Interception<br/>Rate %</SortableHeader>
              <SortableHeader column="turnover_margin" style={{fontSize: '10px', borderRight: '3px solid #ffc107'}}>Turnover<br/>Margin</SortableHeader>
            </tr>
          </thead>
          
          <tbody>
            {sortedTeams.map((team, index) => {
              const colors = getRankColor(team.power_rank);
              
              return (
                <tr key={team.team} style={{ 
                  backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
                }}>
                  {/* Team */}
                  <td style={{...cellStyle, textAlign: 'left'}}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        minWidth: '24px',
                        textAlign: 'center'
                      }}>
                        #{team.power_rank}
                      </span>
                      
                      <a 
                        href={`/team/${encodeURIComponent(team.team)}/2024`}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px',
                          textDecoration: 'none',
                          color: 'inherit',
                          cursor: 'pointer'
                        }}
                        onMouseOver={(e) => e.target.closest('a').style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.target.closest('a').style.textDecoration = 'none'}
                      >
                        <img 
                          src={team.logo_url} 
                          alt={`${team.team} logo`}
                          style={{ width: '24px', height: '24px' }}
                        />
                        
                        {/* Desktop: Full team name */}
                        <span 
                          className="team-name-desktop"
                          style={{ 
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            fontFamily: '"Trebuchet MS", Arial, sans-serif'
                          }}
                        >
                          {team.team}
                        </span>
                        
                        {/* Mobile: Team abbreviation */}
                        <span 
                          className="team-name-mobile"
                          style={{ 
                            fontWeight: 'bold',
                            textTransform: 'uppercase',
                            fontFamily: '"Trebuchet MS", Arial, sans-serif',
                            display: 'none'
                          }}
                        >
                          {team.abbreviation || team.team}
                        </span>
                      </a>
                    </div>
                  </td>
                  
                  {/* Record */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {team.record}
                  </td>
                  
                  {/* Expected Wins */}
                  <td style={{...cellStyle, backgroundColor: '#e3f2fd'}}>
                    {formatStat(team.expected_wins, 1)}
                  </td>
                  
                  {/* Expected vs Actual Difference */}
                  <td style={{
                    ...cellStyle, 
                    backgroundColor: getLuckColor(team.expected_vs_actual, 'expected_difference'),
                    borderRight: '3px solid #007bff',
                    fontWeight: 'bold'
                  }}>
                    {team.expected_vs_actual !== null ? 
                      (team.expected_vs_actual > 0 ? '+' : '') + formatStat(team.expected_vs_actual, 1) : 'N/A'}
                  </td>
                  
                  {/* Deserved Wins */}
                  <td style={{...cellStyle, backgroundColor: '#e8f5e8'}}>
                    {formatStat(team.deserved_wins, 1)}
                  </td>
                  
                  {/* Deserved vs Actual Difference */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getLuckColor(team.deserved_vs_actual, 'deserved_difference'),
                    borderRight: '3px solid #28a745',
                    fontWeight: 'bold'
                  }}>
                    {team.deserved_vs_actual > 0 ? '+' : ''}{formatStat(team.deserved_vs_actual, 1)}
                  </td>
                  
                  {/* Expected vs Deserved */}
                  <td style={{
                    ...cellStyle, 
                    backgroundColor: getLuckColor(team.expected_vs_deserved, 'expected_vs_deserved'),
                    borderRight: '3px solid #6f42c1',
                    fontWeight: 'bold'
                  }}>
                    {team.expected_vs_deserved !== null ? 
                      (team.expected_vs_deserved > 0 ? '+' : '') + formatStat(team.expected_vs_deserved, 1) : 'N/A'}
                  </td>
                  
                  {/* Close Games Record */}
                  <td style={{
                    ...cellStyle, 
                    fontWeight: 'bold',
                    borderRight: '3px solid #dc3545'
                  }}>
                    {team.close_game_record}
                  </td>
                  
                  {/* Fumble Recovery % */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {formatStat(team.fumble_recovery_rate, 1)}%
                  </td>
                  
                  {/* Interception Rate % */}
                  <td style={{...cellStyle, fontWeight: 'bold'}}>
                    {formatStat(team.interception_rate, 1)}%
                  </td>
                  
                  {/* Turnover Margin */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getLuckColor(team.turnover_margin, 'turnover_margin'),
                    borderRight: '3px solid #ffc107',
                    fontWeight: 'bold'
                  }}>
                    {team.turnover_margin > 0 ? '+' : ''}{team.turnover_margin}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '20px',
        fontSize: '12px',
        color: '#6c757d',
        borderTop: '1px solid #dee2e6'
      }}>
        <h4 style={{ margin: '0 0 10px 0' }}>How to Read This:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px' }}>
          <li><strong>Expected Wins:</strong> Sum of pregame win probabilities from betting odds</li>
          <li><strong>Deserved Wins:</strong> Sum of postgame win probabilities based on performance</li> 
          <li><strong>Difference:</strong> Positive = lucky/fortunate, Negative = unlucky/unfortunate</li>
          <li><strong>Fumble Recovery %:</strong> Percentage of all fumbles (team + opponent) that were recovered by the team</li>
          <li><strong>Interception Rate %:</strong> Percentage of total interceptions in team's games that were made by the team</li>
          <li><strong>Expected vs Deserved:</strong> How actual performance compared to betting market expectations - positive means team performed better than markets expected</li>
          <li><strong>Turnover Margin:</strong> Total takeaways minus total turnovers</li>
        </ul>
      </div>
    </div>
  );
};

export default LuckLeaderboard;