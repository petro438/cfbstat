import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Helper function to get rank color (matches team page pattern)
const getRankColor = (rank, totalTeams = 134, isHigherBetter = true) => {
  const percentile = isHigherBetter ? 
    ((totalTeams - rank + 1) / totalTeams) * 100 : 
    (rank / totalTeams) * 100;
  
  let bgColor;
  if (percentile >= 96) bgColor = '#58c36c'; // Elite
  else if (percentile >= 91) bgColor = '#6aca7c'; // Excellent
  else if (percentile >= 86) bgColor = '#7cd08b'; // Very Good
  else if (percentile >= 81) bgColor = '#8dd69b'; // Good
  else if (percentile >= 76) bgColor = '#9fddaa'; // Above Average
  else if (percentile >= 71) bgColor = '#b0e3ba'; // Solid
  else if (percentile >= 66) bgColor = '#c2e9c9'; // Decent
  else if (percentile >= 61) bgColor = '#d4f0d9'; // Okay
  else if (percentile >= 56) bgColor = '#e5f6e8'; // Below Average
  else if (percentile >= 51) bgColor = '#f7fcf8'; // Poor
  else if (percentile >= 46) bgColor = '#fdf5f4'; // Poor
  else if (percentile >= 41) bgColor = '#fbe1df'; // Bad
  else if (percentile >= 36) bgColor = '#f9cdc9'; // Bad
  else if (percentile >= 31) bgColor = '#f7b9b4'; // Very Bad
  else if (percentile >= 26) bgColor = '#f5a59f'; // Very Bad
  else if (percentile >= 21) bgColor = '#f2928a'; // Terrible
  else if (percentile >= 16) bgColor = '#f07e74'; // Terrible
  else if (percentile >= 11) bgColor = '#ee6a5f'; // Awful
  else if (percentile >= 6) bgColor = '#ec564a'; // Awful
  else bgColor = '#ea4335'; // Worst
  
  // Calculate text color for contrast
  const color = bgColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
  
  return {
    bg: bgColor,
    text: textColor
  };
};

// Helper function for backwards compatibility with StatCell
const getPercentileColor = (rank, totalTeams, isHigherBetter = true) => {
  return getRankColor(rank, totalTeams, isHigherBetter).bg;
};

const getTextColor = (bgColor) => {
  const color = bgColor.replace('#', '');
  const r = parseInt(color.substr(0, 2), 16);
  const g = parseInt(color.substr(2, 2), 16);
  const b = parseInt(color.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};

// StatCell component for colored values
const StatCell = ({ value, rank, isHigherBetter = true, totalForPercentiles, showRank = false }) => {
  const colors = getRankColor(rank, totalForPercentiles, isHigherBetter);
  
  return (
    <td style={{
      backgroundColor: colors.bg,
      color: colors.text,
      padding: '6px 4px',
      border: '1px solid #dee2e6',
      textAlign: 'center',
      fontFamily: 'Consolas, monospace',
      fontWeight: 'bold',
      width: '100px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '12px', lineHeight: '1' }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </div>
        {showRank && (
          <div style={{
            fontSize: '10px',
            fontWeight: 'normal',
            opacity: 0.8,
            marginTop: '2px',
            lineHeight: '1'
          }}>
            #{rank}
          </div>
        )}
      </div>
    </td>
  );
};

const SOSLeaderboard = () => {
  const [sosData, setSOSData] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overall');
  const [sortConfig, setSortConfig] = useState({ key: 'sos_rank', direction: 'asc' });
  const [selectedConference, setSelectedConference] = useState('all');
  const [conferences, setConferences] = useState([]);
  const [rankingScope, setRankingScope] = useState('national');
  const [conferenceGamesOnly, setConferenceGamesOnly] = useState(false);
  const [regularSeasonOnly, setRegularSeasonOnly] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState('2024');
  const [selectedClassification, setSelectedClassification] = useState('fbs');
  const [availableSeasons] = useState(['2024', '2025']);
  
  useEffect(() => {
    fetchSOSData();
  }, [conferenceGamesOnly, regularSeasonOnly, selectedSeason, selectedClassification]);

  const fetchSOSData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const baseUrl = `http://localhost:5000/api/leaderboards/strength-of-schedule-enhanced/${selectedSeason}`;
      const url = new URL(baseUrl);
      
      if (conferenceGamesOnly) {
        url.searchParams.append('conferenceOnly', 'true');
      }
      
      if (!regularSeasonOnly) {
        url.searchParams.append('includePostseason', 'true');
      }
      
      if (selectedClassification !== 'all') {
        url.searchParams.append('classification', selectedClassification);
      }
      
      console.log('🔍 Fetching SOS data:', url.toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      if (data.teams && Array.isArray(data.teams)) {
        // Create additional rankings
        const teamsWithRankings = [...data.teams];
        
        // Power rating ranking
        teamsWithRankings.sort((a, b) => parseFloat(b.team_rating) - parseFloat(a.team_rating));
        teamsWithRankings.forEach((team, index) => {
          team.power_rating_rank = index + 1;
        });
        
        // Projected wins ranking
        teamsWithRankings.sort((a, b) => parseFloat(b.projected_wins) - parseFloat(a.projected_wins));
        teamsWithRankings.forEach((team, index) => {
          team.projected_wins_rank = index + 1;
        });
        
        // Win difference ranking (actual wins - projected wins, higher is better)
        teamsWithRankings.forEach(team => {
          team.win_difference = team.actual_wins - parseFloat(team.projected_wins);
        });
        teamsWithRankings.sort((a, b) => b.win_difference - a.win_difference);
        teamsWithRankings.forEach((team, index) => {
          team.win_difference_rank = index + 1;
        });
        
        // Restore original SOS order
        const finalTeams = data.teams.map(team => {
          const teamWithRankings = teamsWithRankings.find(t => t.team === team.team);
          return {
            ...team,
            power_rating_rank: teamWithRankings?.power_rating_rank || 1,
            projected_wins_rank: teamWithRankings?.projected_wins_rank || 1,
            win_difference: teamWithRankings?.win_difference || 0,
            win_difference_rank: teamWithRankings?.win_difference_rank || 1
          };
        });
        
        // DEBUG: Check for duplicate Troy/Charlotte entries
        console.log('🐛 Raw API data count:', data.teams.length);
        console.log('🐛 Final teams count:', finalTeams.length);
        console.log('🐛 Troy/Charlotte in raw data:', data.teams.filter(t => 
          t.team && (t.team.includes('Troy') || t.team.includes('Charlotte'))
        ));
        console.log('🐛 Troy/Charlotte in final data:', finalTeams.filter(t => 
          t.team && (t.team.includes('Troy') || t.team.includes('Charlotte'))
        ));
        
        setSOSData(finalTeams);
        setMetadata(data.metadata);
        
        const uniqueConferences = [...new Set(finalTeams.map(team => team.conference))].filter(c => c).sort();
        setConferences(uniqueConferences);
        
        console.log(`✅ Loaded ${finalTeams.length} teams for ${selectedSeason} (${selectedClassification})`);
      } else {
        throw new Error('API returned unexpected format');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching SOS data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedAndFilteredData = () => {
    let data = [...sosData];
    
    if (selectedConference !== 'all') {
      data = data.filter(team => team.conference === selectedConference);
    }
    
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        if (typeof aValue === 'string' && !isNaN(parseFloat(aValue))) {
          aValue = parseFloat(aValue);
        }
        if (typeof bValue === 'string' && !isNaN(parseFloat(bValue))) {
          bValue = parseFloat(bValue);
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    return data;
  };

  const getSortArrow = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
    }
    return sortConfig.direction === 'asc' ? 
      <span style={{ marginLeft: '4px' }}>↑</span> : 
      <span style={{ marginLeft: '4px' }}>↓</span>;
  };

  if (loading) {
    return (
      <div style={{ 
        padding: '8px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 8px',
          color: '#6c757d'
        }}>
          Loading strength of schedule data for {selectedSeason}...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '8px', 
        fontFamily: 'Trebuchet MS, sans-serif',
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        <div style={{ 
          textAlign: 'center', 
          padding: '40px 8px',
          color: '#ea4335'
        }}>
          Error loading data: {error}
        </div>
      </div>
    );
  }

  const totalTeams = selectedConference === 'all' ? sosData.length : 
                   (rankingScope === 'national' ? sosData.length : getSortedAndFilteredData().length);

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
          color: '#212529',
          margin: '0 0 8px 0',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {selectedSeason} STRENGTH OF SCHEDULE
        </h1>
        <p style={{
          fontSize: '14px',
          color: '#6c757d',
          margin: '0 0 16px 0',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {selectedClassification.toUpperCase()} teams • {conferenceGamesOnly ? 'Conference games only • ' : ''}{!regularSeasonOnly ? 'Including postseason • ' : ''}
          Strength of schedule calculated using current team ratings for active seasons & end-of-season rankings for past seasons.
        </p>
      </div>

      {/* Season, Classification, and Conference Filters */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            SEASON:
          </label>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {availableSeasons.map(season => (
              <option key={season} value={season}>
                {season}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            DIVISION:
          </label>
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="fbs">FBS</option>
            <option value="fcs">FCS</option>
            <option value="all">All Divisions</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS, sans-serif',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            CONFERENCE:
          </label>
          <select
            value={selectedConference}
            onChange={(e) => setSelectedConference(e.target.value)}
            style={{
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              fontFamily: 'Trebuchet MS, sans-serif',
              fontSize: '14px',
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Conferences</option>
            {conferences.map(conference => (
              <option key={conference} value={conference}>
                {conference}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Filter Tabs - Sticky */}
      <div style={{
        position: 'sticky',
        top: '0',
        zIndex: 100,
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #dee2e6',
        paddingTop: '8px',
        paddingBottom: '8px',
        marginBottom: '0',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center'
        }}>
          {['overall', 'remaining', 'played'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                margin: '0 4px',
                border: 'none',
                backgroundColor: activeTab === tab ? '#007bff' : 'transparent',
                color: activeTab === tab ? '#ffffff' : '#6c757d',
                fontFamily: 'Trebuchet MS, sans-serif',
                fontSize: '14px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                borderBottom: activeTab === tab ? '2px solid #007bff' : '2px solid transparent',
                transition: 'all 0.2s ease',
                borderRadius: '4px 4px 0 0'
              }}
            >
              {tab === 'overall' ? 'OVERALL' : tab === 'remaining' ? 'REMAINING' : 'PLAYED'}
            </button>
          ))}
        </div>
      </div>

      {/* Checkbox Options */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '16px',
        marginTop: '16px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <label style={{
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={conferenceGamesOnly}
            onChange={(e) => setConferenceGamesOnly(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          CONFERENCE GAMES ONLY
        </label>

        <label style={{
          fontFamily: 'Trebuchet MS, sans-serif',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#212529',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={regularSeasonOnly}
            onChange={(e) => setRegularSeasonOnly(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          REGULAR SEASON ONLY
        </label>
      </div>

      {/* Desktop Table */}
      <div style={{ 
        overflowX: 'auto'
      }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '14px',
          lineHeight: '1.2'
        }}>
          <thead>
            <tr style={{ 
              backgroundColor: '#f8f9fa'
            }}>
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'left', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('team')}
              >
                TEAM {getSortArrow('team')}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  borderLeft: '3px solid #007bff',
                  borderRight: '3px solid #007bff',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort(
                  activeTab === 'overall' ? 'sos_overall' : 
                  activeTab === 'remaining' ? 'sos_remaining' : 
                  'sos_played'
                )}
              >
                {activeTab === 'overall' ? 'SOS OVERALL' : 
                 activeTab === 'remaining' ? 'SOS REMAINING' : 
                 'SOS PLAYED'} {getSortArrow(
                  activeTab === 'overall' ? 'sos_overall' : 
                  activeTab === 'remaining' ? 'sos_remaining' : 
                  'sos_played'
                )}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('actual_wins')}
              >
                RECORD {getSortArrow('actual_wins')}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('projected_wins')}
              >
                PROJ WINS {getSortArrow('projected_wins')}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('win_difference')}
              >
                ACT VS PROJ {getSortArrow('win_difference')}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
                onClick={() => handleSort('top40_games')}
              >
                TOP 40 {getSortArrow('top40_games')}
              </th>
              
              <th 
                style={{ 
                  padding: '8px 4px', 
                  textAlign: 'center', 
                  border: '1px solid #dee2e6',
                  fontFamily: 'Trebuchet MS, sans-serif',
                  fontWeight: 'bold',
                  fontSize: '12px',
                  textTransform: 'uppercase'
                }}
              >
                DIFFICULTY
                <div 
                  title="Game difficulty breakdown: 🪙 Coinflip (40-60% win probability), 🔒 Sure Thing (80%+ win probability), 🎯 Longshot (<20% win probability)"
                  style={{ 
                    cursor: 'help',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '4px',
                    marginTop: '4px',
                    fontSize: '10px'
                  }}
                >
                  <span>🪙</span>
                  <span>🔒</span>
                  <span>🎯</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {getSortedAndFilteredData().map((team, index) => {
              const rank = parseInt(team.sos_rank);
              const powerRank = selectedConference === 'all' ? team.power_rating_rank : 
                              (rankingScope === 'national' ? team.power_rating_rank : 
                              getSortedAndFilteredData()
                                .sort((a, b) => parseFloat(b.team_rating) - parseFloat(a.team_rating))
                                .findIndex(t => t.team === team.team) + 1);
              
              return (
                <tr key={team.team} style={{
                  backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
                }}>
                  {/* Team Name with Rating Badge */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Trebuchet MS, sans-serif',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {team.logo_url && (
                        <img 
                          src={team.logo_url} 
                          alt={team.team}
                          style={{ 
                            width: '20px', 
                            height: '20px',
                            objectFit: 'contain'
                          }}
                        />
                      )}
                      <Link 
                        to={`/team/${team.team.toLowerCase().replace(/\s+/g, '-')}?year=${selectedSeason}`}
                        style={{ 
                          textDecoration: 'none', 
                          color: '#007bff',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        <span className="team-name-desktop">{team.team}</span>
                        <span className="team-name-mobile" style={{ display: 'none' }}>
                          {team.abbreviation || team.team}
                        </span>
                      </Link>
                      {/* Rating Badge */}
                      {(() => {
                        const colors = getRankColor(powerRank, totalTeams, true);
                        return (
                          <span style={{
                            fontSize: '10px',
                            color: colors.text,
                            fontFamily: '"Trebuchet MS", Arial, sans-serif',
                            fontWeight: 'bold',
                            backgroundColor: colors.bg,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            marginLeft: '4px',
                            border: '1px solid rgba(0,0,0,0.1)',
                            minWidth: '20px',
                            textAlign: 'center',
                            display: 'inline-block'
                          }}
                          title={`Power Rating: ${team.team_rating} (Rank #${powerRank})`}
                          >
                            #{powerRank}
                          </span>
                        );
                      })()}
                    </div>
                  </td>
                  
                  {/* Strength of Schedule */}
                  <StatCell 
                    value={
                      activeTab === 'overall' ? (team.sos_overall ? parseFloat(team.sos_overall) : 0) :
                      activeTab === 'remaining' ? (team.sos_remaining ? parseFloat(team.sos_remaining) : 0) :
                      (team.sos_played && team.sos_played !== '0.000' ? parseFloat(team.sos_played) : 0)
                    }
                    rank={selectedConference === 'all' ? rank : 
                          (rankingScope === 'national' ? rank : 
                          getSortedAndFilteredData()
                            .sort((a, b) => parseFloat(b.sos_overall) - parseFloat(a.sos_overall))
                            .findIndex(t => t.team === team.team) + 1)}
                    isHigherBetter={false}
                    totalForPercentiles={totalTeams}
                    showRank={true}
                  />
                  
                  {/* Record */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    {team.actual_wins || 0}-{team.actual_losses || 0}
                  </td>
                  
                  {/* Projected Wins */}
                  <StatCell 
                    value={team.projected_wins ? parseFloat(team.projected_wins) : 0}
                    rank={selectedConference === 'all' ? team.projected_wins_rank : 
                          (rankingScope === 'national' ? team.projected_wins_rank : 
                          getSortedAndFilteredData()
                            .sort((a, b) => parseFloat(b.projected_wins) - parseFloat(a.projected_wins))
                            .findIndex(t => t.team === team.team) + 1)}
                    isHigherBetter={true}
                    totalForPercentiles={totalTeams}
                  />
                  
                  {/* Actual vs Projected Difference */}
                  <StatCell 
                    value={team.win_difference}
                    rank={selectedConference === 'all' ? team.win_difference_rank : 
                          (rankingScope === 'national' ? team.win_difference_rank : 
                          getSortedAndFilteredData()
                            .sort((a, b) => b.win_difference - a.win_difference)
                            .findIndex(t => t.team === team.team) + 1)}
                    isHigherBetter={true}
                    totalForPercentiles={totalTeams}
                  />
                  
                  {/* Top 40 Record */}
                  <td style={{ 
                    padding: '8px 4px', 
                    border: '1px solid #dee2e6',
                    fontFamily: 'Consolas, monospace',
                    textAlign: 'center',
                    fontWeight: 'bold'
                  }}>
                    {team.top40_record || '0-0'}
                  </td>
                  
                  {/* Difficulty Trio */}
                  <td 
                    style={{ 
                      padding: '8px 4px', 
                      border: '1px solid #dee2e6',
                      fontFamily: 'Consolas, monospace',
                      textAlign: 'center'
                    }}
                    title="Game difficulty breakdown: 🪙 Coinflip (40-60% win probability), 🔒 Sure Thing (80%+ win probability), 🎯 Longshot (<20% win probability)"
                  >
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center',
                      alignItems: 'center', 
                      gap: '6px',
                      fontSize: '12px',
                      lineHeight: '1.2'
                    }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#007bff'
                      }}>
                        <span style={{ fontSize: '10px' }}>🪙</span>
                        <span style={{ fontWeight: 'bold' }}>{team.coinflip_games || 0}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#28a745'
                      }}>
                        <span style={{ fontSize: '10px' }}>🔒</span>
                        <span style={{ fontWeight: 'bold' }}>{team.sure_thing_games || 0}</span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px',
                        color: '#dc3545'
                      }}>
                        <span style={{ fontSize: '10px' }}>🎯</span>
                        <span style={{ fontWeight: 'bold' }}>{team.longshot_games || 0}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{
        textAlign: 'center',
        padding: '16px 8px',
        marginTop: '16px',
        borderTop: '1px solid #dee2e6',
        backgroundColor: '#f8f9fa'
      }}>
        <div style={{
          fontSize: '12px',
          color: '#6c757d',
          fontFamily: 'Trebuchet MS, sans-serif'
        }}>
          {conferenceGamesOnly && (
            <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#28a745' }}>
              ⚠️ Conference Games Only - Showing {metadata?.total_teams || sosData.length} teams
            </div>
          )}
          {!regularSeasonOnly && (
            <div style={{ marginBottom: '4px', fontWeight: 'bold', color: '#007bff' }}>
              📅 Including Postseason Games - Showing {metadata?.total_teams || sosData.length} teams
            </div>
          )}
          <div style={{ marginBottom: '4px' }}>
            <strong>{selectedSeason}</strong> • <strong>{selectedClassification.toUpperCase()}</strong> • 
            {metadata?.total_teams || sosData.length} teams analyzed
          </div>
          Win probabilities calculated using NORM.DIST with 13.5 standard deviation • Home field advantage: +2.15 points
        </div>
      </div>

      {/* Mobile CSS */}
      <style jsx>{`
        @media (max-width: 768px) {
          .team-name-desktop {
            display: none !important;
          }
          .team-name-mobile {
            display: inline !important;
          }
        }
        @media (min-width: 769px) {
          .team-name-desktop {
            display: inline !important;
          }
          .team-name-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SOSLeaderboard;