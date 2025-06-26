  import React, { useState, useEffect } from 'react';
  import { useParams } from 'react-router-dom';

  // Convert moneyline to probability
  const moneylineToProbability = (moneyline) => {
    if (!moneyline || moneyline === null) return null;
    
    if (moneyline > 0) {
      return 1 / (moneyline / 100 + 1);
    } else {
      return 1 / (1 + 100 / Math.abs(moneyline));
    }
  };

  // Convert spread to probability using normal distribution
  const spreadToProbability = (spread) => {
    if (!spread || spread === null) return null;
    
    // Using the Excel formula: =NORM.DIST(-spread, 0, 13.5, TRUE)
    // This is an approximation of the normal CDF
    const z = -spread / 13.5;
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    const x = Math.abs(z) / Math.sqrt(2);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1.0 + sign * y);
  };

  // Get percentile color for win probabilities (1-100% scale)
  const getProbabilityColor = (probability) => {
    if (!probability || probability === null) return '#f8f9fa';
    
    const percent = probability * 100;
    
    // Simple 1-100% thresholds
    if (percent >= 95) return '#58c36c';      // 95-100%: Elite (darkest green)
    if (percent >= 90) return '#6aca7c';      // 90-95%: Excellent
    if (percent >= 85) return '#7cd08b';      // 85-90%: Very Good
    if (percent >= 80) return '#8dd69b';      // 80-85%: Good
    if (percent >= 75) return '#9fddaa';      // 75-80%: Above Average
    if (percent >= 70) return '#b0e3ba';      // 70-75%: Solid
    if (percent >= 65) return '#c2e9c9';      // 65-70%: Decent
    if (percent >= 60) return '#d4f0d9';      // 60-65%: Okay
    if (percent >= 55) return '#e5f6e8';      // 55-60%: Below Average
    if (percent >= 50) return '#f7fcf8';      // 50-55%: Poor
    if (percent >= 45) return '#fdf5f4';      // 45-50%: Poor
    if (percent >= 40) return '#fbe1df';      // 40-45%: Bad
    if (percent >= 35) return '#f9cdc9';      // 35-40%: Bad
    if (percent >= 30) return '#f7b9b4';      // 30-35%: Very Bad
    if (percent >= 25) return '#f5a59f';      // 25-30%: Very Bad
    if (percent >= 20) return '#f2928a';      // 20-25%: Terrible
    if (percent >= 15) return '#f07e74';      // 15-20%: Terrible
    if (percent >= 10) return '#ee6a5f';      // 10-15%: Awful
    if (percent >= 5) return '#ec564a';       // 5-10%: Awful
    return '#ea4335';                         // 0-5%: Worst (darkest red)
  };

  // Get percentile color for PPA values (20-color system) - CORRECTED
  const getPPAColor = (value, isDefense = false) => {
    if (value === null || value === undefined || isNaN(value)) return '#f8f9fa';
    
    const numValue = parseFloat(value);
    
    if (isDefense) {
      // Defense: LOWER is better (so we want green for negative values, red for positive)
      const defenseThresholds = [
        0.6, 0.5, 0.4, 0.35, 0.3,      // Worst defense (red) - high positive values
        0.25, 0.2, 0.15, 0.1, 0.05,    // Poor defense 
        0, -0.05, -0.1, -0.15, -0.2,   // Average defense
        -0.25, -0.3, -0.35, -0.4, -0.5 // Best defense (green) - negative values
      ];
      
      const colors = [
        '#ea4335', '#ec564a', '#ee6a5f', '#f07e74', '#f2928a',  // Red (worst defense)
        '#f5a59f', '#f7b9b4', '#f9cdc9', '#fbe1df', '#fdf5f4',  
        '#f7fcf8', '#e5f6e8', '#d4f0d9', '#c2e9c9', '#b0e3ba',  
        '#9fddaa', '#8dd69b', '#7cd08b', '#6aca7c', '#58c36c'   // Green (best defense)
      ];
      
      for (let i = 0; i < defenseThresholds.length; i++) {
        if (numValue >= defenseThresholds[i]) {
          return colors[i];
        }
      }
      return colors[colors.length - 1];
      
    } else {
      // Offense: HIGHER is better (existing logic is correct)
      const offenseThresholds = [
        -0.6, -0.4, -0.3, -0.2, -0.1,  // Worst offense (red)
        -0.05, 0, 0.05, 0.1, 0.15,     
        0.2, 0.25, 0.3, 0.35, 0.4,     
        0.45, 0.5, 0.6, 0.7, 0.8       // Best offense (green)
      ];
      
      const colors = [
        '#ea4335', '#ec564a', '#ee6a5f', '#f07e74', '#f2928a',  
        '#f5a59f', '#f7b9b4', '#f9cdc9', '#fbe1df', '#fdf5f4',  
        '#f7fcf8', '#e5f6e8', '#d4f0d9', '#c2e9c9', '#b0e3ba',  
        '#9fddaa', '#8dd69b', '#7cd08b', '#6aca7c', '#58c36c'   
      ];
      
      for (let i = 0; i < offenseThresholds.length; i++) {
        if (numValue <= offenseThresholds[i]) {
          return colors[i];
        }
      }
      return colors[colors.length - 1];
    }
  };

  // Styles
  const headerStyle = {
    padding: '8px',
    border: '1px solid #dee2e6',
    textAlign: 'center',
    fontSize: '11px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: '"Trebuchet MS", Arial, sans-serif'
  };

  const cellStyle = {
    padding: '8px',
    border: '1px solid #dee2e6',
    textAlign: 'center',
    lineHeight: '1.2'
  };

  // Completed Games Table Component
  const CompletedGamesTable = ({ games, teamName, allTeamsRankings }) => {
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    // Deduplicate games by ID
const uniqueGames = React.useMemo(() => {
  console.log('🔍 Raw games count:', games.length);
  const deduped = games.filter((game, index, self) => 
    index === self.findIndex(g => g.id === game.id)
  );
  console.log('🔍 Unique games count:', deduped.length);
  
  if (games.length !== deduped.length) {
    console.log('🐛 Removed', games.length - deduped.length, 'duplicate games');
  }
  
  return deduped;
}, [games]);
// ADD THE HELPER FUNCTION HERE:
  const getOpponentRank = (opponentName) => {
  if (!allTeamsRankings || !opponentName || !Array.isArray(allTeamsRankings)) {
    console.log('❌ getOpponentRank early return:', { 
      hasRankings: !!allTeamsRankings, 
      hasName: !!opponentName, 
      isArray: Array.isArray(allTeamsRankings) 
    });
    return null;
  }
  
  console.log('🔍 Looking for opponent:', opponentName, 'in', allTeamsRankings.length, 'teams');
  
  const opponent = allTeamsRankings.find(team => 
    team.team_name === opponentName || 
    team.school === opponentName ||
    team.team === opponentName
  );
  
  console.log('🎯 Found opponent:', opponent ? `${opponent.team_name} (rank ${opponent.power_rank})` : 'NOT FOUND');
  
  return opponent ? opponent.power_rank : null;
};

// ADD THE getRankColor FUNCTION HERE:
  const getRankColor = (rank) => {
  if (!rank || rank < 1) return { bg: '#6c757d', text: '#fff' };
  
  // Convert rank to percentile (1 = 100th percentile, 134 = 1st percentile)
  const percentile = ((134 - rank + 1) / 134) * 100;
  
  // Return both background and text colors
  if (percentile >= 96) return { bg: '#58c36c', text: '#fff' };      // Dark green - white text
  if (percentile >= 91) return { bg: '#6aca7c', text: '#fff' };      // Green - white text  
  if (percentile >= 86) return { bg: '#7cd08b', text: '#fff' };      // Light green - white text
  if (percentile >= 81) return { bg: '#8dd69b', text: '#000' };      // Lighter green - black text
  if (percentile >= 76) return { bg: '#9fddaa', text: '#000' };      // Light green - black text
  if (percentile >= 71) return { bg: '#b0e3ba', text: '#000' };      // Very light green - black text
  if (percentile >= 66) return { bg: '#c2e9c9', text: '#000' };      // Pale green - black text
  if (percentile >= 61) return { bg: '#d4f0d9', text: '#000' };      // Very pale green - black text
  if (percentile >= 56) return { bg: '#e5f6e8', text: '#000' };      // Almost white green - black text
  if (percentile >= 51) return { bg: '#f7fcf8', text: '#000' };      // White green - black text
  if (percentile >= 46) return { bg: '#fdf5f4', text: '#000' };      // White pink - black text
  if (percentile >= 41) return { bg: '#fbe1df', text: '#000' };      // Very pale red - black text
  if (percentile >= 36) return { bg: '#f9cdc9', text: '#000' };      // Pale red - black text
  if (percentile >= 31) return { bg: '#f7b9b4', text: '#000' };      // Light red - black text
  if (percentile >= 26) return { bg: '#f5a59f', text: '#000' };      // Light red - black text
  if (percentile >= 21) return { bg: '#f2928a', text: '#fff' };      // Medium red - white text
  if (percentile >= 16) return { bg: '#f07e74', text: '#fff' };      // Red - white text
  if (percentile >= 11) return { bg: '#ee6a5f', text: '#fff' };      // Dark red - white text
  if (percentile >= 6) return { bg: '#ec564a', text: '#fff' };       // Darker red - white text
  return { bg: '#ea4335', text: '#fff' };                           // Darkest red - white text
};

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (!games || games.length === 0) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px', 
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          No completed games available
        </div>
      );
    }

    return (
      <div style={{ marginTop: '20px', overflowX: 'auto' }}>
        {/* Desktop Table */}
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse', 
          border: '1px solid #dee2e6',
          fontSize: '13px',
          display: windowWidth >= 768 ? 'table' : 'none'
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={headerStyle}>WK</th>
              <th style={headerStyle}>OPPONENT</th>
              <th style={headerStyle}>SCORE</th>
              <th style={headerStyle}>WIN PROBABILITY</th>
              <th style={headerStyle}>OFF PPA</th>
              <th style={headerStyle}>DEF PPA</th>
            </tr>
            <tr style={{ backgroundColor: '#f8f9fa' }}>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}></th>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}></th>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}></th>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <span>Pre</span>
                  <span>Post</span>
                </div>
              </th>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}></th>
              <th style={{...headerStyle, fontSize: '10px', color: '#6c757d'}}></th>
            </tr>
          </thead>
          <tbody>
            {[...uniqueGames]
    .sort((a, b) => {
      // Regular season games first, then postseason
      if (a.season_type === 'postseason' && b.season_type !== 'postseason') return 1;
      if (a.season_type !== 'postseason' && b.season_type === 'postseason') return -1;
      
      // Within same season type, sort by week first, then by start_date
      if (a.week !== b.week) {
        return a.week - b.week;
      }
      
      // If same week (like postseason week 1), sort by start_date
      return new Date(a.start_date) - new Date(b.start_date);
    })
    .map((game, index) => {
              const isWin = (game.home_away === 'home' && game.home_points > game.away_points) ||
                          (game.home_away === 'away' && game.away_points > game.home_points);
              
              const teamScore = game.home_away === 'home' ? game.home_points : game.away_points;
              const opponentScore = game.home_away === 'home' ? game.away_points : game.home_points;
              
            let pregameProb = null;
  let debugInfo = `${game.home_moneyline || 'null'},${game.away_moneyline || 'null'}`;

  if (game.home_moneyline && game.away_moneyline) {
    // Use moneylines with juice removal
    const homeRawProb = moneylineToProbability(game.home_moneyline);
    const awayRawProb = moneylineToProbability(game.away_moneyline);
    
    if (homeRawProb && awayRawProb) {
      const totalProb = homeRawProb + awayRawProb;
      const homeAdjustedProb = homeRawProb / totalProb;
      const awayAdjustedProb = awayRawProb / totalProb;
      pregameProb = game.home_away === 'home' ? homeAdjustedProb : awayAdjustedProb;
      debugInfo = `${Math.round(pregameProb * 100)}%`;
    } else {
      debugInfo = 'CALC_FAIL';
    }
  } else if (game.spread) {
    // Fallback to spread calculation - convert to number
    const spreadValue = parseFloat(game.spread);
    const adjustedSpread = game.home_away === 'home' ? spreadValue : -spreadValue;
    pregameProb = spreadToProbability(adjustedSpread);
    debugInfo = pregameProb ? `${Math.round(pregameProb * 100)}%` : 'SPREAD_FAIL';
  } else {
    debugInfo = 'N/A';
  }
              
              // Get postgame win probability
              const postgameProb = game.home_away === 'home' 
                ? parseFloat(game.home_postgame_win_probability)
                : parseFloat(game.away_postgame_win_probability);
              
              // Determine if home or neutral game (for vs. prefix)
              const isAwayGame = game.home_away === 'away';
              
              return (
                <tr key={game.id} style={{ backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff' }}>
                  {/* Week */}
                  <td style={cellStyle}>
                    <span style={{ fontFamily: '"Courier New", Courier, monospace', fontWeight: 'bold' }}>
    {game.season_type === 'postseason' ? 'BG' : game.week}
  </span>
                  </td>
                  
                  {/* Opponent with logo and @ or vs. symbol */}
                  <td style={cellStyle}>
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    {isAwayGame ? (
      <span style={{ color: '#6c757d', fontWeight: 'bold' }}>@</span>
    ) : (
      <span style={{ color: '#6c757d', fontWeight: 'bold' }}>vs.</span>
    )}
    <img 
      src={game.opponent_logo || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
      alt={`${game.opponent} logo`}
      style={{ 
        width: '24px', 
        height: '24px', 
        cursor: 'pointer',
        borderRadius: '2px'
      }}
      onClick={() => window.location.href = `/team/${encodeURIComponent(game.opponent)}`}
      title={`Go to ${game.opponent} team page`}
    />
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ 
        fontWeight: 'bold', 
        textTransform: 'uppercase',
        fontSize: '12px',
        fontFamily: '"Trebuchet MS", Arial, sans-serif'
      }}>
        {game.opponent}
      </span>
      {(() => {
  const rank = getOpponentRank(game.opponent);
  if (!rank) return null;
  const colors = getRankColor(rank);
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
    }}>
      #{rank}
    </span>
  );
})()}
    </div>
  </div>
</td>
                  
                  {/* Score with win/loss colored box */}
<td style={{
  ...cellStyle,
  fontWeight: 'bold',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '14px',
  padding: '4px'
}}>
  <span style={{
    backgroundColor: isWin ? '#6aca7c' : '#ee6a5f',
    color: '#ffffff',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    border: '1px solid rgba(0,0,0,0.1)'
  }}>
    {teamScore}-{opponentScore}
  </span>
</td>
                  
                  {/* Win Probability - Pre and Post side by side */}
  <td style={{...cellStyle, width: '100px', padding: '4px'}}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      gap: '0px'
    }}>
      {/* Pregame Win Probability */}
  <div style={{
    backgroundColor: pregameProb ? getProbabilityColor(pregameProb) : '#f8f9fa',
    color: '#000000',
    padding: '2px 4px',
    borderRadius: '0px',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '13px',
    fontWeight: '900',
    letterSpacing: '0.5px',
    minWidth: '28px',
    textAlign: 'center',
    border: 'none',
    lineHeight: '1'
  }}>
    {debugInfo}
  </div>

  {/* Postgame Win Probability */}
  <div style={{
    backgroundColor: postgameProb ? getProbabilityColor(postgameProb) : '#f8f9fa',
    color: '#000000',
    padding: '2px 4px',
    borderRadius: '0px',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '13px',
    fontWeight: '900',
    letterSpacing: '0.5px',
    minWidth: '32px',
    textAlign: 'center',
    border: 'none',
    lineHeight: '1'
  }}>
    {postgameProb ? `${Math.round(postgameProb * 100)}%` : 'N/A'}
  </div>
    </div>
  </td>
                  
                  {/* Offensive PPA */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getPPAColor(parseFloat(game.offense_ppa), false),
                    fontFamily: '"Courier New", Courier, monospace',
                    fontWeight: 'bold',
                    color: '#212529',
                    fontSize: '15px'
                  }}>
                    {game.offense_ppa ? parseFloat(game.offense_ppa).toFixed(2) : 'N/A'}
                  </td>
                  
                  {/* Defensive PPA */}
                  <td style={{
                    ...cellStyle,
                    backgroundColor: getPPAColor(parseFloat(game.defense_ppa), true),
                    fontFamily: '"Courier New", Courier, monospace',
                    fontWeight: 'bold',
                    color: '#212529',
                    fontSize: '15px'
                  }}>
                    {game.defense_ppa ? parseFloat(game.defense_ppa).toFixed(2) : 'N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Mobile Table - Logo Only */}
  <div style={{ 
    display: windowWidth < 768 ? 'block' : 'none'
  }}>
    <table style={{ 
      width: '100%', 
      borderCollapse: 'collapse', 
      border: '1px solid #dee2e6',
      fontSize: '11px'
    }}>
      <thead>
        <tr style={{ backgroundColor: '#f8f9fa' }}>
          <th style={{...headerStyle, fontSize: '10px', width: '30px'}}>WK</th>
          <th style={{...headerStyle, fontSize: '10px', width: '50px'}}>OPP</th>
          <th style={{...headerStyle, fontSize: '10px', width: '50px'}}>SCORE</th>
          <th style={{...headerStyle, fontSize: '10px', width: '70px'}}>WIN %</th>
          <th style={{...headerStyle, fontSize: '10px', width: '45px'}}>OFF</th>
          <th style={{...headerStyle, fontSize: '10px', width: '45px'}}>DEF</th>
        </tr>
      </thead>
      <tbody>
        {[...uniqueGames]
    .sort((a, b) => {
      // Regular season games first, then postseason
      if (a.season_type === 'postseason' && b.season_type !== 'postseason') return 1;
      if (a.season_type !== 'postseason' && b.season_type === 'postseason') return -1;
      return a.week - b.week;
    })
    .map((game, index) => {
          const isWin = (game.home_away === 'home' && game.home_points > game.away_points) ||
                      (game.home_away === 'away' && game.away_points > game.home_points);
          
          const teamScore = game.home_away === 'home' ? game.home_points : game.away_points;
          const opponentScore = game.home_away === 'home' ? game.away_points : game.home_points;
          
       // Calculate pregame win probability with spread fallback
let pregameProb = null;
let displayText = 'N/A';

if (game.home_moneyline && game.away_moneyline) {
  // Use moneylines with juice removal
  const homeRawProb = moneylineToProbability(game.home_moneyline);
  const awayRawProb = moneylineToProbability(game.away_moneyline);
  
  if (homeRawProb && awayRawProb) {
    const totalProb = homeRawProb + awayRawProb;
    const homeAdjustedProb = homeRawProb / totalProb;
    const awayAdjustedProb = awayRawProb / totalProb;
    pregameProb = game.home_away === 'home' ? homeAdjustedProb : awayAdjustedProb;
    displayText = `${Math.round(pregameProb * 100)}%`;
  } else {
    displayText = 'N/A';
  }
} else if (game.spread) {
  // Fallback to spread calculation - convert to number
  const spreadValue = parseFloat(game.spread);
  const adjustedSpread = game.home_away === 'home' ? spreadValue : -spreadValue;
  pregameProb = spreadToProbability(adjustedSpread);
  displayText = pregameProb ? `${Math.round(pregameProb * 100)}%` : 'N/A';
} else {
  displayText = 'N/A';
}
          
          const postgameProb = game.home_away === 'home' 
            ? parseFloat(game.home_postgame_win_probability)
            : parseFloat(game.away_postgame_win_probability);
          
          const isAwayGame = game.home_away === 'away';
          
          return (
            <tr key={game.id} style={{ backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff' }}>
              {/* Week */}
              <td style={{...cellStyle, padding: '4px', fontSize: '10px'}}>
                <span style={{ fontFamily: '"Courier New", Courier, monospace', fontWeight: 'bold' }}>
    {game.season_type === 'postseason' ? 'BG' : game.week}
  </span>
              </td>
              
              {/* Opponent Logo Only */}
              <td style={{...cellStyle, padding: '4px'}}>
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flexDirection: 'column' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {isAwayGame ? (
        <span style={{ color: '#6c757d', fontSize: '10px' }}>@</span>
      ) : (
        <span style={{ color: '#6c757d', fontSize: '10px' }}>vs</span>
      )}
      <img 
        src={game.opponent_logo || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png'} 
        alt={`${game.opponent} logo`}
        style={{ 
          width: '20px', 
          height: '20px', 
          cursor: 'pointer',
          borderRadius: '2px'
        }}
        onClick={() => window.location.href = `/team/${encodeURIComponent(game.opponent)}`}
        title={`Go to ${game.opponent} team page`}
      />
    </div>
    {(() => {
  const rank = getOpponentRank(game.opponent);
  if (!rank) return null;
  const colors = getRankColor(rank);
  return (
    <span style={{
      fontSize: '8px',
      color: colors.text,
      fontFamily: '"Trebuchet MS", Arial, sans-serif',
      fontWeight: 'bold',
      backgroundColor: colors.bg,
      padding: '1px 4px',
      borderRadius: '3px',
      border: '1px solid rgba(0,0,0,0.1)',
      minWidth: '16px',
      textAlign: 'center',
      display: 'inline-block',
      lineHeight: '1'
    }}>
      #{rank}
    </span>
  );
})()}
  </div>
</td>
              
              {/* Score */}
<td style={{
  ...cellStyle,
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '14px',
  fontWeight: '900',
  padding: '4px'
}}>
  <span style={{
    backgroundColor: isWin ? '#6aca7c' : '#ee6a5f',
    color: '#ffffff',
    padding: '3px 6px',
    borderRadius: '3px',
    fontWeight: 'bold',
    border: '1px solid rgba(0,0,0,0.1)',
    fontSize: '12px'
  }}>
    {teamScore}-{opponentScore}
  </span>
</td>
              
              {/* Win Probability */}
  <td style={{...cellStyle, padding: '2px', borderLeft: '2px solid #dee2e6'}}>
    <div style={{ display: 'flex', gap: '1px', justifyContent: 'center' }}>
      <div style={{
              backgroundColor: pregameProb ? getProbabilityColor(pregameProb) : '#f8f9fa',
              color: '#000000',
              padding: '5px 5px',
              borderRadius: '2px',
              fontFamily: '"Courier New", Courier, monospace',
              fontSize: '11px',
              fontWeight: '900',
              letterSpacing: '0.3px',
              minWidth: '30px',
              textAlign: 'center',
              border: 'none',
              lineHeight: '1'
            }}>
              {displayText}
            </div>
      <div style={{
        backgroundColor: postgameProb ? getProbabilityColor(postgameProb) : '#f8f9fa',
        color: '#000000',
        padding: '5px 5px',
        borderRadius: '0px',
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '11px',
        fontWeight: '900',
        letterSpacing: '0.3px',
        minWidth: '30px',
        textAlign: 'center',
        border: 'none',
        lineHeight: '1'
      }}>
        {postgameProb ? `${Math.round(postgameProb * 100)}%` : 'N/A'}
      </div>
    </div>
  </td>

  {/* Off PPA */}
  <td style={{
    ...cellStyle,
    padding: '4px',
    backgroundColor: getPPAColor(parseFloat(game.offense_ppa), false),
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 'bold',
    color: '#212529',
    fontSize: '14px',
    borderLeft: '2px solid #dee2e6'
  }}>
    {game.offense_ppa ? parseFloat(game.offense_ppa).toFixed(2) : 'N/A'}
  </td>

  {/* Def PPA */}
  <td style={{
    ...cellStyle,
    padding: '4px',
    backgroundColor: getPPAColor(parseFloat(game.defense_ppa), true),
    fontFamily: '"Courier New", Courier, monospace',
    fontWeight: 'bold',
    color: '#212529',
    fontSize: '14px'
  }}>
    {game.defense_ppa ? parseFloat(game.defense_ppa).toFixed(2) : 'N/A'}
  </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
        
        {/* Legend */}
        <div style={{
          marginTop: '12px',
          fontSize: '11px',
          color: '#6c757d',
          textAlign: 'center',
          fontFamily: '"Trebuchet MS", Arial, sans-serif'
        }}>
          <strong>Color Legend:</strong> Win Probability (Green = High, Red = Low) | PPA (Green = Better Performance, Red = Worse Performance)
        </div>
      </div>
    );
  };

  // Replace your AdvancedStatsTable component with this updated version:

  const AdvancedStatsTable = ({ teamName, teamStats, allTeamsStats }) => {
    console.log('🔧 AdvancedStatsTable received:', { teamName, teamStats: !!teamStats, allTeamsStats: !!allTeamsStats });

    // Stats configuration based on your CSV with groupings and tooltips
    const statsConfig = [
      // STYLISTIC GROUP
      {
        isHeader: true,
        label: 'STYLISTIC',
        headerStyle: { backgroundColor: '#e9ecef', fontWeight: 'bold', color: '#495057' }
      },
      { 
        label: 'Plays/Game', 
        offense: 'offense_plays_per_game', 
        defense: 'defense_plays_per_game', 
        higherBetter: { offense: false, defense: false },
        tooltip: 'Number of plays per game'
      },
      { 
        label: 'Drives/Game', 
        offense: 'offense_drives_per_game', 
        defense: 'defense_drives_per_game', 
        higherBetter: { offense: false, defense: false },
        tooltip: 'Number of drives per game'
      },
      { 
        label: 'Pass Rate', 
        offense: 'offense_passing_plays_rate', 
        defense: 'defense_passing_plays_rate', 
        higherBetter: { offense: false, defense: false },
        tooltip: 'Rate of passing plays'
      },
      { 
        label: 'Rush Rate', 
        offense: 'offense_rushing_plays_rate', 
        defense: 'defense_rushing_plays_rate', 
        higherBetter: { offense: false, defense: false },
        tooltip: 'Rate of running plays'
      },

      // OVERALL GROUP
      {
        isHeader: true,
        label: 'OVERALL',
        headerStyle: { backgroundColor: '#e9ecef', fontWeight: 'bold', color: '#495057' }
      },
      { 
        label: 'PPA', 
        offense: 'offense_ppa', 
        defense: 'defense_ppa', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'A version of Expected Points Added from collegefootballdata.com. It measures value of each play by its effect on the offense\'s likelihood to score. Think of it like a super-charged yards per play'
      },
      { 
        label: 'Success Rate', 
        offense: 'offense_success_rate', 
        defense: 'defense_success_rate', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Success Rate measures efficiency and staying on schedule. A successful play is 50% of the yards to go on 1st down (so gaining 5 yards on 1st-and-10), 70% of yards to go on 2nd down, 100% of yards to go on 3rd or 4th down, or team scores on that play'
      },
      { 
        label: 'Explosiveness', 
        offense: 'offense_explosiveness', 
        defense: 'defense_explosiveness', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'PPA added on successful plays. It measures big-play ability.'
      },
      { 
        label: 'ScoringOpps/Game', 
        offense: 'offense_total_opportunities_per_game', 
        defense: 'defense_total_opportunities_per_game', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Total drives in which the team reached their opponent\'s 40-yard line.'
      },
      { 
        label: 'Pts/Opp', 
        offense: 'offense_points_per_opportunity', 
        defense: 'defense_points_per_opportunity', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Points per drive that reached their opponent\'s 40.'
      },
      { 
        label: 'Havoc', 
        offense: 'offense_havoc_total', 
        defense: 'defense_havoc_total', 
        higherBetter: { offense: false, defense: true },
        tooltip: 'Rate of plays with a sack, TFL, pass breakup, fumble or INT. Lower is better for offense, higher is better for defense.'
      },

      // PASSING GROUP
      {
        isHeader: true,
        label: 'PASSING',
        headerStyle: { backgroundColor: '#e9ecef', fontWeight: 'bold', color: '#495057' }
      },
      { 
        label: 'Pass PPA', 
        offense: 'offense_passing_plays_ppa', 
        defense: 'defense_passing_plays_ppa', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'PPA on passing plays'
      },
      { 
        label: 'Pass Success Rate', 
        offense: 'offense_passing_plays_success_rate', 
        defense: 'defense_passing_plays_success_rate', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Success rate on passing plays'
      },
      { 
        label: 'Pass Explosiveness', 
        offense: 'offense_passing_plays_explosiveness', 
        defense: 'defense_passing_plays_explosiveness', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Explosiveness on passing plays'
      },

      // RUSHING GROUP
      {
        isHeader: true,
        label: 'RUSHING',
        headerStyle: { backgroundColor: '#e9ecef', fontWeight: 'bold', color: '#495057' }
      },
      { 
        label: 'Rush PPA', 
        offense: 'offense_rushing_plays_ppa', 
        defense: 'defense_rushing_plays_ppa', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'PPA on rushing plays'
      },
      { 
        label: 'Rush Success Rate', 
        offense: 'offense_rushing_plays_success_rate', 
        defense: 'defense_rushing_plays_success_rate', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Success rate on rushing plays'
      },
      { 
        label: 'Rush Explosiveness', 
        offense: 'offense_rushing_plays_explosiveness', 
        defense: 'defense_rushing_plays_explosiveness', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Explosiveness on rushing plays'
      },
      { 
        label: 'Stuff Rate', 
        offense: 'offense_stuff_rate', 
        defense: 'defense_stuff_rate', 
        higherBetter: { offense: false, defense: true },
        tooltip: 'Percentage of running plays stopped at or behind the line of scrimmage'
      },
      { 
        label: 'Power Success', 
        offense: 'offense_power_success', 
        defense: 'defense_power_success', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Percentage of running plays on 3rd or 4th down from 2 yards or less in which an offense either converted into a 1st down or scored a TD'
      },
      { 
        label: 'Line Yards', 
        offense: 'offense_line_yards', 
        defense: 'defense_line_yards', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Line Yards measures the number of running yards attributed to the offensive line'
      },
      { 
        label: 'SL Yards', 
        offense: 'offense_second_level_yards', 
        defense: 'defense_second_level_yards', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Average yards per carry that are between 5 and 10 yards from the LOS'
      },
      { 
        label: 'OF Yards', 
        offense: 'offense_open_field_yards', 
        defense: 'defense_open_field_yards', 
        higherBetter: { offense: true, defense: false },
        tooltip: 'Average yards per carry that comes from over 10 yards past the LOS'
      }
    ];

    // Calculate rankings for each stat
    const calculateRankings = (statKey, isOffense, higherBetter) => {
      if (!allTeamsStats || allTeamsStats.length === 0) return { rank: 'N/A', total: 0 };
      
      const validTeams = allTeamsStats
        .filter(team => team[statKey] !== null && team[statKey] !== undefined)
        .map(team => ({
          team_name: team.team_name || team.team || team.school,
          value: parseFloat(team[statKey])
        }))
        .filter(team => !isNaN(team.value));
      
      if (validTeams.length === 0) return { rank: 'N/A', total: 0 };
      
      validTeams.sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);
      
      const teamIndex = validTeams.findIndex(team => team.team_name === teamName);
      return {
        rank: teamIndex >= 0 ? teamIndex + 1 : 'N/A',
        total: validTeams.length
      };
    };

    // 20-color percentile system
    const getPercentileColor = (rank, total) => {
      if (rank === 'N/A' || !rank || !total) return '#f8f9fa';
      
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

    const formatStatValue = (value, statLabel) => {
      if (value === null || value === undefined) return 'N/A';
      
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return 'N/A';
      
      if (statLabel === 'Plays/Game' || statLabel === 'Drives/Game' || statLabel === 'ScoringOpps/Game') {
        return numValue.toFixed(1);
      }
      else if (statLabel.includes('Rate') || statLabel.includes('Success Rate') || statLabel === 'Havoc') {
        return `${(numValue * 100).toFixed(1)}%`;
      } else if (statLabel.includes('PPA') || statLabel.includes('Explosiveness')) {
        return numValue.toFixed(3);
      } else if (statLabel.includes('Yards')) {
        return numValue.toFixed(1);
      } else {
        return numValue.toFixed(2);
      }
    };

    // Tooltip component
    const Tooltip = ({ children, tooltip }) => {
      const [showTooltip, setShowTooltip] = React.useState(false);
      
      if (!tooltip) return children;
      
      return (
        <div 
          style={{ position: 'relative', display: 'inline-block' }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          {children}
          {showTooltip && (
            <div style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: '#333',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              lineHeight: '1.3',
              maxWidth: '250px',
              textAlign: 'left',
              zIndex: 1000,
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              marginBottom: '5px'
            }}>
              {tooltip}
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: '5px solid #333'
              }} />
            </div>
          )}
        </div>
      );
    };

    const StatCell = ({ value, statLabel, statKey, isOffense, higherBetter }) => {
      const rankings = calculateRankings(statKey, isOffense, higherBetter);
      const formattedValue = formatStatValue(value, statLabel);
      
      return (
        <td style={{
          backgroundColor: getPercentileColor(rankings.rank, rankings.total),
          padding: '8px 6px',
          border: '1px solid #dee2e6',
          textAlign: 'center',
          fontFamily: 'Consolas, monospace',
          fontWeight: 'bold',
          fontSize: '13px',
          lineHeight: '1.1',
          position: 'relative',
          minWidth: '65px',
          maxWidth: '80px'
        }}>
          <div style={{ marginBottom: '2px' }}>
            {formattedValue}
          </div>
          <div style={{
            position: 'absolute',
            bottom: '3px',
            right: '4px',
            fontSize: '10px', // Larger rank number
            fontWeight: 'bold',
            opacity: 0.8,
            color: '#000'
          }}>
            {rankings.rank}
          </div>
        </td>
      );
    };

    if (!teamStats) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <p>Advanced stats not available for {teamName}</p>
        </div>
      );
    }

    if (!allTeamsStats) {
      return (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          color: '#6c757d',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <p>Loading national rankings data...</p>
        </div>
      );
    }

    return (
      <div style={{ 
        backgroundColor: '#ffffff', 
        border: '1px solid #dee2e6', 
        borderRadius: '8px',
        maxWidth: '420px',
        width: '100%'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '10px 12px',
          borderBottom: '1px solid #dee2e6',
          fontWeight: 'bold',
          fontSize: '15px',
          fontFamily: '"Trebuchet MS", Arial, sans-serif'
        }}>
          Advanced Statistics
          {teamStats.games_played && (
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 'normal', 
              color: '#6c757d', 
              marginLeft: '8px' 
            }}>
              ({teamStats.games_played} games)
            </span>
          )}
        </div>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{
                  padding: '8px 6px',
                  border: '1px solid #dee2e6',
                  textAlign: 'center', // Centered
                  fontSize: '10px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  width: '110px',
                  fontFamily: '"Trebuchet MS", Arial, sans-serif'
                }}>
                  Statistic
                </th>
                <th style={{
                  padding: '8px 6px',
                  border: '1px solid #dee2e6',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  width: '80px',
                  fontFamily: '"Trebuchet MS", Arial, sans-serif',
                  backgroundColor: '#e8f5e8',
                  color: '#2d5a2d'
                }}>
                  Offense
                </th>
                <th style={{
                  padding: '8px 6px',
                  border: '1px solid #dee2e6',
                  textAlign: 'center',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  width: '80px',
                  fontFamily: '"Trebuchet MS", Arial, sans-serif',
                  backgroundColor: '#fce8e8',
                  color: '#5a2d2d'
                }}>
                  Defense
                </th>
              </tr>
            </thead>
            <tbody>
              {statsConfig.map((stat, index) => {
                // Render section headers
                if (stat.isHeader) {
                  return (
                    <tr key={`header-${index}`}>
                      <td colSpan="3" style={{
                        ...stat.headerStyle,
                        padding: '6px 8px',
                        border: '1px solid #dee2e6',
                        textAlign: 'center',
                        fontSize: '11px',
                        fontFamily: '"Trebuchet MS", Arial, sans-serif',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {stat.label}
                      </td>
                    </tr>
                  );
                }

                // Render stat rows
                return (
                  <tr key={stat.label} style={{
                    backgroundColor: index % 2 === 1 ? '#f8f9fa' : '#ffffff'
                  }}>
                    <td style={{
                      padding: '8px 6px',
                      border: '1px solid #dee2e6',
                      fontSize: '11px',
                      fontWeight: 'bold', // Bold
                      backgroundColor: '#ffffff',
                      fontFamily: '"Trebuchet MS", Arial, sans-serif',
                      color: '#212529',
                      textAlign: 'center', // Centered
                      textTransform: 'uppercase' // Uppercase
                    }}>
                      <Tooltip tooltip={stat.tooltip}>
                        <span style={{ cursor: stat.tooltip ? 'help' : 'default' }}>
                          {stat.label}
                        </span>
                      </Tooltip>
                    </td>
                    <StatCell
                      value={teamStats[stat.offense]}
                      statLabel={stat.label}
                      statKey={stat.offense}
                      isOffense={true}
                      higherBetter={stat.higherBetter.offense}
                    />
                    <StatCell
                      value={teamStats[stat.defense]}
                      statLabel={stat.label}
                      statKey={stat.defense}
                      isOffense={false}
                      higherBetter={stat.higherBetter.defense}
                    />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Helper Functions
  const calculateRecord = (games) => {
    if (!games || games.length === 0) return "0-0";
    
    let wins = 0;
    let losses = 0;
    
    games.forEach(game => {
      if (game.completed) {
        const teamScore = game.home_away === 'home' ? game.home_points : game.away_points;
        const opponentScore = game.home_away === 'home' ? game.away_points : game.home_points;
        
        if (teamScore > opponentScore) {
          wins++;
        } else {
          losses++;
        }
      }
    });
    
    return `${wins}-${losses}`;
  };

  // Helper Components
  const StatCard = ({ title, value, rank }) => (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '8px',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', fontFamily: '"Courier New", Courier, monospace' }}>
        {value}
      </div>
      {rank && (
        <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
          Rank: #{rank}
        </div>
      )}
    </div>
  );

  // Main Component
  function TeamPage() {
    console.log('🚀 TeamPage component rendered');
    
    const { teamName } = useParams();
    console.log('🎯 Team name from URL:', teamName);
    
    const [teamData, setTeamData] = useState(null);
    const [games, setGames] = useState([]);
    const [stats, setStats] = useState(null);
    const [allTeamsAdvancedStats, setAllTeamsAdvancedStats] = useState(null);
    const [allTeamsRankings, setAllTeamsRankings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
      console.log('🔄 useEffect triggered for teamName:', teamName);
      loadTeamData();
    }, [teamName]);

   // Replace your loadTeamData function in TeamPage.js with this fixed version:

const loadTeamData = async () => {
  console.log('📡 Starting API calls for:', teamName);
  
  try {
    setLoading(true);
    
  const [teamResponse, gamesResponse, statsResponse, allAdvancedStatsResponse, rankingsResponse] = await Promise.all([
  // ✅ This endpoint exists
  fetch(`http://localhost:5000/api/teams/${encodeURIComponent(teamName)}?year=2024`),
  
  // ✅ FIXED: Use the games-enhanced endpoint that exists in your server.js
  fetch(`http://localhost:5000/api/teams/${encodeURIComponent(teamName)}/games-enhanced/2024`),
  
  // ✅ This endpoint exists
  fetch(`http://localhost:5000/api/teams/${encodeURIComponent(teamName)}/stats?season=2024`),
  
  // ✅ This endpoint exists
  fetch(`http://localhost:5000/api/all-advanced-stats/2024`),
  
  // ✅ ADD: Rankings for opponent ranks
  fetch(`http://localhost:5000/api/power-rankings?year=2024`)
]);

    console.log('📊 API responses:', {
      team: teamResponse.ok,
      games: gamesResponse.ok,
      stats: statsResponse.ok,
      allAdvanced: allAdvancedStatsResponse.ok
    });

    if (!teamResponse.ok) {
      throw new Error(`Team not found: ${teamName}`);
    }

    const team = await teamResponse.json();
    
    // FIXED: Handle the games-enhanced response (it returns a direct array)
    let games = [];
    if (gamesResponse.ok) {
      games = await gamesResponse.json(); // This is already an array
      console.log(`🏈 Loaded ${games.length} enhanced games`);
    } else {
      console.log('❌ Enhanced games response not ok:', gamesResponse.status);
    }
    
    const stats = statsResponse.ok ? await statsResponse.json() : null;
    const allAdvancedStats = allAdvancedStatsResponse.ok ? await allAdvancedStatsResponse.json() : null;

    console.log('🔍 Parsed data:', {
      team: !!team,
      gamesCount: games.length,
      stats: !!stats,
      allAdvancedStatsCount: allAdvancedStats ? allAdvancedStats.length : 0
    });

    const rankingsData = rankingsResponse.ok ? await rankingsResponse.json() : null;
console.log('🎯 Full rankings data:', rankingsData);

// FIXED: Extract the teams array from the object
const rankings = rankingsData?.teams || rankingsData || [];
console.log('🏈 Rankings array length:', rankings.length);
console.log('🏈 Sample team from rankings:', rankings?.[0]);
if (rankings && rankings.length > 0) {
  console.log('🔑 Available keys in first ranking:', Object.keys(rankings[0]));
}
setAllTeamsRankings(rankings);

console.log('🔍 Parsed data:', {
  team: !!team,
  gamesCount: games.length,
  stats: !!stats,
  allAdvancedStatsCount: allAdvancedStats ? allAdvancedStats.length : 0
});

    // Convert string numbers to actual numbers
    const processedTeam = {
      ...team,
      power_rating: parseFloat(team.power_rating),
      offense_rating: parseFloat(team.offense_rating),
      defense_rating: parseFloat(team.defense_rating),
      strength_of_schedule: parseFloat(team.strength_of_schedule),
      power_rank: parseInt(team.power_rank),
      offense_rank: parseInt(team.offense_rank),
      defense_rank: parseInt(team.defense_rank),
      sos_rank: parseInt(team.sos_rank)
    };

    const processedStats = stats ? {
      ...stats,
      offense_ppa: parseFloat(stats.offense_ppa),
      defense_ppa: parseFloat(stats.defense_ppa),
      offense_success_rate: parseFloat(stats.offense_success_rate),
      offense_explosiveness: parseFloat(stats.offense_explosiveness)
    } : null;

    setTeamData(processedTeam);
    setGames(games); // Now this should be the enhanced games with betting data
    setStats(processedStats);
    setAllTeamsAdvancedStats(allAdvancedStats);
    setLoading(false);
    
    console.log('✅ All data loaded successfully');
  } catch (err) {
    console.error('❌ Error loading team data:', err);
    setError(err.message);
    setLoading(false);
  }
};

    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh',
          fontFamily: '"Trebuchet MS", Arial, sans-serif'
        }}>
          Loading {teamName} 2024 season...
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
          fontFamily: '"Trebuchet MS", Arial, sans-serif',
          flexDirection: 'column',
          color: '#d32f2f'
        }}>
          <div>{error}</div>
          <button 
            onClick={() => window.history.back()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
        </div>
      );
    }

    return (
      <div style={{ 
        fontFamily: '"Trebuchet MS", Arial, sans-serif', 
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        {/* Team Header */}
        <div style={{
          background: `linear-gradient(135deg, ${teamData.primary_color || '#333'}, ${teamData.secondary_color || '#666'})`,
          color: 'white',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
              <img 
                src={teamData.logo} 
                alt={`${teamData.team_name} logo`}
                style={{ width: '80px', height: '80px' }}
              />
              <div>
                <h1 style={{ margin: '0', fontSize: '36px', textTransform: 'uppercase' }}>
                  {teamData.team_name}
                </h1>
                <div style={{ fontSize: '18px', opacity: 0.9 }}>
                  {teamData.conference} • 2024 Season
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
          
          {/* Season Summary */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '10px' }}>
              2024 Season Summary
            </h2>
            
            {/* Record and Key Stats */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px',
              marginTop: '20px'
            }}>
              <StatCard title="Final Record" value={calculateRecord(games)} />
              <StatCard title="Power Rating" value={teamData.power_rating?.toFixed(1) || 'N/A'} rank={teamData.power_rank} />
              <StatCard title="Offense Rating" value={teamData.offense_rating?.toFixed(1) || 'N/A'} rank={teamData.offense_rank} />
              <StatCard title="Defense Rating" value={teamData.defense_rating?.toFixed(1) || 'N/A'} rank={teamData.defense_rank} />
            </div>
          </div>

          {/* Completed Games */}
<div style={{ marginBottom: '30px' }}>
  <h2 style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '10px' }}>
    Completed Games
  </h2>
  <CompletedGamesTable 
    games={games} 
    teamName={teamName} 
    allTeamsRankings={allTeamsRankings} 
  />
</div>

          {/* Advanced Stats - FIXED INTEGRATION */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ borderBottom: '2px solid #dee2e6', paddingBottom: '10px' }}>
              2024 Advanced Statistics
            </h2>
            
            <div style={{ marginTop: '20px' }}>
              <AdvancedStatsTable 
                teamName={teamName}
                teamStats={stats}
                allTeamsStats={allTeamsAdvancedStats} // Fixed prop name
              />
            </div>
          </div>

          {/* Navigation */}
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <button 
              onClick={() => window.history.back()}
              style={{
                padding: '12px 24px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '16px',
                cursor: 'pointer',
                fontFamily: '"Trebuchet MS", Arial, sans-serif'
              }}
            >
              ← Back to Rankings
            </button>
          </div>
        </div>
      </div>
    );
  }

  export default TeamPage;