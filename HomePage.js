import React, { useState, useMemo, useEffect } from 'react';

// 20-color percentile system
const getPercentileColor = (rank, total) => {
  const percentile = ((total - rank + 1) / total) * 100;
  
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

function HomePage() {
  const [sortField, setSortField] = useState('powerRating');
  const [sortDirection, setSortDirection] = useState('desc');
  const [allTeams, setAllTeams] = useState([]);
  const [selectedConference, setSelectedConference] = useState('All Teams');
  const [rankingScope, setRankingScope] = useState('national'); // 'national' or 'conference'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Year and classification filters
  const [selectedYear, setSelectedYear] = useState(2025);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedClassification, setSelectedClassification] = useState('FBS'); // 'FBS', 'FCS', 'All'

  // Fetch available years
  useEffect(() => {
    const fetchAvailableYears = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/available-years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        
        // Set the most recent year as default if available
        if (data.years && data.years.length > 0) {
          setSelectedYear(data.years[0]); // First item should be most recent due to ORDER BY DESC
        }
      } catch (err) {
        console.error('Error fetching available years:', err);
        setAvailableYears([2024, 2025]); // Fallback
      }
    };

    fetchAvailableYears();
  }, []);

  // Load data from database with year parameter
  const loadDatabaseData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(`🔄 Loading data for year: ${selectedYear}`);
      console.log(`🌐 Making request to: http://localhost:5000/api/power-rankings?year=${selectedYear}`);
      
      const response = await fetch(`http://localhost:5000/api/power-rankings?year=${selectedYear}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} - ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`📊 API Response for ${selectedYear}:`, {
        type: Array.isArray(result) ? 'array' : 'object',
        season: result.season,
        teamCount: Array.isArray(result) ? result.length : result.teams?.length,
        firstTeam: Array.isArray(result) ? result[0] : result.teams?.[0]
      });
      
      // Handle both old format (array) and new format (object with teams array)
      const data = Array.isArray(result) ? result : result.teams || [];
      
      console.log(`📈 Processing ${data.length} teams for ${selectedYear}`);
      
      // Process the data to match our component structure
      const processedTeams = data.map(team => ({
        teamName: team.team_name,
        powerRating: Number(team.power_rating) || 0,
        offenseRating: Number(team.offense_rating) || 0,
        defenseRating: Number(team.defense_rating) || 0,
        strengthOfSchedule: Number(team.strength_of_schedule) || 0,
        conference: team.conference || 'Unknown',
        logo: team.logo || `http://a.espncdn.com/i/teamlogos/ncaa/500/default.png`,
        abbreviation: team.abbreviation || team.team_name?.substring(0, 4).toUpperCase(),
        season: team.season || selectedYear,
        // Rankings come pre-calculated from the database
        powerRank: Number(team.power_rank) || 0,
        offenseRank: Number(team.offense_rank) || 0,
        defenseRank: Number(team.defense_rank) || 0,
        sosRank: Number(team.sos_rank) || 0,
        // Use the classification from the database directly
        classification: normalizeClassification(team.classification)
      }));
      
      console.log(`✅ Processed teams by classification:`, getClassificationBreakdown(processedTeams));
      
      setAllTeams(processedTeams);
      setLoading(false);
    } catch (err) {
      console.error('Error loading database data:', err);
      setError(`Failed to load data from database: ${err.message}`);
      setLoading(false);
    }
  };

  // Normalize classification values from database
  const normalizeClassification = (classification) => {
    if (!classification) return 'Unknown';
    
    const normalized = classification.toLowerCase().trim();
    
    if (normalized === 'fbs' || normalized === 'division i fbs') return 'FBS';
    if (normalized === 'fcs' || normalized === 'division i fcs') return 'FCS';
    if (normalized === 'd2' || normalized === 'division ii') return 'D2';
    if (normalized === 'd3' || normalized === 'division iii') return 'D3';
    
    // Default fallback - assume FBS for major conferences
    const majorConferences = ['SEC', 'Big Ten', 'Big 12', 'ACC', 'Pac-12', 'American', 'Mountain West', 'Conference USA', 'MAC', 'Sun Belt'];
    // This would need the team's conference, but for now we'll return unknown
    
    return 'Unknown';
  };

  // Helper function to get classification breakdown for debugging
  const getClassificationBreakdown = (teams) => {
    const breakdown = {};
    teams.forEach(team => {
      const classification = team.classification || 'Unknown';
      breakdown[classification] = (breakdown[classification] || 0) + 1;
    });
    return breakdown;
  };

  // DEBUG: Log when selectedYear changes
  useEffect(() => {
    console.log(`🎯 selectedYear changed to: ${selectedYear}`);
    console.log(`📱 Current availableYears:`, availableYears);
  }, [selectedYear]);

  // Load data when year changes
  useEffect(() => {
    console.log(`🔄 useEffect triggered - selectedYear: ${selectedYear}`);
    if (selectedYear) {
      loadDatabaseData();
    }
  }, [selectedYear]);

  // Reset ranking scope when changing conferences
  useEffect(() => {
    if (selectedConference === 'All Teams') {
      setRankingScope('national');
    }
  }, [selectedConference]);

  // Filter teams by classification first, then by conference
  const classificationFilteredTeams = useMemo(() => {
    console.log(`🔍 Filtering by classification: ${selectedClassification}`);
    console.log(`📊 Total teams before classification filter: ${allTeams.length}`);
    
    if (selectedClassification === 'All') {
      console.log(`✅ Showing all teams: ${allTeams.length}`);
      return allTeams;
    }
    
    const filtered = allTeams.filter(team => {
      const teamClassification = team.classification;
      const matches = teamClassification === selectedClassification;
      
      if (!matches) {
        console.log(`❌ ${team.teamName}: ${teamClassification} !== ${selectedClassification}`);
      }
      
      return matches;
    });
    
    console.log(`✅ Teams after ${selectedClassification} filter: ${filtered.length}`);
    console.log(`📋 Classification breakdown:`, getClassificationBreakdown(filtered));
    
    return filtered;
  }, [allTeams, selectedClassification]);

  // Get unique conferences for the dropdown (from classification-filtered teams)
  const conferences = useMemo(() => {
    if (classificationFilteredTeams.length === 0) return [];
    
    const uniqueConferences = [...new Set(classificationFilteredTeams.map(team => team.conference))]
      .filter(conf => conf && conf !== 'Unknown')
      .sort();
    
    return ['All Teams', ...uniqueConferences];
  }, [classificationFilteredTeams]);

  // Filter teams by selected conference (after classification filter)
  const filteredTeams = useMemo(() => {
    if (selectedConference === 'All Teams') {
      return classificationFilteredTeams;
    }
    return classificationFilteredTeams.filter(team => team.conference === selectedConference);
  }, [classificationFilteredTeams, selectedConference]);

  // Reset conference when classification changes
  useEffect(() => {
    setSelectedConference('All Teams');
  }, [selectedClassification]);

  // 🔧 FIXED: Calculate rankings based on scope (conference vs national/classification)
  const rankedData = useMemo(() => {
    if (filteredTeams.length === 0) return [];
    
    const data = [...filteredTeams];
    
    if (rankingScope === 'conference' && selectedConference !== 'All Teams') {
      // Conference-only rankings: rank within the filtered conference teams
      const powerSorted = [...data].sort((a, b) => b.powerRating - a.powerRating);
      const offenseSorted = [...data].sort((a, b) => b.offenseRating - a.offenseRating);
      const defenseSorted = [...data].sort((a, b) => b.defenseRating - a.defenseRating);
      const sosSorted = [...data].sort((a, b) => b.strengthOfSchedule - a.strengthOfSchedule);
      
      return data.map(team => ({
        ...team,
        displayPowerRank: powerSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displayOffenseRank: offenseSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displayDefenseRank: defenseSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displaySosRank: sosSorted.findIndex(t => t.teamName === team.teamName) + 1,
        // Keep original ranks for comparison
        nationalPowerRank: team.powerRank,
        nationalOffenseRank: team.offenseRank,
        nationalDefenseRank: team.defenseRank,
        nationalSosRank: team.sosRank
      }));
    } else {
      // National/classification rankings: recalculate ranks within the classification filter
      const powerSorted = [...classificationFilteredTeams].sort((a, b) => b.powerRating - a.powerRating);
      const offenseSorted = [...classificationFilteredTeams].sort((a, b) => b.offenseRating - a.offenseRating);
      const defenseSorted = [...classificationFilteredTeams].sort((a, b) => b.defenseRating - a.defenseRating);
      const sosSorted = [...classificationFilteredTeams].sort((a, b) => b.strengthOfSchedule - a.strengthOfSchedule);
      
      return data.map(team => ({
        ...team,
        displayPowerRank: powerSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displayOffenseRank: offenseSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displayDefenseRank: defenseSorted.findIndex(t => t.teamName === team.teamName) + 1,
        displaySosRank: sosSorted.findIndex(t => t.teamName === team.teamName) + 1,
        // Keep original ranks for comparison
        nationalPowerRank: team.powerRank,
        nationalOffenseRank: team.offenseRank,
        nationalDefenseRank: team.defenseRank,
        nationalSosRank: team.sosRank
      }));
    }
  }, [filteredTeams, classificationFilteredTeams, rankingScope, selectedConference]);

  const sortedData = useMemo(() => {
    return [...rankedData].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortDirection === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
  }, [rankedData, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // 🔧 FIXED: Get the total count for percentile calculations based on ranking scope
  const totalForPercentiles = useMemo(() => {
    if (rankingScope === 'conference' && selectedConference !== 'All Teams') {
      // Conference mode: use only teams in the selected conference
      return filteredTeams.length;
    } else {
      // National/classification mode: use all teams in the classification
      return classificationFilteredTeams.length;
    }
  }, [rankingScope, selectedConference, filteredTeams.length, classificationFilteredTeams.length]);

  const StatCell = ({ value, rank, isHigherBetter = true }) => (
    <td style={{
      backgroundColor: getPercentileColor(isHigherBetter ? rank : totalForPercentiles - rank + 1, totalForPercentiles),
      padding: '6px 4px',
      border: '1px solid #dee2e6',
      textAlign: 'center',
      fontFamily: 'Consolas, monospace',
      fontWeight: 'bold',
      width: '120px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '12px', lineHeight: '1' }}>
          {value.toFixed(1)}
        </div>
        <div style={{
          fontSize: '10px',
          fontWeight: 'normal',
          opacity: 0.8,
          marginTop: '2px',
          lineHeight: '1'
        }}>
          #{rank}
        </div>
      </div>
    </td>
  );

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Trebuchet MS'
      }}>
        <div>Loading {selectedYear} season data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontFamily: 'Trebuchet MS',
        flexDirection: 'column',
        color: '#d32f2f'
      }}>
        <div>{error}</div>
        <div style={{ marginTop: '10px' }}>
          <button 
            onClick={() => loadDatabaseData()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: 'Trebuchet MS, sans-serif', 
      padding: '8px', 
      backgroundColor: '#ffffff',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <h1 style={{ 
        textAlign: 'center',
        color: '#212529',
        fontSize: '24px',
        fontWeight: 'bold'
      }}>
        College Football Power Rankings
      </h1>
      
      <div style={{
        backgroundColor: '#f8f9fa',
        padding: '12px',
        margin: '8px 0',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        <p style={{ margin: '0', textAlign: 'center', fontSize: '14px' }}>
          <strong>How to use these ratings:</strong> Subtract the higher team's rating from the lower team's rating to get a hypothetical point spread in a neutral-field game. Add about 2.15 points for home field advantage.
        </p>
      </div>

      {/* Year and Classification Filters */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '16px 0',
        gap: '20px',
        flexWrap: 'wrap',
        backgroundColor: '#f8f9fa',
        padding: '12px',
        borderRadius: '4px',
        border: '1px solid #dee2e6'
      }}>
        {/* Year Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            Season:
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{
              fontFamily: 'Trebuchet MS',
              fontSize: '14px',
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              minWidth: '80px'
            }}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        {/* Classification Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{
            fontFamily: 'Trebuchet MS',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            Classification:
          </label>
          <select
            value={selectedClassification}
            onChange={(e) => setSelectedClassification(e.target.value)}
            style={{
              fontFamily: 'Trebuchet MS',
              fontSize: '14px',
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: '#ffffff',
              cursor: 'pointer',
              minWidth: '80px'
            }}
          >
            <option value="FBS">FBS</option>
            <option value="FCS">FCS</option>
            <option value="All">All</option>
          </select>
        </div>
      </div>

      {/* Conference Filter */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '16px 0',
        gap: '10px',
        flexWrap: 'wrap'
      }}>
        <label style={{
          fontFamily: 'Trebuchet MS',
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#212529'
        }}>
          Filter by Conference:
        </label>
        <select
          value={selectedConference}
          onChange={(e) => setSelectedConference(e.target.value)}
          style={{
            fontFamily: 'Trebuchet MS',
            fontSize: '14px',
            padding: '6px 12px',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            backgroundColor: '#ffffff',
            cursor: 'pointer'
          }}
        >
          {conferences.map(conference => (
            <option key={conference} value={conference}>
              {conference}
            </option>
          ))}
        </select>
        {selectedConference !== 'All Teams' && (
          <button
            onClick={() => setSelectedConference('All Teams')}
            style={{
              fontFamily: 'Trebuchet MS',
              fontSize: '12px',
              padding: '4px 8px',
              border: '1px solid #007bff',
              borderRadius: '4px',
              backgroundColor: '#007bff',
              color: '#ffffff',
              cursor: 'pointer'
            }}
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* 🔧 UPDATED: Ranking Scope Toggle (only show when conference is selected) */}
      {selectedConference !== 'All Teams' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          margin: '12px 0',
          gap: '10px'
        }}>
          <span style={{
            fontFamily: 'Trebuchet MS',
            fontSize: '13px',
            fontWeight: 'bold',
            color: '#212529'
          }}>
            Rankings & Colors:
          </span>
          <button
            onClick={() => setRankingScope('conference')}
            style={{
              fontFamily: 'Trebuchet MS',
              fontSize: '12px',
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: rankingScope === 'conference' ? '#28a745' : '#ffffff',
              color: rankingScope === 'conference' ? '#ffffff' : '#212529',
              cursor: 'pointer',
              fontWeight: rankingScope === 'conference' ? 'bold' : 'normal'
            }}
          >
            Conference Only
          </button>
          <button
            onClick={() => setRankingScope('national')}
            style={{
              fontFamily: 'Trebuchet MS',
              fontSize: '12px',
              padding: '6px 12px',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              backgroundColor: rankingScope === 'national' ? '#28a745' : '#ffffff',
              color: rankingScope === 'national' ? '#ffffff' : '#212529',
              cursor: 'pointer',
              fontWeight: rankingScope === 'national' ? 'bold' : 'normal'
            }}
          >
            {selectedClassification} National
          </button>
        </div>
      )}

      {/* Results Summary */}
      <div style={{
        textAlign: 'center',
        margin: '8px 0',
        fontSize: '14px',
        color: '#6c757d',
        fontFamily: 'Trebuchet MS'
      }}>
        {selectedConference === 'All Teams' 
          ? `Showing ${rankedData.length} ${selectedClassification} teams from ${selectedYear} season`
          : `Showing ${rankedData.length} ${selectedClassification} teams in ${selectedConference} from ${selectedYear} season (${rankingScope === 'conference' ? 'conference rankings' : `${selectedClassification} rankings`})`
        }
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          border: '1px solid #dee2e6'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                width: '60px'
              }}>
                RK
              </th>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'left',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                minWidth: '220px'
              }}>
                TEAM
              </th>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: '120px'
              }} onClick={() => handleSort('powerRating')}>
                <div>POWER</div>
                <div>RATING</div>
                {sortField === 'powerRating' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: '120px'
              }} onClick={() => handleSort('offenseRating')}>
                <div>OFFENSE</div>
                <div>RATING</div>
                {sortField === 'offenseRating' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: '120px'
              }} onClick={() => handleSort('defenseRating')}>
                <div>DEFENSE</div>
                <div>RATING</div>
                {sortField === 'defenseRating' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th style={{ 
                padding: '6px 4px', 
                border: '1px solid #dee2e6', 
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                cursor: 'pointer',
                width: '120px'
              }} onClick={() => handleSort('strengthOfSchedule')}>
                <div>STRENGTH OF</div>
                <div>SCHEDULE</div>
                {sortField === 'strengthOfSchedule' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((team, index) => {
              const currentRank = sortField === 'powerRating' ? team.displayPowerRank : index + 1;
              return (
                <tr key={team.teamName} style={{ backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff' }}>
                  <td style={{
                    backgroundColor: '#ffffff',
                    padding: '6px 4px',
                    border: '1px solid #dee2e6',
                    textAlign: 'center',
                    fontFamily: 'Consolas, monospace',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    width: '60px'
                  }}>
                    {currentRank}
                  </td>
                  <td style={{
                    padding: '6px 8px',
                    border: '1px solid #dee2e6',
                    backgroundColor: '#ffffff',
                    minWidth: '220px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <img 
                        src={team.logo} 
                        alt={`${team.teamName} logo`}
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          marginRight: '10px',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      <div>
                        <div style={{ 
                        fontWeight: 'bold', 
                        textTransform: 'uppercase',
                        fontSize: '13px',
                        lineHeight: '1.2',
                        cursor: 'pointer',
                        color: '#007bff'
                      }} onClick={() => window.location.href = `/team/${encodeURIComponent(team.teamName)}?year=${selectedYear}`}>
                        {team.teamName}
                      </div>
                        <div style={{ 
                          fontSize: '11px', 
                          color: '#6c757d',
                          lineHeight: '1.2'
                        }}>
                          {team.conference} • {team.classification}
                        </div>
                      </div>
                    </div>
                  </td>
                  <StatCell 
                    value={team.powerRating} 
                    rank={team.displayPowerRank} 
                    isHigherBetter={true}
                  />
                  <StatCell 
                    value={team.offenseRating} 
                    rank={team.displayOffenseRank} 
                    isHigherBetter={true}
                  />
                  <StatCell 
                    value={team.defenseRating} 
                    rank={team.displayDefenseRank} 
                    isHigherBetter={true}
                  />
                  <StatCell 
                    value={team.strengthOfSchedule} 
                    rank={team.displaySosRank} 
                    isHigherBetter={true}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{
        marginTop: '8px',
        fontSize: '12px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        <strong>Legend:</strong> Colors represent percentile rankings within each stat (Green = Elite, Red = Poor). 
        Rankings shown below each stat value. Click column headers to sort.
        {selectedConference !== 'All Teams' && (
          <div style={{ marginTop: '4px' }}>
            <strong>Conference Mode:</strong> Toggle between conference-only rankings or {selectedClassification} rankings using the buttons above.
          </div>
        )}
      </div>
    </div>
  );
}

export default HomePage;