import React, { useState, useEffect } from 'react';

// StatCell component for displaying stats with color coding
const StatCell = ({ value, percentile, suffix = '', isPercentage = false }) => {
  const getPercentileColor = (percentile) => {
    if (percentile >= 96) return '#58c36c';
    if (percentile >= 91) return '#6aca7c';
    if (percentile >= 86) return '#7cd08b';
    if (percentile >= 81) return '#8dd69b';
    if (percentile >= 76) return '#9fddaa';
    if (percentile >= 71) return '#b0e3ba';
    if (percentile >= 66) return '#c2e9c9';
    if (percentile >= 61) return '#d4f0d9';
    if (percentile >= 56) return '#e5f6e8';
    if (percentile >= 51) return '#f7fcf8';
    if (percentile >= 46) return '#fdf5f4';
    if (percentile >= 41) return '#fbe1df';
    if (percentile >= 36) return '#f9cdc9';
    if (percentile >= 31) return '#f7b9b4';
    if (percentile >= 26) return '#f5a59f';
    if (percentile >= 21) return '#f2928a';
    if (percentile >= 16) return '#f07e74';
    if (percentile >= 11) return '#ee6a5f';
    if (percentile >= 6) return '#ec564a';
    return '#ea4335';
  };

  const backgroundColor = getPercentileColor(percentile);
  const textColor = percentile >= 56 ? '#000' : '#fff';
  
  const displayValue = isPercentage ? `${value}%` : `${value}${suffix}`;

  return (
    <div 
      className="stat-cell"
      style={{ 
        backgroundColor, 
        color: textColor,
        padding: '4px 8px',
        textAlign: 'center',
        fontSize: '13px',
        fontFamily: 'Consolas, monospace',
        fontWeight: 'normal',
        border: '1px solid #dee2e6',
        minWidth: '60px'
      }}
    >
      {displayValue}
      <div style={{ 
        fontSize: '10px', 
        opacity: 0.8,
        fontFamily: 'Trebuchet MS, sans-serif'
      }}>
        {percentile}
      </div>
    </div>
  );
};

const DriveEfficiencyLeaderboard = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedConference, setSelectedConference] = useState('All');
  const [sortField, setSortField] = useState('available_yards_efficiency');
  const [sortDirection, setSortDirection] = useState('desc');
  const [season] = useState('2024');

  useEffect(() => {
    fetchDriveEfficiencyData();
  }, [season]);

  const fetchDriveEfficiencyData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:5000/api/leaderboards/drive-efficiency/${season}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Drive efficiency data:', data);
      
      // Handle both possible data formats
      let teamsArray = null;
      
      if (data.teams && Array.isArray(data.teams)) {
        // Format: {metadata: {...}, teams: [...]}
        teamsArray = data.teams;
      } else if (data.data && Array.isArray(data.data)) {
        // Format: {data: [...], season: '2024', ...}
        teamsArray = data.data;
      } else {
        console.error('Unexpected data format:', data);
        setError('Invalid data format received');
        return;
      }
      
      // Debug: log the first team to see the actual structure
      if (teamsArray.length > 0) {
        console.log('First team structure:', teamsArray[0]);
        console.log('Available fields:', Object.keys(teamsArray[0]));
      }
      
      setTeams(teamsArray);
    } catch (err) {
      console.error('Error fetching drive efficiency data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortedTeams = () => {
    let filteredTeams = teams;
    
    if (selectedConference !== 'All') {
      filteredTeams = teams.filter(team => team.conference === selectedConference);
    }

    return [...filteredTeams].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Convert string numbers to actual numbers for proper sorting
      if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
        aVal = parseFloat(aVal);
      }
      if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) {
        bVal = parseFloat(bVal);
      }
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const getUniqueConferences = () => {
    const conferences = [...new Set(teams.map(team => team.conference))];
    return conferences.filter(conf => conf).sort();
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontFamily: 'Trebuchet MS, sans-serif' }}>
          Loading drive efficiency data...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#dc3545' }}>
        <div style={{ fontSize: '18px', fontFamily: 'Trebuchet MS, sans-serif' }}>
          Error: {error}
        </div>
        <button 
          onClick={fetchDriveEfficiencyData}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontFamily: 'Trebuchet MS, sans-serif'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  const sortedTeams = getSortedTeams();

  return (
    <div style={{ 
      padding: '8px', 
      fontFamily: 'Trebuchet MS, sans-serif',
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ 
        marginBottom: '16px',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          margin: '0 0 8px 0',
          color: '#212529'
        }}>
          Drive Efficiency Leaderboard
        </h1>
        <div style={{ 
          fontSize: '14px', 
          color: '#6c757d',
          marginBottom: '12px'
        }}>
          {season} Season • {sortedTeams.length} Teams
        </div>
        
        {/* Conference Filter */}
        <div style={{ marginBottom: '12px' }}>
          <label style={{ 
            marginRight: '8px',
            fontSize: '14px',
            fontWeight: 'bold'
          }}>
            Conference:
          </label>
          <select
            value={selectedConference}
            onChange={(e) => setSelectedConference(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '14px',
              fontFamily: 'Trebuchet MS, sans-serif',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#fff'
            }}
          >
            <option value="All">All Conferences</option>
            {getUniqueConferences().map(conf => (
              <option key={conf} value={conf}>{conf}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Explanation */}
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '12px',
        marginBottom: '16px',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
          Drive Efficiency Metrics:
        </div>
        <div style={{ fontSize: '12px', lineHeight: '1.4', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px' }}>
          <div><strong>Available Yards %:</strong> Yards gained / Available yards to goal</div>
          <div><strong>Scoring %:</strong> Drives ending in FG attempt or touchdown</div>
          <div><strong>Opportunities/Game:</strong> Times reached opponent's 40-yard line</div>
          <div><strong>Opp Created/Game:</strong> Started own side, reached opponent's 40</div>
          <div><strong>Points/Opportunity:</strong> Points scored per drive reaching opponent's 40</div>
          <div><strong>Long Fields/Game:</strong> Started deep, reached midfield</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          backgroundColor: '#fff'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'left',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase'
              }}>
                Rank
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'left',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('team')}
              >
                Team {getSortIcon('team')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('conference')}
              >
                Conf {getSortIcon('conference')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('available_yards_efficiency')}
              >
                Avail Yds Eff {getSortIcon('available_yards_efficiency')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('scoring_percentage')}
              >
                Scoring % {getSortIcon('scoring_percentage')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('opportunities_per_game')}
              >
                Opp/Game {getSortIcon('opportunities_per_game')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('opportunities_created_per_game')}
              >
                Opp Created {getSortIcon('opportunities_created_per_game')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('points_per_opportunity')}
              >
                Pts/Opp {getSortIcon('points_per_opportunity')}
              </th>
              <th style={{ 
                padding: '8px 4px',
                textAlign: 'center',
                borderBottom: '2px solid #dee2e6',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
              onClick={() => handleSort('long_fields_per_game')}
              >
                Long Fields {getSortIcon('long_fields_per_game')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedTeams.map((team, index) => (
              <tr key={`${team.team}-${index}`} style={{ 
                backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                borderBottom: '1px solid #dee2e6'
              }}>
                <td style={{ 
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontFamily: 'Consolas, monospace',
                  fontSize: '12px'
                }}>
                  {index + 1}
                </td>
                <td style={{ 
                  padding: '6px 4px',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {team.logo && (
                      <img 
                        src={team.logo} 
                        alt={team.team}
                        style={{ 
                          width: '20px', 
                          height: '20px', 
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    <span style={{ 
                      fontFamily: 'Trebuchet MS, sans-serif',
                      fontWeight: 'bold',
                      fontSize: '12px',
                      textTransform: 'uppercase'
                    }}>
                      {team.team || 'Unknown Team'}
                    </span>
                  </div>
                </td>
                <td style={{ 
                  padding: '6px 4px',
                  textAlign: 'center',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontSize: '11px'
                }}>
                  {team.conference || 'N/A'}
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.available_yards_efficiency) || 0} 
                    percentile={101 - parseInt(team.efficiency_rank) || 50}
                    suffix=""
                  />
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.scoring_percentage) || 0} 
                    percentile={101 - parseInt(team.scoring_rank) || 50}
                    isPercentage={true}
                  />
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.opportunities_per_game) || 0} 
                    percentile={101 - parseInt(team.opportunities_rank) || 50}
                  />
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.opportunities_created_per_game) || 0} 
                    percentile={101 - parseInt(team.opportunities_created_rank) || 50}
                  />
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.points_per_opportunity) || 0} 
                    percentile={101 - parseInt(team.points_per_opp_rank) || 50}
                  />
                </td>
                <td style={{ padding: '2px' }}>
                  <StatCell 
                    value={parseFloat(team.long_fields_per_game) || 0} 
                    percentile={101 - parseInt(team.long_fields_rank) || 50}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        fontSize: '12px',
        color: '#6c757d'
      }}>
        <div><strong>Data Notes:</strong></div>
        <div>• Rankings based on percentiles (1-100 scale) with color coding</div>
        <div>• Minimum 8 games played for inclusion</div>
        <div>• Drive data automatically detects yard line conventions</div>
        <div>• Only FBS teams included in calculations</div>
      </div>
    </div>
  );
};

export default DriveEfficiencyLeaderboard;