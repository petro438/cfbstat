const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'ScheduleDB',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log(`Connected to PostgreSQL database: ${process.env.DB_NAME || process.env.DB_DATABASE}`);
    release();
  }
});

// Helper function for normal distribution CDF
function normalCDF(x, mean = 0, stdDev = 1) {
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) prob = 1 - prob;
  return prob;
}

// API Routes

// Get power rankings from database with teams table and year support
app.get('/api/power-rankings', async (req, res) => {
  try {
    // Get year from query parameter, default to 2025
    const year = parseInt(req.query.year) || 2025;
    
    console.log(`Fetching power rankings for ${year} season`);
    
    // First, let's debug what we have in the teams table
    const debugQuery = await pool.query(`
      SELECT school, classification, COUNT(*) as count
      FROM teams 
      WHERE classification IS NOT NULL
      GROUP BY classification, school
      ORDER BY classification, school
      LIMIT 10
    `);
    console.log('Sample teams with classifications:', debugQuery.rows);

    const result = await pool.query(`
      SELECT DISTINCT ON (tpr.team_name)
        tpr.team_name,
        tpr.power_rating,
        tpr.offense_rating,
        tpr.defense_rating,
        tpr.strength_of_schedule,
        tpr.season,
        t.school,
        t.mascot,
        t.conference,
        t.classification,
        t.logo_url,
        t.color,
        t.alt_color
      FROM team_power_ratings tpr
      LEFT JOIN teams t ON (
        LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name)) OR
        LOWER(TRIM(t.mascot)) = LOWER(TRIM(tpr.team_name)) OR
        LOWER(TRIM(CONCAT(t.school, ' ', t.mascot))) = LOWER(TRIM(tpr.team_name))
      )
      WHERE tpr.power_rating IS NOT NULL 
        AND tpr.season = $1
      ORDER BY tpr.team_name, tpr.power_rating DESC
    `, [year]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: `No power rankings found for ${year} season`,
        availableYears: await getAvailableYears(pool)
      });
    }
    
    // Calculate rankings after deduplication
    const sortedByPower = [...result.rows].sort((a, b) => b.power_rating - a.power_rating);
    const sortedByOffense = [...result.rows].sort((a, b) => b.offense_rating - a.offense_rating);
    const sortedByDefense = [...result.rows].sort((a, b) => b.defense_rating - a.defense_rating);
    const sortedBySOS = [...result.rows].sort((a, b) => b.strength_of_schedule - a.strength_of_schedule);
    
    const teamsWithRanks = result.rows.map(team => {
      const powerRank = sortedByPower.findIndex(t => t.team_name === team.team_name) + 1;
      const offenseRank = sortedByOffense.findIndex(t => t.team_name === team.team_name) + 1;
      const defenseRank = sortedByDefense.findIndex(t => t.team_name === team.team_name) + 1;
      const sosRank = sortedBySOS.findIndex(t => t.team_name === team.team_name) + 1;
      
      // 🔧 DEBUG: Log each team's classification
      console.log(`Team: ${team.team_name}, Classification: ${team.classification}, Conference: ${team.conference}`);
      
      return {
        team_name: team.team_name,
        teamName: team.team_name,
        power_rating: team.power_rating,
        powerRating: team.power_rating,
        offense_rating: team.offense_rating,
        offenseRating: team.offense_rating,
        defense_rating: team.defense_rating,
        defenseRating: team.defense_rating,
        strength_of_schedule: team.strength_of_schedule,
        strengthOfSchedule: team.strength_of_schedule,
        season: team.season,
        conference: team.conference || 'Unknown',
        classification: team.classification || 'Unknown', // 🔧 THIS IS THE KEY LINE
        logo: team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
        abbreviation: team.school?.substring(0, 4).toUpperCase() || team.team_name?.substring(0, 4).toUpperCase(),
        power_rank: powerRank,
        powerRank: powerRank,
        offense_rank: offenseRank,
        offenseRank: offenseRank,
        defense_rank: defenseRank,
        defenseRank: defenseRank,
        sos_rank: sosRank,
        sosRank: sosRank,
        primary_color: team.color,
        secondary_color: team.alt_color
      };
    }).sort((a, b) => b.power_rating - a.power_rating);
    
    console.log(`Returning ${teamsWithRanks.length} unique teams for ${year} season`);

    // 🔧 DEBUG: Log first few teams to see what we're getting
    console.log('🔍 Sample teams with classification data:');
    teamsWithRanks.slice(0, 5).forEach(team => {
      console.log(`  ${team.team_name}: classification="${team.classification}", conference="${team.conference}"`);
    });

    // 🔧 DEBUG: Check Ohio State specifically
    const ohioState = result.rows.find(row => row.team_name === 'Ohio State');
    if (ohioState) {
      console.log('🏈 Ohio State raw data from query:', {
        team_name: ohioState.team_name,
        school: ohioState.school,
        classification: ohioState.classification,
        conference: ohioState.conference
      });
    } else {
      console.log('❌ Ohio State not found in query results');
    }
    
    // 🔧 DEBUG: Log classification breakdown
    const classificationBreakdown = {};
    teamsWithRanks.forEach(team => {
      const classification = team.classification || 'Unknown';
      classificationBreakdown[classification] = (classificationBreakdown[classification] || 0) + 1;
    });
    console.log(`Classification breakdown for ${year}:`, classificationBreakdown);
    
    res.json({
      season: year,
      teams: teamsWithRanks,
      totalTeams: teamsWithRanks.length,
      classificationBreakdown // 🔧 Include in response for debugging
    });
  } catch (err) {
    console.error('Error fetching power rankings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to get available years
async function getAvailableYears(pool) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT season 
      FROM team_power_ratings 
      WHERE season IS NOT NULL 
      ORDER BY season DESC
    `);
    return result.rows.map(row => row.season);
  } catch (err) {
    console.error('Error fetching available years:', err);
    return [];
  }
}

// New endpoint to get available years
app.get('/api/available-years', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT season 
      FROM team_power_ratings 
      WHERE season IS NOT NULL 
      ORDER BY season DESC
    `);
    const years = result.rows.map(row => row.season);
    res.json({ years });
  } catch (err) {
    console.error('Error fetching available years:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Updated team endpoint with year support
app.get('/api/teams/:teamName', async (req, res) => {
  try {
    // Decode URL encoding (Ohio%20State -> Ohio State)
    const teamName = decodeURIComponent(req.params.teamName);
    const year = parseInt(req.query.year) || 2025;
    
    console.log(`🔍 Looking for team: "${teamName}" for ${year} season`);
    
    const result = await pool.query(`
      SELECT 
        t.*,
        tpr.power_rating,
        tpr.offense_rating,
        tpr.defense_rating,
        tpr.strength_of_schedule,
        tpr.season,
        RANK() OVER (ORDER BY tpr.power_rating DESC) as power_rank,
        RANK() OVER (ORDER BY tpr.offense_rating DESC) as offense_rank,
        RANK() OVER (ORDER BY tpr.defense_rating DESC) as defense_rank,
        RANK() OVER (ORDER BY tpr.strength_of_schedule DESC) as sos_rank
      FROM teams t
      LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
        AND tpr.season = $2
      WHERE LOWER(TRIM(t.school)) = LOWER(TRIM($1))
      LIMIT 1
    `, [teamName, year]);
    
    if (result.rows.length === 0) {
      console.log(`❌ Team not found: "${teamName}"`);
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const team = result.rows[0];
    console.log(`✅ Found team: "${team.school}" for ${year} season`);
    
    res.json({
      team_name: team.school,
      power_rating: team.power_rating,
      offense_rating: team.offense_rating,
      defense_rating: team.defense_rating,
      strength_of_schedule: team.strength_of_schedule,
      season: team.season,
      conference: team.conference,
      classification: team.classification || 'Unknown',
      logo: team.logo_url || 'http://a.espncdn.com/i/teamlogos/ncaa/500/default.png',
      primary_color: team.color,
      secondary_color: team.alt_color,
      power_rank: team.power_rank,
      offense_rank: team.offense_rank,
      defense_rank: team.defense_rank,
      sos_rank: team.sos_rank,
      mascot: team.mascot
    });
  } catch (err) {
    console.error('Error fetching team:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team's season stats - FIXED for URL encoding
app.get('/api/teams/:teamName/stats', async (req, res) => {
  try {
    // Decode URL encoding
    const teamName = decodeURIComponent(req.params.teamName);
    const { season } = req.query;
    const seasonFilter = season || 2024;
    
    console.log(`🔍 Fetching stats for: "${teamName}", season ${seasonFilter}`);
    
    const query = `
      SELECT 
        ass.season,
        ass.team,
        ass.conference,
        
        -- Calculate games played for this team
        (SELECT COUNT(*) FROM games g 
         WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
         AND g.season = ass.season 
         AND g.completed = true) as games_played,
        
        -- Per-game stats (divide by games played)
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.offense_plays
        END as offense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.defense_plays
        END as defense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.offense_drives
        END as offense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.defense_drives
        END as defense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.offense_total_opportunities
        END as offense_total_opportunities_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.defense_total_opportunities
        END as defense_total_opportunities_per_game,
        
        -- Original stats (not per-game)
        ass.offense_plays,
        ass.defense_plays,
        ass.offense_drives,
        ass.defense_drives,
        ass.offense_total_opportunities,
        ass.defense_total_opportunities,
        ass.offense_points_per_opportunity,
        ass.defense_points_per_opportunity,
        
        -- Core efficiency metrics (already per-play/percentage)
        ass.offense_ppa,
        ass.defense_ppa,
        ass.offense_success_rate,
        ass.defense_success_rate,
        ass.offense_explosiveness,
        ass.defense_explosiveness,
        ass.offense_power_success,
        ass.defense_power_success,
        ass.offense_havoc_total,
        ass.defense_havoc_total,
        
        -- Passing stats
        ass.offense_passing_plays_rate,
        ass.defense_passing_plays_rate,
        ass.offense_passing_plays_ppa,
        ass.defense_passing_plays_ppa,
        ass.offense_passing_plays_success_rate,
        ass.defense_passing_plays_success_rate,
        ass.offense_passing_plays_explosiveness,
        ass.defense_passing_plays_explosiveness,
        
        -- Rushing stats
        ass.offense_rushing_plays_rate,
        ass.defense_rushing_plays_rate,
        ass.offense_rushing_plays_ppa,
        ass.defense_rushing_plays_ppa,
        ass.offense_rushing_plays_success_rate,
        ass.defense_rushing_plays_success_rate,
        ass.offense_rushing_plays_explosiveness,
        ass.defense_rushing_plays_explosiveness,
        
        -- Line metrics
        ass.offense_stuff_rate,
        ass.defense_stuff_rate,
        ass.offense_line_yards,
        ass.defense_line_yards,
        ass.offense_second_level_yards,
        ass.defense_second_level_yards,
        ass.offense_open_field_yards,
        ass.defense_open_field_yards
        
      FROM advanced_season_stats ass
      WHERE LOWER(TRIM(ass.team)) = LOWER(TRIM($1)) 
        AND ass.season = $2
      LIMIT 1
    `;
    
    const result = await pool.query(query, [teamName, seasonFilter]);
    
    if (result.rows.length === 0) {
      console.log(`❌ No stats found for "${teamName}" in season ${seasonFilter}`);
      return res.status(404).json({ error: `No stats found for ${teamName} in ${seasonFilter}` });
    }
    
    const teamData = result.rows[0];
    console.log(`✅ Found stats for "${teamName}":`, {
      team: teamData.team,
      season: teamData.season,
      games_played: teamData.games_played
    });
    
    res.json(teamData);
  } catch (err) {
    console.error('Error fetching team stats:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// FIXED Team Games Endpoint - Add/Replace this in your server.js
app.get('/api/teams/:teamName/games', async (req, res) => {
  try {
    const { teamName } = req.params;
    const { season, year } = req.query;
    const seasonParam = season || year || '2025';
    
    console.log(`🏈 Getting games for team: "${teamName}", season: ${seasonParam}`);
    
    // FIXED: Get the actual team name from teams table (case-insensitive)
    const teamResult = await pool.query(`
      SELECT school, conference, classification, logo_url
      FROM teams 
      WHERE LOWER(school) = LOWER($1)
      LIMIT 1
    `, [teamName]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Team not found',
        requested_team: teamName
      });
    }
    
    const actualTeamName = teamResult.rows[0].school;
    console.log(`📝 Found team: "${actualTeamName}"`);
    
    // FIXED: Get games using the actual team name (case-sensitive now that we have exact match)
    const gamesResult = await pool.query(`
      SELECT 
        g.*,
        CASE 
          WHEN g.home_team = $1 THEN g.away_team
          ELSE g.home_team
        END as opponent,
        CASE 
          WHEN g.home_team = $1 THEN 'home'
          WHEN g.neutral_site = true THEN 'neutral'
          ELSE 'away'
        END as venue,
        -- Get opponent info
        opp_teams.conference as opponent_conference,
        opp_teams.logo_url as opponent_logo,
        -- Get opponent ratings if available
        opp_ratings.power_rating as opponent_rating
      FROM games g
      LEFT JOIN teams opp_teams ON opp_teams.school = CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END
      LEFT JOIN team_power_ratings opp_ratings ON opp_ratings.team_name = CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END AND opp_ratings.season = $2
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
      ORDER BY g.week, g.start_date
    `, [actualTeamName, seasonParam]);
    
    console.log(`📊 Found ${gamesResult.rows.length} games for ${actualTeamName} in ${seasonParam}`);
    
    res.json({
      team: actualTeamName,
      season: seasonParam,
      total_games: gamesResult.rows.length,
      games: gamesResult.rows.map(game => ({
        ...game,
        team_score: game.home_team === actualTeamName ? game.home_points : game.away_points,
        opponent_score: game.home_team === actualTeamName ? game.away_points : game.home_points,
        result: game.completed && game.home_points !== null && game.away_points !== null ? 
          (game.home_team === actualTeamName ? 
            (game.home_points > game.away_points ? 'W' : 
             game.home_points < game.away_points ? 'L' : 'T') :
            (game.away_points > game.home_points ? 'W' : 
             game.away_points < game.home_points ? 'L' : 'T')
          ) : null
      }))
    });
    
  } catch (err) {
    console.error('❌ Error getting team games:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// FIXED Team Info Endpoint (if you need this too)
app.get('/api/teams/:teamName', async (req, res) => {
  try {
    const { teamName } = req.params;
    const { year, season } = req.query;
    const seasonParam = year || season || '2025';
    
    console.log(`🏈 Getting team info for: "${teamName}", season: ${seasonParam}`);
    
    // FIXED: Case-insensitive team lookup
    const teamResult = await pool.query(`
      SELECT DISTINCT ON (teams.school)
        teams.school,
        teams.mascot,
        teams.abbreviation,
        teams.conference,
        teams.classification,
        teams.color,
        teams.alt_color as alternate_color,
        teams.logo_url,
        tpr.power_rating,
        tpr.offense_rating,
        tpr.defense_rating,
        tpr.strength_of_schedule
      FROM teams
      LEFT JOIN team_power_ratings tpr ON tpr.team_name = teams.school AND tpr.season = $2
      WHERE LOWER(teams.school) = LOWER($1)
      ORDER BY teams.school
    `, [teamName, seasonParam]);
    
    if (teamResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Team not found',
        requested_team: teamName
      });
    }
    
    const team = teamResult.rows[0];
    console.log(`📊 Found team: ${team.school}`);
    
    res.json({
      team_name: team.school,
      school: team.school,
      mascot: team.mascot,
      abbreviation: team.abbreviation,
      conference: team.conference,
      classification: team.classification?.toUpperCase(),
      color: team.color,
      alternate_color: team.alternate_color,
      logo_url: team.logo_url,
      power_rating: team.power_rating,
      offense_rating: team.offense_rating,
      defense_rating: team.defense_rating,
      strength_of_schedule: team.strength_of_schedule,
      season: seasonParam
    });
    
  } catch (err) {
    console.error('❌ Error getting team info:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// Enhanced games endpoint - FIXED for URL encoding
app.get('/api/teams/:teamName/games-enhanced/:season', async (req, res) => {
  try {
    // Decode URL encoding
    const teamName = decodeURIComponent(req.params.teamName);
    const { season } = req.params;
    
    console.log(`🔍 Fetching enhanced games for: "${teamName}", season ${season}`);
    
    const result = await pool.query(`
      SELECT 
        g.id,
        g.season,
        g.week,
        g.start_date,
        g.home_team,
        g.away_team,
        g.home_points,
        g.away_points,
        g.completed,
        g.home_postgame_win_probability,
        g.away_postgame_win_probability,
        g.season_type,
        CASE 
          WHEN g.home_team = $1 THEN g.away_team
          ELSE g.home_team
        END as opponent,
        CASE 
          WHEN g.home_team = $1 THEN 'home'
          ELSE 'away'
        END as home_away,
        
        -- Game betting lines with DraftKings preference, ESPN Bet fallback
        COALESCE(dk_lines.home_moneyline, espn_lines.home_moneyline) as home_moneyline,
        COALESCE(dk_lines.away_moneyline, espn_lines.away_moneyline) as away_moneyline,
        COALESCE(dk_lines.spread, espn_lines.spread) as spread,
        COALESCE(dk_lines.provider, espn_lines.provider) as betting_provider,
        
        -- Advanced game stats for this team
        ags.offense_ppa,
        ags.defense_ppa,
        
        -- Opponent team info for logos
        t_opp.logo_url as opponent_logo
        
      FROM games g
      LEFT JOIN game_betting_lines dk_lines ON g.id = dk_lines.game_id 
      AND UPPER(TRIM(dk_lines.provider)) = 'DRAFTKINGS'
      LEFT JOIN game_betting_lines espn_lines ON g.id = espn_lines.game_id 
      AND UPPER(TRIM(espn_lines.provider)) = 'ESPN BET'
      LEFT JOIN advanced_game_stats ags ON g.id = ags.game_id 
        AND UPPER(TRIM(ags.team)) = UPPER(TRIM($1))
      LEFT JOIN teams t_opp ON LOWER(TRIM(t_opp.school)) = LOWER(TRIM(CASE 
        WHEN g.home_team = $1 THEN g.away_team
        ELSE g.home_team
      END))
      
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
        AND g.completed = true
        AND g.season_type IN ('regular', 'postseason')
      ORDER BY g.week
    `, [teamName, season]);
    
    console.log(`✅ Found ${result.rows.length} enhanced games for "${teamName}" in ${season}`);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching enhanced games:', err);
    res.status(500).json({ error: err.message, details: err.stack });
  }
});

// All advanced stats endpoint
app.get('/api/all-advanced-stats/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    console.log(`🔍 Fetching all advanced stats with per-game calculations for season ${season}`);
    
    const query = `
      SELECT 
        ass.team as team_name,
        ass.season,
        
        -- Calculate games played for each team
        (SELECT COUNT(*) FROM games g 
         WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
         AND g.season = ass.season 
         AND g.completed = true) as games_played,
        
        -- Per-game stats (divide by games played)
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.offense_plays
        END as offense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_plays / (SELECT COUNT(*) FROM games g 
                                   WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                   AND g.season = ass.season 
                                   AND g.completed = true)
          ELSE ass.defense_plays
        END as defense_plays_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.offense_drives
        END as offense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_drives / (SELECT COUNT(*) FROM games g 
                                    WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                    AND g.season = ass.season 
                                    AND g.completed = true)
          ELSE ass.defense_drives
        END as defense_drives_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.offense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.offense_total_opportunities
        END as offense_total_opportunities_per_game,
        
        CASE 
          WHEN (SELECT COUNT(*) FROM games g 
                WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                AND g.season = ass.season 
                AND g.completed = true) > 0 
          THEN ass.defense_total_opportunities / (SELECT COUNT(*) FROM games g 
                                                 WHERE (g.home_team = ass.team OR g.away_team = ass.team) 
                                                 AND g.season = ass.season 
                                                 AND g.completed = true)
          ELSE ass.defense_total_opportunities
        END as defense_total_opportunities_per_game,
        
        -- Original totals (for reference)
        ass.offense_plays,
        ass.defense_plays,
        ass.offense_drives,
        ass.defense_drives,
        ass.offense_total_opportunities,
        ass.defense_total_opportunities,
        ass.offense_points_per_opportunity,
        ass.defense_points_per_opportunity,
        
        -- Core efficiency metrics (already per-play/percentage)
        ass.offense_ppa,
        ass.defense_ppa,
        ass.offense_success_rate,
        ass.defense_success_rate,
        ass.offense_explosiveness,
        ass.defense_explosiveness,
        ass.offense_power_success,
        ass.defense_power_success,
        ass.offense_havoc_total,
        ass.defense_havoc_total,
        
        -- Passing stats
        ass.offense_passing_plays_rate,
        ass.defense_passing_plays_rate,
        ass.offense_passing_plays_ppa,
        ass.defense_passing_plays_ppa,
        ass.offense_passing_plays_success_rate,
        ass.defense_passing_plays_success_rate,
        ass.offense_passing_plays_explosiveness,
        ass.defense_passing_plays_explosiveness,
        
        -- Rushing stats
        ass.offense_rushing_plays_rate,
        ass.defense_rushing_plays_rate,
        ass.offense_rushing_plays_ppa,
        ass.defense_rushing_plays_ppa,
        ass.offense_rushing_plays_success_rate,
        ass.defense_rushing_plays_success_rate,
        ass.offense_rushing_plays_explosiveness,
        ass.defense_rushing_plays_explosiveness,
        
        -- Line metrics
        ass.offense_stuff_rate,
        ass.defense_stuff_rate,
        ass.offense_line_yards,
        ass.defense_line_yards,
        ass.offense_second_level_yards,
        ass.defense_second_level_yards,
        ass.offense_open_field_yards,
        ass.defense_open_field_yards
        
      FROM advanced_season_stats ass
      WHERE ass.season = $1
      ORDER BY ass.team
    `;
    
    const result = await pool.query(query, [season]);
    
    console.log(`✅ Found ${result.rows.length} teams with per-game calculations for season ${season}`);
    
    if (result.rows.length > 0) {
      console.log('✅ Sample team data:', {
        team: result.rows[0].team_name,
        season: result.rows[0].season,
        games_played: result.rows[0].games_played,
        offense_plays_total: result.rows[0].offense_plays,
        offense_plays_per_game: result.rows[0].offense_plays_per_game,
        offense_power_success: result.rows[0].offense_power_success,
        total_fields: Object.keys(result.rows[0]).length
      });
    }
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('❌ Error fetching all advanced stats:', error);
    res.status(500).json({ error: 'Failed to fetch advanced stats', details: error.message });
  }
});

// WORKING Enhanced SOS leaderboard endpoint - simplified based on debug success
app.get('/api/leaderboards/strength-of-schedule-enhanced/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { conferenceOnly, classification, includePostseason } = req.query;
    
    console.log(`🏈 Calculating enhanced SOS for ${season}, conference only: ${conferenceOnly}, classification: ${classification || 'all'}, include postseason: ${includePostseason}`);
    
    // Build season type filter
    let seasonTypeFilter = '';
    if (includePostseason !== 'true') {
      seasonTypeFilter = `AND g.season_type = 'regular'`;
    }
    let classificationFilter = '';
    if (classification && classification !== 'all') {
      classificationFilter = `AND teams.classification = '${classification.toLowerCase()}'`;
    }
    
    // Get teams with season-specific power ratings (simplified from debug version)
    const teamsResult = await pool.query(`
      SELECT DISTINCT ON (teams.school)
        teams.school as team_name,
        teams.conference,
        teams.logo_url,
        teams.classification,
        teams.abbreviation,
        tpr.power_rating,
        tpr.offense_rating,
        tpr.defense_rating,
        tpr.strength_of_schedule as team_sos
      FROM teams
      INNER JOIN team_power_ratings tpr ON tpr.team_name = teams.school AND tpr.season = $1
      WHERE teams.school IN (
          SELECT DISTINCT home_team FROM games WHERE season = $1
          UNION
          SELECT DISTINCT away_team FROM games WHERE season = $1
        )
        ${classificationFilter}
      ORDER BY teams.school
    `, [season]);
    
    console.log(`📊 Found ${teamsResult.rows.length} teams with ${season} power ratings`);
    
    if (teamsResult.rows.length === 0) {
      return res.json({
        metadata: {
          season: season,
          total_teams: 0,
          error: `No teams found with power ratings for ${season} season`
        },
        teams: []
      });
    }
    
    const enhancedTeams = [];
    
    // Calculate detailed stats for each team
    for (const team of teamsResult.rows) {
      try {
        // Get games for this team with opponent ratings
        let gamesQuery = `
          SELECT 
            g.*,
            CASE 
              WHEN g.home_team = $1 THEN g.away_team
              ELSE g.home_team
            END as opponent,
            CASE 
              WHEN g.home_team = $1 THEN 'home'
              WHEN g.neutral_site = true THEN 'neutral'
              ELSE 'away'
            END as venue,
            opp_ratings.power_rating as opponent_rating,
            opp_teams.conference as opponent_conference,
            opp_teams.classification as opponent_classification
          FROM games g
          LEFT JOIN team_power_ratings opp_ratings 
            ON opp_ratings.team_name = CASE 
              WHEN g.home_team = $1 THEN g.away_team
              ELSE g.home_team
            END
            AND opp_ratings.season = $2
          LEFT JOIN teams opp_teams
            ON opp_teams.school = CASE 
              WHEN g.home_team = $1 THEN g.away_team
              ELSE g.home_team
            END
          WHERE (g.home_team = $1 OR g.away_team = $1) 
            AND g.season = $2
            ${seasonTypeFilter}
        `;
        
        // Add conference filter if requested
        if (conferenceOnly === 'true') {
          gamesQuery += ` AND opp_teams.conference = $3`;
        }
        
        gamesQuery += ` ORDER BY g.week`;
        
        // Build parameters array based on filters
        let queryParams = [team.team_name, season];
        if (conferenceOnly === 'true') {
          queryParams.push(team.conference);
        }
        
        const gamesResult = await pool.query(gamesQuery, queryParams);
        const games = gamesResult.rows;
        
        // Skip teams with no games (after filtering)
        if (games.length === 0) {
          continue;
        }
        
        // Calculate metrics
        let sosOverall = 0;
        let sosRemaining = 0;
        let sosPlayed = 0;
        let top40Games = 0;
        let top40Wins = 0;
        let top40Losses = 0;
        let coinflipGames = 0;
        let sureThingGames = 0;
        let longshotGames = 0;
        
        let gamesPlayed = 0;
        let gamesRemaining = 0;
        let actualWins = 0;
        let actualLosses = 0;
        let actualTies = 0;
        let totalWinProb = 0;
        
        games.forEach(game => {
          // Use opponent rating if available, otherwise use default values based on classification
          let opponentRating = parseFloat(game.opponent_rating) || 0;
          
          // If no rating available, assign default based on opponent classification
          if (!game.opponent_rating) {
            const oppClass = game.opponent_classification?.toLowerCase();
            if (oppClass === 'fbs') {
              opponentRating = 0; // Average FBS team
            } else if (oppClass === 'fcs') {
              opponentRating = -15; // Typical FCS team
            } else {
              opponentRating = -25; // D2/D3/NAIA teams
            }
          }
          
          const teamRating = parseFloat(team.power_rating) || 0;
          
          // Calculate win probability
          let pointSpread = teamRating - opponentRating;
          if (game.venue === 'home') pointSpread += 2.15;
          else if (game.venue === 'away') pointSpread -= 2.15;
          
          const winProb = normalCDF(pointSpread, 0, 13.5);
          totalWinProb += winProb;
          
          // SOS calculations (use actual opponent rating for SOS)
          sosOverall += opponentRating;
          
          // Check if game is completed
          const isCompleted = game.completed === true || 
                             (game.home_points !== null && game.away_points !== null);
          
          if (isCompleted) {
            sosPlayed += opponentRating;
            gamesPlayed++;
            
            // Calculate actual wins/losses from completed games
            if (game.home_points !== null && game.away_points !== null) {
              const teamScore = game.home_team === team.team_name ? 
                              parseInt(game.home_points) : parseInt(game.away_points);
              const oppScore = game.home_team === team.team_name ? 
                             parseInt(game.away_points) : parseInt(game.home_points);
              
              if (teamScore > oppScore) {
                actualWins++;
              } else if (oppScore > teamScore) {
                actualLosses++;
              } else {
                actualTies++;
              }
            }
          } else {
            sosRemaining += opponentRating;
            gamesRemaining++;
          }
          
          // Game classifications (only count FBS teams for top 40)
          if (opponentRating >= 10 && game.opponent_classification?.toLowerCase() === 'fbs') {
            top40Games++;
            
            // Check if game is completed to count wins/losses vs top 40
            if (isCompleted && game.home_points !== null && game.away_points !== null) {
              const teamScore = game.home_team === team.team_name ? 
                              parseInt(game.home_points) : parseInt(game.away_points);
              const oppScore = game.home_team === team.team_name ? 
                             parseInt(game.away_points) : parseInt(game.home_points);
              
              if (teamScore > oppScore) {
                top40Wins++;
              } else if (oppScore > teamScore) {
                top40Losses++;
              }
              // Ties don't count as wins or losses for top 40 record
            }
          }
          
          // Win probability classifications
          if (winProb >= 0.8) sureThingGames++;
          else if (winProb <= 0.2) longshotGames++;
          else if (winProb >= 0.4 && winProb <= 0.6) coinflipGames++;
        });
        
        const totalGames = games.length;
        
        // Build record string
        let recordString = `${actualWins}-${actualLosses}`;
        if (actualTies > 0) {
          recordString += `-${actualTies}`;
        }
        
        enhancedTeams.push({
          team: team.team_name,
          conference: team.conference,
          classification: team.classification?.toUpperCase() || 'FBS',
          logo_url: team.logo_url,
          team_rating: parseFloat(team.power_rating).toFixed(1),
          total_games: totalGames,
          games_played: gamesPlayed,
          games_remaining: gamesRemaining,
          actual_wins: actualWins,
          actual_losses: actualLosses,
          actual_ties: actualTies,
          record: recordString,
          projected_wins: totalWinProb.toFixed(1),
          sos_overall: totalGames > 0 ? (sosOverall / totalGames).toFixed(1) : '0.0',
          sos_remaining: gamesRemaining > 0 ? (sosRemaining / gamesRemaining).toFixed(1) : '0.0',
          sos_played: gamesPlayed > 0 ? (sosPlayed / gamesPlayed).toFixed(1) : '0.0',
          top40_games: top40Games,
          top40_wins: top40Wins,
          top40_losses: top40Losses,
          top40_record: `${top40Wins}-${top40Losses}${top40Games > (top40Wins + top40Losses) ? ` (${top40Games})` : ''}`,
          coinflip_games: coinflipGames,
          sure_thing_games: sureThingGames,
          longshot_games: longshotGames,
          abbreviation: team.abbreviation || team.team_name?.substring(0, 4).toUpperCase() || 'TBD'
        });
        
      } catch (gameErr) {
        console.error(`Error processing games for ${team.team_name}:`, gameErr);
      }
    }
    
    // Sort by SOS overall (descending - higher = harder)
    enhancedTeams.sort((a, b) => parseFloat(b.sos_overall) - parseFloat(a.sos_overall));
    
    // Add rankings
    enhancedTeams.forEach((team, index) => {
      team.sos_rank = index + 1;
    });
    
    console.log(`✅ Calculated SOS for ${enhancedTeams.length} teams for ${season} season`);
    
    res.json({
      metadata: {
        season: season,
        total_teams: enhancedTeams.length,
        conference_games_only: conferenceOnly === 'true',
        classification_filter: classification || 'all',
        calculation_date: new Date().toISOString(),
        calculation_method: `Season ${season} ratings and calculated win probabilities with default ratings for non-FBS opponents`,
        description: `SOS and projected wins for ${season} season including all regular season games (FBS vs non-FBS games use default opponent ratings)`
      },
      teams: enhancedTeams
    });
    
  } catch (err) {
    console.error('❌ Error in enhanced SOS calculation:', err);
    res.status500.json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// Helper function for normal CDF
function normalCDF(x, mean = 0, stdDev = 1) {
  const z = (x - mean) / stdDev;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  
  if (z > 0) {
    prob = 1 - prob;
  }
  
  return prob;
}

// Drive Efficiency Leaderboard endpoint
app.get('/api/leaderboards/drive-efficiency/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    console.log(`Fetching drive efficiency data for season ${season}`);
    
    // First, let's detect the yard line convention in your data
    const conventionQuery = `
      SELECT 
        MIN(start_yards_to_goal) as min_start,
        MAX(start_yards_to_goal) as max_start,
        MIN(end_yards_to_goal) as min_end,
        MAX(end_yards_to_goal) as max_end,
        COUNT(*) as total_drives
      FROM drives d
      JOIN games g ON d.game_id = g.id
      WHERE g.season = $1
        AND start_yards_to_goal IS NOT NULL
        AND end_yards_to_goal IS NOT NULL
    `;
    
    const conventionResult = await pool.query(conventionQuery, [season]);
    const convention = conventionResult.rows[0];
    
    console.log('Yard line convention detected:', convention);
    
    // Determine field conventions based on data ranges
    const isTraditionalField = convention.max_start <= 50 && convention.max_end <= 50;
    const isFullField = convention.max_start >= 90 && convention.max_end >= 90;
    
    let yardLineLogic;
    
    if (isTraditionalField) {
      // Traditional: 1-50 from each goal line
      yardLineLogic = {
        availableYards: 'd.start_yards_to_goal',
        reachedRedZone: 'd.end_yards_to_goal <= 20',
        reachedOpponent40: 'd.end_yards_to_goal <= 10', // Within 10 of goal = past their 40
        startedOwnSide: 'd.start_yards_to_goal >= 40', // Started past own 40
        reachedMidfield: 'd.end_yards_to_goal <= 50',
        startedDeep: 'd.start_yards_to_goal >= 45' // Started near own goal
      };
    } else if (isFullField) {
      // Full field: 0-100 yards
      yardLineLogic = {
        availableYards: 'd.start_yards_to_goal',
        reachedRedZone: 'd.end_yards_to_goal <= 20',
        reachedOpponent40: 'd.end_yards_to_goal <= 40',
        startedOwnSide: 'd.start_yards_to_goal >= 70', // Started inside own 30
        reachedMidfield: 'd.end_yards_to_goal <= 50',
        startedDeep: 'd.start_yards_to_goal >= 80' // Started inside own 20
      };
    } else {
      // Default to full field logic
      yardLineLogic = {
        availableYards: 'd.start_yards_to_goal',
        reachedRedZone: 'd.end_yards_to_goal <= 20',
        reachedOpponent40: 'd.end_yards_to_goal <= 40',
        startedOwnSide: 'd.start_yards_to_goal >= 70',
        reachedMidfield: 'd.end_yards_to_goal <= 50',
        startedDeep: 'd.start_yards_to_goal >= 80'
      };
    }

    const query = `
      WITH drive_stats AS (
        SELECT 
          t.school as team_name,
          t.conference,
          t.logo_url,
          COUNT(DISTINCT g.id) as games_played,
          COUNT(d.id) as total_drives,
          
          -- 1. Available Yards % - (Yards gained / Available yards to goal line) × 100
          ROUND(
            AVG(
              CASE 
                WHEN ${yardLineLogic.availableYards} > 0 THEN
                  (d.yards_gained::float / ${yardLineLogic.availableYards}::float) * 100
                ELSE NULL
              END
            ), 1
          ) as available_yards_pct,
          
          -- 2. Scoring % - Drives ending in FG attempt or touchdown
          ROUND(
            (COUNT(CASE WHEN d.drive_result IN ('TD', 'FG', 'TOUCHDOWN', 'FIELD GOAL') THEN 1 END)::float / 
             COUNT(d.id)::float) * 100, 1
          ) as scoring_pct,
          
          -- 3. Opportunities per Game - Times reached opponent's 40-yard line / Games played
          ROUND(
            COUNT(CASE WHEN ${yardLineLogic.reachedOpponent40} THEN 1 END)::float / 
            COUNT(DISTINCT g.id)::float, 2
          ) as opportunities_per_game,
          
          -- 4. Opportunities Created per Game - Started inside own territory, reached opponent's 40
          ROUND(
            COUNT(CASE 
              WHEN ${yardLineLogic.startedOwnSide} AND ${yardLineLogic.reachedOpponent40} THEN 1 
            END)::float / COUNT(DISTINCT g.id)::float, 2
          ) as opportunities_created_per_game,
          
          -- 5. Points per Opportunity - Points scored / Drives that reached opponent's 40
          ROUND(
            COALESCE(
              SUM(CASE WHEN ${yardLineLogic.reachedOpponent40} THEN COALESCE(d.scoring, 0) END)::float /
              NULLIF(COUNT(CASE WHEN ${yardLineLogic.reachedOpponent40} THEN 1 END), 0)::float,
              0
            ), 2
          ) as points_per_opportunity,
          
          -- 6. Long Fields per Game - Started deep, reached midfield
          ROUND(
            COUNT(CASE 
              WHEN ${yardLineLogic.startedDeep} AND ${yardLineLogic.reachedMidfield} THEN 1 
            END)::float / COUNT(DISTINCT g.id)::float, 2
          ) as long_fields_per_game

        FROM drives d
        JOIN games g ON d.game_id = g.id
        JOIN teams t ON d.offense = t.school
        WHERE g.season = $1
          AND t.classification = 'fbs'
          AND d.start_yards_to_goal IS NOT NULL
          AND d.end_yards_to_goal IS NOT NULL
          AND d.yards_gained IS NOT NULL
        GROUP BY t.school, t.conference, t.logo_url
        HAVING COUNT(DISTINCT g.id) >= 8  -- Filter for teams with reasonable sample size
      )

      SELECT 
        team_name,
        conference,
        logo_url,
        games_played,
        total_drives,
        available_yards_pct,
        scoring_pct,
        opportunities_per_game,
        opportunities_created_per_game,
        points_per_opportunity,
        long_fields_per_game
      FROM drive_stats
      ORDER BY available_yards_pct DESC;
    `;

    const result = await pool.query(query, [season]);
    
    console.log(`Found ${result.rows.length} teams with drive efficiency data`);
    
    if (result.rows.length === 0) {
      return res.json({
        data: [],
        message: `No drive efficiency data found for season ${season}`,
        convention: convention
      });
    }

    // Add percentile rankings for each metric
    const teams = result.rows.map((team, index, array) => {
      const calculatePercentile = (value, values, ascending = false) => {
        const sorted = [...values].sort((a, b) => ascending ? a - b : b - a);
        const rank = sorted.indexOf(value) + 1;
        return Math.ceil((rank / sorted.length) * 100);
      };

      const availableYardsPcts = array.map(t => t.available_yards_pct);
      const scoringPcts = array.map(t => t.scoring_pct);
      const oppsPerGame = array.map(t => t.opportunities_per_game);
      const oppsCreatedPerGame = array.map(t => t.opportunities_created_per_game);
      const pointsPerOpp = array.map(t => t.points_per_opportunity);
      const longFieldsPerGame = array.map(t => t.long_fields_per_game);

      return {
        ...team,
        percentiles: {
          available_yards_pct: calculatePercentile(team.available_yards_pct, availableYardsPcts),
          scoring_pct: calculatePercentile(team.scoring_pct, scoringPcts),
          opportunities_per_game: calculatePercentile(team.opportunities_per_game, oppsPerGame),
          opportunities_created_per_game: calculatePercentile(team.opportunities_created_per_game, oppsCreatedPerGame),
          points_per_opportunity: calculatePercentile(team.points_per_opportunity, pointsPerOpp),
          long_fields_per_game: calculatePercentile(team.long_fields_per_game, longFieldsPerGame)
        }
      };
    });

    res.json({
      data: teams,
      convention: convention,
      season: season,
      total_teams: teams.length
    });

  } catch (error) {
    console.error('Drive efficiency leaderboard error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch drive efficiency data',
      details: error.message 
    });
  }
});

// Debug teams endpoint
app.get('/api/debug-teams', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_teams,
        COUNT(CASE WHEN classification = 'fbs' THEN 1 END) as fbs_teams,
        COUNT(CASE WHEN logo_url IS NOT NULL THEN 1 END) as teams_with_logos,
        COUNT(CASE WHEN conference IS NOT NULL THEN 1 END) as teams_with_conference
      FROM teams
    `);
    
    const sampleTeams = await pool.query(`
      SELECT school, mascot, conference, classification, logo_url 
      FROM teams 
      WHERE classification = 'fbs'
      ORDER BY school 
      LIMIT 5
    `);
    
    const powerRatingsCount = await pool.query(`
      SELECT COUNT(*) as teams_with_power_ratings
      FROM team_power_ratings
      WHERE power_rating IS NOT NULL
    `);
    
    res.json({
      database: process.env.DB_NAME || process.env.DB_DATABASE,
      teamsTableStats: stats.rows[0],
      powerRatingsCount: powerRatingsCount.rows[0],
      sampleTeams: sampleTeams.rows
    });
  } catch (err) {
    console.error('Error in debug:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug endpoints for troubleshooting
app.get('/api/debug/team-stats/:teamName/:season', async (req, res) => {
  try {
    const { teamName, season } = req.params;
    
    const query = `
      SELECT team, season, offense_power_success, defense_power_success,
             offense_ppa, defense_ppa, offense_success_rate, defense_success_rate,
             offense_plays, defense_plays
      FROM advanced_season_stats 
      WHERE LOWER(TRIM(team)) = LOWER(TRIM($1)) AND season = $2
    `;
    
    const result = await pool.query(query, [teamName, season]);
    
    res.json({
      query_params: { teamName, season },
      found: result.rows.length > 0,
      data: result.rows[0] || null,
      message: result.rows.length > 0 ? 'Team stats found' : 'No stats found for this team/season'
    });
    
  } catch (error) {
    console.error('Debug query error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/available-teams/:season', async (req, res) => {
  try {
    const { season } = req.params;
    
    const query = `
      SELECT team, COUNT(*) as stat_count,
             COUNT(offense_power_success) as power_success_count,
             COUNT(offense_plays) as plays_count
      FROM advanced_season_stats 
      WHERE season = $1
      GROUP BY team
      ORDER BY team
      LIMIT 10
    `;
    
    const result = await pool.query(query, [season]);
    
    res.json({
      season: season,
      sample_teams: result.rows,
      message: 'First 10 teams with stat counts'
    });
    
  } catch (error) {
    console.error('Debug available teams error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check what betting tables exist
app.get('/api/debug-betting-tables', async (req, res) => {
  try {
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%betting%' 
        OR table_name LIKE '%line%'
      ORDER BY table_name
    `);
    
    res.json({ tables: tables.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check game_betting_lines table
app.get('/api/debug-game-betting-lines', async (req, res) => {
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'game_betting_lines'
      ORDER BY ordinal_position
    `);
    
    const sampleData = await pool.query(`
      SELECT * FROM game_betting_lines 
      WHERE provider = 'DraftKings'
      LIMIT 5
    `);
    
    const providerCount = await pool.query(`
      SELECT provider, COUNT(*) as count
      FROM game_betting_lines
      GROUP BY provider
    `);
    
    res.json({
      columns: columns.rows,
      sampleData: sampleData.rows,
      providerCounts: providerCount.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check data coverage between teams and power ratings
app.get('/api/data-stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(DISTINCT tpr.team_name) as total_power_ratings,
        COUNT(DISTINCT t.school) as total_teams_in_db,
        COUNT(CASE WHEN t.school IS NOT NULL THEN 1 END) as matched_teams,
        COUNT(CASE WHEN t.school IS NULL THEN 1 END) as unmatched_teams
      FROM team_power_ratings tpr
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
      WHERE tpr.power_rating IS NOT NULL
    `);
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error checking data stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// See which teams are missing from teams table
app.get('/api/missing-data', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        tpr.team_name,
        t.school,
        t.conference,
        CASE 
          WHEN t.school IS NULL THEN 'Missing from teams table' 
          WHEN t.conference IS NULL THEN 'Missing conference info'
          ELSE 'Found' 
        END as status
      FROM team_power_ratings tpr
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
      WHERE tpr.power_rating IS NOT NULL 
        AND (t.school IS NULL OR t.conference IS NULL)
      ORDER BY tpr.power_rating DESC
      LIMIT 20
    `);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error checking missing data:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔧 DEBUG: Check what classifications exist in teams table
app.get('/api/debug-teams-table', async (req, res) => {
  try {
    const summary = await pool.query(`
      SELECT 
        classification,
        COUNT(*) as count
      FROM teams 
      WHERE classification IS NOT NULL
      GROUP BY classification
      ORDER BY count DESC
    `);
    
    const sampleTeams = await pool.query(`
      SELECT 
        school,
        classification,
        conference
      FROM teams 
      WHERE classification IS NOT NULL
      ORDER BY classification, school
      LIMIT 20
    `);
    
    res.json({
      classificationSummary: summary.rows,
      sampleTeams: sampleTeams.rows
    });
  } catch (err) {
    console.error('Error debugging teams table:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 🔧 DEBUG: Check JOIN effectiveness  
app.get('/api/debug-join', async (req, res) => {
  try {
    const year = parseInt(req.query.year) || 2025;
    
    const result = await pool.query(`
      SELECT 
        tpr.team_name,
        t.school as matched_school,
        t.classification as matched_classification,
        t.conference as matched_conference,
        tpr.power_rating,
        CASE 
          WHEN t.school IS NOT NULL THEN 'MATCHED'
          ELSE 'NO_MATCH'
        END as match_status
      FROM team_power_ratings tpr
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(tpr.team_name))
      WHERE tpr.season = $1
      ORDER BY match_status, tpr.team_name
      LIMIT 20
    `, [year]);
    
    res.json({
      year,
      sampleMatches: result.rows
    });
  } catch (err) {
    console.error('Error debugging join:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CFB API is running',
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    timestamp: new Date().toISOString()
  });
});

// Complete Luck Leaderboard endpoint - add this to your server.js
app.get('/api/leaderboards/luck/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { conferenceOnly, includePostseason, conference } = req.query;
    
    console.log(`🍀 Calculating luck metrics for ${season} season`, {
      conferenceOnly, includePostseason, conference
    });
    
    // Build conference filter
    let conferenceFilter = '';
    let queryParams = [season];
    if (conference && conference !== 'all') {
      conferenceFilter = 'AND teams.conference = $2';
      queryParams.push(conference);
    }
    
    // Get teams with power ratings and power ranks
    const teamsResult = await pool.query(`
      SELECT DISTINCT ON (teams.school)
        teams.school as team_name,
        teams.conference,
        teams.logo_url,
        teams.classification,
        teams.abbreviation,
        tpr.power_rating,
        RANK() OVER (ORDER BY tpr.power_rating DESC) as power_rank
      FROM teams
      INNER JOIN team_power_ratings tpr ON tpr.team_name = teams.school AND tpr.season = $1
      WHERE teams.classification = 'fbs'
        ${conferenceFilter}
      ORDER BY teams.school
    `, queryParams);
    
    console.log(`📊 Found ${teamsResult.rows.length} FBS teams for luck calculations`);
    
    const luckStats = [];
    
    for (const team of teamsResult.rows) {
      try {
        // Build season type and conference filters for games
        let gameFilters = '';
        let gameParams = [team.team_name, season];
        
        if (includePostseason !== 'true') {
          gameFilters += ` AND g.season_type = 'regular'`;
        }
        
        if (conferenceOnly === 'true') {
          gameFilters += ` AND opp_teams.conference = $3`;
          gameParams.push(team.conference);
        }
        
        // Get games with betting data and game results
        const gamesResult = await pool.query(`
          SELECT 
            g.*,
            CASE 
              WHEN g.home_team = $1 THEN g.away_team
              ELSE g.home_team
            END as opponent,
            CASE 
              WHEN g.home_team = $1 THEN 'home'
              ELSE 'away'
            END as home_away,
            
            -- Betting data with fallback
            COALESCE(dk_lines.home_moneyline, espn_lines.home_moneyline) as home_moneyline,
            COALESCE(dk_lines.away_moneyline, espn_lines.away_moneyline) as away_moneyline,
            COALESCE(dk_lines.spread, espn_lines.spread) as spread
            
          FROM games g
          LEFT JOIN game_betting_lines dk_lines ON g.id = dk_lines.game_id 
            AND UPPER(TRIM(dk_lines.provider)) = 'DRAFTKINGS'
          LEFT JOIN game_betting_lines espn_lines ON g.id = espn_lines.game_id 
            AND UPPER(TRIM(espn_lines.provider)) = 'ESPN BET'
          LEFT JOIN teams opp_teams ON opp_teams.school = CASE 
            WHEN g.home_team = $1 THEN g.away_team
            ELSE g.home_team
          END
          WHERE (g.home_team = $1 OR g.away_team = $1) 
            AND g.season = $2
            AND g.completed = true
            AND g.season_type IN ('regular', 'postseason')
            ${gameFilters}
          ORDER BY g.week
        `, gameParams);
        
        // ✅ IMPROVED: Better NULL handling in turnover query
        const turnoverResult = await pool.query(`
          SELECT 
            COUNT(DISTINCT gts.game_id) as total_games,
            
            -- Team stats (Michigan's numbers)
            SUM(COALESCE(CASE WHEN gts.team = $1 THEN gts.total_fumbles END, 0)) as team_total_fumbles,
            SUM(COALESCE(CASE WHEN gts.team = $1 THEN gts.fumbles_recovered END, 0)) as team_fumbles_recovered,
            SUM(COALESCE(CASE WHEN gts.team = $1 THEN gts.fumbles_lost END, 0)) as team_fumbles_lost,
            SUM(COALESCE(CASE WHEN gts.team = $1 THEN gts.interceptions_thrown END, 0)) as team_interceptions_thrown,
            SUM(COALESCE(CASE WHEN gts.team = $1 THEN gts.interceptions END, 0)) as team_interceptions_forced,
            
            -- Opponent stats (all teams != Michigan)
            SUM(COALESCE(CASE WHEN gts.team != $1 THEN gts.total_fumbles END, 0)) as opp_total_fumbles,
            SUM(COALESCE(CASE WHEN gts.team != $1 THEN gts.fumbles_lost END, 0)) as opp_fumbles_lost,
            SUM(COALESCE(CASE WHEN gts.team != $1 THEN gts.interceptions_thrown END, 0)) as opp_interceptions_thrown
            
          FROM game_team_stats_new gts  
          JOIN games g ON gts.game_id = g.id
          WHERE g.season = $2
            AND (g.home_team = $1 OR g.away_team = $1)
            AND g.completed = true
            AND gts.season = $2
        `, [team.team_name, season]);
        
        const games = gamesResult.rows;
        const turnoverData = turnoverResult.rows[0] || {};
        
        if (games.length === 0) continue;
        
        // Calculate basic record
        let actualWins = 0;
        let actualLosses = 0;
        let closeGameWins = 0;
        let closeGameLosses = 0;
        let expectedWinsSum = 0;
        let deservedWinsSum = 0;
        let gamesWithBetting = 0;
        
        games.forEach(game => {
          // Calculate actual result
          const teamScore = game.home_team === team.team_name ? game.home_points : game.away_points;
          const oppScore = game.home_team === team.team_name ? game.away_points : game.home_points;
          const isWin = teamScore > oppScore;
          const pointDiff = Math.abs(teamScore - oppScore);
          
          if (isWin) {
            actualWins++;
            if (pointDiff <= 8) closeGameWins++;
          } else {
            actualLosses++;
            if (pointDiff <= 8) closeGameLosses++;
          }
          
          // Calculate expected wins from pregame betting odds
          if (game.home_moneyline && game.away_moneyline) {
            const homeRawProb = 1 / (game.home_moneyline > 0 ? (game.home_moneyline / 100 + 1) : (1 + 100 / Math.abs(game.home_moneyline)));
            const awayRawProb = 1 / (game.away_moneyline > 0 ? (game.away_moneyline / 100 + 1) : (1 + 100 / Math.abs(game.away_moneyline)));
            
            if (homeRawProb && awayRawProb) {
              const totalProb = homeRawProb + awayRawProb;
              const teamProb = game.home_away === 'home' ? homeRawProb / totalProb : awayRawProb / totalProb;
              expectedWinsSum += teamProb;
              gamesWithBetting++;
            }
          } else if (game.spread) {
            // Fallback to spread calculation
            const spreadValue = parseFloat(game.spread);
            const adjustedSpread = game.home_away === 'home' ? spreadValue : -spreadValue;
            const z = -adjustedSpread / 13.5;
            const teamProb = 0.5 * (1.0 + (z < 0 ? -1 : 1) * Math.sqrt(1.0 - Math.exp(-2 * z * z / Math.PI)));
            expectedWinsSum += Math.max(0, Math.min(1, teamProb));
            gamesWithBetting++;
          }
          
          // Calculate deserved wins from postgame win probability
          const postgameProb = game.home_away === 'home' 
            ? parseFloat(game.home_postgame_win_probability || 0)
            : parseFloat(game.away_postgame_win_probability || 0);
          
          if (postgameProb > 0) {
            deservedWinsSum += postgameProb;
          }
        });
        
        // ✅ FIXED: Convert strings to numbers and calculate turnover metrics properly
        const teamTotalFumbles = parseInt(turnoverData.team_total_fumbles) || 0;
        const teamFumblesRecovered = parseInt(turnoverData.team_fumbles_recovered) || 0;
        const oppTotalFumbles = parseInt(turnoverData.opp_total_fumbles) || 0;
        const oppFumblesLost = parseInt(turnoverData.opp_fumbles_lost) || 0;
        const teamFumblesLost = parseInt(turnoverData.team_fumbles_lost) || 0;
        const teamInterceptionsThrown = parseInt(turnoverData.team_interceptions_thrown) || 0;
        const oppInterceptionsThrown = parseInt(turnoverData.opp_interceptions_thrown) || 0;
        const teamInterceptionsForced = parseInt(turnoverData.team_interceptions_forced) || 0;

        // Fumble recovery rate: What % of all fumbles in team's games did they recover?
        const totalFumblesInGames = teamTotalFumbles + oppTotalFumbles;
        const totalFumblesRecoveredByTeam = teamFumblesRecovered + oppFumblesLost;

        const fumbleRecoveryRate = totalFumblesInGames > 0 ? 
          (totalFumblesRecoveredByTeam / totalFumblesInGames) * 100 : 50;

        // Interception rate: What % of all interceptions in team's games did they make?
        const totalInterceptionsInGames = teamInterceptionsThrown + oppInterceptionsThrown;
        const interceptionRate = totalInterceptionsInGames > 0 ? 
          (teamInterceptionsForced / totalInterceptionsInGames) * 100 : 0;

        // ✅ FIXED: Simple turnover margin calculation
        const teamTurnovers = teamFumblesLost + teamInterceptionsThrown;
        const teamTakeaways = teamInterceptionsForced + oppFumblesLost;
        const turnoverMargin = teamTakeaways - teamTurnovers;

        // ✅ DEBUG: Enhanced logging for key teams
        if (['BYU', 'Michigan', 'Ohio State', 'Oregon', 'Texas'].includes(team.team_name)) {
          console.log(`\n🍀 ${team.team_name} DETAILED turnover breakdown:`);
          console.log('Raw data from DB:', {
            total_games: turnoverData.total_games,
            team_total_fumbles: turnoverData.team_total_fumbles,
            team_fumbles_recovered: turnoverData.team_fumbles_recovered,
            team_fumbles_lost: turnoverData.team_fumbles_lost,
            opp_total_fumbles: turnoverData.opp_total_fumbles,
            opp_fumbles_lost: turnoverData.opp_fumbles_lost,
            team_ints_thrown: turnoverData.team_interceptions_thrown,
            team_ints_forced: turnoverData.team_interceptions_forced,
            opp_ints_thrown: turnoverData.opp_interceptions_thrown
          });
          
          console.log('Calculated metrics:', {
            total_fumbles_in_games: totalFumblesInGames,
            fumbles_recovered_by_team: totalFumblesRecoveredByTeam,
            fumble_recovery_rate: fumbleRecoveryRate.toFixed(1) + '%',
            total_ints_in_games: totalInterceptionsInGames,
            interception_rate: interceptionRate.toFixed(1) + '%',
            turnovers_committed: teamTurnovers,
            takeaways_created: teamTakeaways,
            turnover_margin: turnoverMargin
          });
        }
        
        luckStats.push({
          team: team.team_name,
          conference: team.conference,
          logo_url: team.logo_url,
          classification: team.classification,
          abbreviation: team.abbreviation,
          power_rating: team.power_rating,
          power_rank: team.power_rank,
          
          // Basic record
          actual_wins: actualWins,
          actual_losses: actualLosses,
          total_games: actualWins + actualLosses,
          record: `${actualWins}-${actualLosses}`,
          
          // Expected vs Actual
          expected_wins: gamesWithBetting > 0 ? parseFloat(expectedWinsSum.toFixed(1)) : null,
          expected_vs_actual: gamesWithBetting > 0 ? parseFloat((actualWins - expectedWinsSum).toFixed(1)) : null,
          
          // Deserved vs Actual  
          deserved_wins: parseFloat(deservedWinsSum.toFixed(1)),
          deserved_vs_actual: parseFloat((deservedWinsSum - actualWins).toFixed(1)),
          
          // Expected vs Deserved (performance vs betting markets)
          expected_vs_deserved: gamesWithBetting > 0 ? parseFloat((deservedWinsSum - expectedWinsSum).toFixed(1)) : null,
          
          // Close games
          close_game_record: `${closeGameWins}-${closeGameLosses}`,
          close_games_total: closeGameWins + closeGameLosses,
          
          // ✅ CORRECTED: Turnover luck metrics
          fumble_recovery_rate: parseFloat(fumbleRecoveryRate.toFixed(1)),
          interception_rate: parseFloat(interceptionRate.toFixed(1)),
          turnover_margin: turnoverMargin,
          
          // Raw stats for debugging
          total_fumbles_in_games: totalFumblesInGames,
          total_interceptions_in_games: totalInterceptionsInGames,
          games_with_stats: turnoverData.total_games || 0,
          team_turnovers: teamTurnovers,
          team_takeaways: teamTakeaways
        });
        
      } catch (teamErr) {
        console.error(`Error processing luck data for ${team.team_name}:`, teamErr);
      }
    }
    
    // Sort by expected vs actual difference (most unlucky first)
    luckStats.sort((a, b) => (a.expected_vs_actual || 0) - (b.expected_vs_actual || 0));
    
    // Add rankings
    luckStats.forEach((team, index) => {
      team.luck_rank = index + 1;
    });
    
    console.log(`✅ Calculated luck metrics for ${luckStats.length} teams`);
    
    res.json({
      metadata: {
        season: season,
        total_teams: luckStats.length,
        calculation_date: new Date().toISOString(),
        description: `Luck metrics for ${season} season including expected wins, deserved wins, and turnover luck`,
        note: 'Using corrected turnover calculations with proper NULL handling'
      },
      teams: luckStats
    });
    
  } catch (err) {
    console.error('❌ Error calculating luck leaderboard:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
});

// Passing Stats Dashboard API endpoint - CLEAN VERSION
app.get('/api/leaderboards/passing/:season', async (req, res) => {
  try {
    const { season } = req.params;
    const { 
      conference_only = 'false', 
      regular_season_only = 'false',
      conference,
      side = 'offense',
      per_game = 'false'
    } = req.query;

    let whereClause = 'WHERE g.season = $1';
    let queryParams = [season];
    let paramIndex = 2;

    // Conference filter
    if (conference && conference !== 'all') {
      whereClause += ` AND t.conference = $${paramIndex}`;
      queryParams.push(conference);
      paramIndex++;
    }

    // Conference games only filter
    if (conference_only === 'true') {
      whereClause += ` AND t.conference = opp_t.conference`;
    }

    // Regular season only filter  
    if (regular_season_only === 'true') {
      whereClause += ` AND g.season_type = 'regular'`;
    }

    // Choose columns based on offense vs defense
    const statsColumns = side === 'offense' ? {
      completions: 'tgs.completions',
      passing_attempts: 'tgs.passing_attempts',
      net_passing_yards: 'tgs.net_passing_yards', 
      passing_tds: 'tgs.passing_tds',
      interceptions_thrown: 'tgs.interceptions_thrown',
      sacks: 'opp_tgs.sacks', // Sacks BY opponent (allowed by offense)
      qb_hurries: 'opp_tgs.qb_hurries' // QB hurries BY opponent (allowed by offense)
    } : {
      completions: 'opp_tgs.completions',
      passing_attempts: 'opp_tgs.passing_attempts',
      net_passing_yards: 'opp_tgs.net_passing_yards',
      passing_tds: 'opp_tgs.passing_tds', 
      interceptions_thrown: 'opp_tgs.interceptions_thrown',
      sacks: 'tgs.sacks', // Sacks made by defense
      qb_hurries: 'tgs.qb_hurries' // QB hurries made by defense
    };

    const query = `
      SELECT 
        tgs.team as team_name,
        t.logo_url,
        t.conference,
        t.color,
        t.alt_color,
        COUNT(g.id) as games_played,
        
        -- Calculate completion percentage
        CASE 
          WHEN SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0)) > 0 
          THEN ROUND((SUM(COALESCE(CAST(${statsColumns.completions} AS INTEGER), 0))::DECIMAL / 
                     SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0))::DECIMAL) * 100, 1)
          ELSE 0
        END as completion_percentage,
        
        -- Raw or per-game stats based on toggle
        ${per_game === 'true' ? `
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.completions} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as total_completions,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as total_attempts,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.net_passing_yards} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as net_passing_yards,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.passing_tds} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as passing_tds,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.interceptions_thrown} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as interceptions,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.sacks} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as sacks,
          CASE 
            WHEN COUNT(g.id) > 0 
            THEN ROUND(SUM(COALESCE(CAST(${statsColumns.qb_hurries} AS INTEGER), 0))::DECIMAL / COUNT(g.id)::DECIMAL, 1)
            ELSE 0
          END as qb_hurries
        ` : `
          SUM(COALESCE(CAST(${statsColumns.completions} AS INTEGER), 0)) as total_completions,
          SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0)) as total_attempts,
          SUM(COALESCE(CAST(${statsColumns.net_passing_yards} AS INTEGER), 0)) as net_passing_yards,
          SUM(COALESCE(CAST(${statsColumns.passing_tds} AS INTEGER), 0)) as passing_tds,
          SUM(COALESCE(CAST(${statsColumns.interceptions_thrown} AS INTEGER), 0)) as interceptions,
          SUM(COALESCE(CAST(${statsColumns.sacks} AS INTEGER), 0)) as sacks,
          SUM(COALESCE(CAST(${statsColumns.qb_hurries} AS INTEGER), 0)) as qb_hurries
        `},
        
        -- Yards per attempt (always calculated from totals)
        CASE 
          WHEN SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0)) > 0 
          THEN ROUND(SUM(COALESCE(CAST(${statsColumns.net_passing_yards} AS INTEGER), 0))::DECIMAL / 
                    SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0))::DECIMAL, 1)
          ELSE 0
        END as yards_per_attempt
        
      FROM games g
      JOIN game_team_stats_new tgs ON g.id = tgs.game_id
      JOIN teams t ON tgs.team = t.school AND t.classification = 'fbs'
      LEFT JOIN game_team_stats_new opp_tgs ON g.id = opp_tgs.game_id 
        AND tgs.team != opp_tgs.team
      LEFT JOIN teams opp_t ON opp_tgs.team = opp_t.school
      ${whereClause}
      GROUP BY tgs.team, t.logo_url, t.conference, t.color, t.alt_color
      HAVING COUNT(g.id) > 0
      ORDER BY 
        CASE 
          WHEN SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0)) > 0 
          THEN SUM(COALESCE(CAST(${statsColumns.net_passing_yards} AS INTEGER), 0))::DECIMAL / 
               SUM(COALESCE(CAST(${statsColumns.passing_attempts} AS INTEGER), 0))::DECIMAL
          ELSE 0
        END DESC;
    `;

    const result = await pool.query(query, queryParams);
    
    const teams = result.rows;
    const statsToRank = [
      'total_completions', 'total_attempts', 'completion_percentage', 'net_passing_yards', 'yards_per_attempt', 
      'passing_tds', 'interceptions', 'sacks', 'qb_hurries'
    ];
    
    statsToRank.forEach(stat => {
      // Determine if lower is better based on stat and side
      let isLowerBetter = false;
      
      if (side === 'offense') {
        // For offense: only interceptions and sacks are bad (lower is better)
        isLowerBetter = ['interceptions', 'sacks', 'qb_hurries'].includes(stat);
      } else {
        // For defense: most stats are bad when high (lower is better), except sacks/hurries/interceptions
        if (['sacks', 'qb_hurries', 'interceptions'].includes(stat)) {
          isLowerBetter = false; // Higher sacks/hurries/INTs is better for defense
        } else {
          isLowerBetter = true; // Lower yards/completions/TDs allowed is better for defense
        }
      }
      
      const sorted = [...teams].sort((a, b) => {
        const aVal = parseFloat(a[stat]) || 0;
        const bVal = parseFloat(b[stat]) || 0;
        return isLowerBetter ? aVal - bVal : bVal - aVal;
      });
      
      teams.forEach(team => {
        const rank = sorted.findIndex(t => t.team_name === team.team_name) + 1;
        team[`${stat}_rank`] = rank;
        team[`${stat}_percentile`] = Math.round(((teams.length - rank + 1) / teams.length) * 100);
      });
    });

    res.json({
      season: season,
      side: side,
      per_game: per_game === 'true',
      total_teams: teams.length,
      teams: teams
    });

  } catch (error) {
    console.error('Error fetching passing stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch passing stats',
      details: error.message 
    });
  }
});

// Default route - Updated with all endpoints including new ones
app.get('/', (req, res) => {
  res.json({
    message: 'CFB Analytics API',
    endpoints: [
      'GET /api/health',
      'GET /api/power-rankings?year=2025',
      'GET /api/available-years',
      'GET /api/teams/:teamName?year=2025',
      'GET /api/teams/:teamName/stats?season=2024',
      'GET /api/teams/:teamName/games?season=2025',
      'GET /api/teams/:teamName/games-enhanced/:season',
      'GET /api/all-advanced-stats/:season',
      'GET /api/leaderboards/strength-of-schedule-enhanced/:season',
      'GET /api/leaderboards/drive-efficiency/:season',
      'GET /api/debug-teams-table',
      'GET /api/debug-join?year=2025',
      'GET /api/debug/team-stats/:teamName/:season',
      'GET /api/debug/available-teams/:season',
      'GET /api/debug-teams',
      'GET /api/debug-betting-tables',
      'GET /api/debug-game-betting-lines',
      'GET /api/data-stats',
      'GET /api/missing-data',
      'GET /api/leaderboards/luck/:season'
    ]
  });
});

app.listen(port, () => {
  console.log(`CFB API server running on port ${port}`);
  console.log(`Database: ${process.env.DB_NAME || process.env.DB_DATABASE}`);
  console.log(`Available endpoints: http://localhost:${port}/`);
});