const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'ScheduleDB',
  password: process.env.DB_PASSWORD || 'lunch4kids',
  port: process.env.DB_PORT || 5432,
});

const API_KEY = process.env.CFB_API_KEY;
const BASE_URL = 'https://api.collegefootballdata.com';

// Delay function to respect rate limits
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchGameStatsForWeek(year, week) {
  try {
    console.log(`Fetching game stats for ${year} week ${week}...`);
    
    const response = await fetch(`${BASE_URL}/games/teams?year=${year}&week=${week}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`  Found ${data.length} game records`);
    
    // DEBUG: Log the structure of the first record and flatten for team count
    if (data.length > 0 && week === 1) {
      console.log('\n🔍 DEBUG - First API response structure:');
      console.log('Keys in first record:', Object.keys(data[0]));
      console.log('First record sample:', JSON.stringify(data[0], null, 2));
      
      // Count total teams across all games
      let totalTeams = 0;
      const allTeams = [];
      
      data.forEach(game => {
        if (game.teams && Array.isArray(game.teams)) {
          totalTeams += game.teams.length;
          game.teams.forEach(team => {
            allTeams.push(team.team);
          });
        }
      });
      
      console.log(`\n📊 Total teams across all games: ${totalTeams}`);
      console.log('Sample team names:', allTeams.slice(0, 10));
      
      // Look for Michigan specifically across all weeks
      const michiganTeams = allTeams.filter(team => 
        team && team.toLowerCase().includes('michigan')
      );
      
      if (michiganTeams.length > 0) {
        console.log('\n🏈 Michigan teams found:', michiganTeams);
      } else {
        console.log('\n❌ No Michigan teams found in week 1');
        console.log('Looking for Michigan in other teams...');
        console.log('Teams containing "M":', allTeams.filter(team => 
          team && team.toLowerCase().includes('m')
        ).slice(0, 5));
      }
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching week ${week}:`, error.message);
    return [];
  }
}

async function createGameTeamStatsTable() {
  try {
    // Drop existing tables and recreate
    await pool.query('DROP TABLE IF EXISTS game_team_stats_new');
    
    const createTableQuery = `
      CREATE TABLE game_team_stats_new (
        id SERIAL PRIMARY KEY,
        game_id INTEGER,
        team VARCHAR(100),
        conference VARCHAR(100),
        home_away VARCHAR(10),
        points INTEGER,
        season INTEGER,
        week INTEGER,
        season_type VARCHAR(20),
        
        -- Passing stats
        completions INTEGER,
        passing_attempts INTEGER,
        completion_percentage NUMERIC,
        net_passing_yards INTEGER,
        yards_per_pass NUMERIC,
        passing_tds INTEGER,
        interceptions_thrown INTEGER,
        
        -- Rushing stats  
        rushing_attempts INTEGER,
        rushing_yards INTEGER,
        yards_per_rush NUMERIC,
        rushing_tds INTEGER,
        
        -- Total offense
        total_yards INTEGER,
        total_plays INTEGER,
        yards_per_play NUMERIC,
        
        -- Defensive stats
        tackles INTEGER,
        tackles_for_loss NUMERIC,
        sacks NUMERIC,
        qb_hurries NUMERIC,
        interceptions INTEGER,
        passes_deflected NUMERIC,
        fumbles_recovered INTEGER,
        
        -- Penalties and turnovers
        fumbles_lost INTEGER,
        total_fumbles INTEGER,
        turnovers INTEGER,
        penalties INTEGER,
        penalty_yards INTEGER,
        
        -- Special teams
        kicking_points INTEGER,
        punt_returns INTEGER,
        punt_return_yards INTEGER,
        punt_return_tds INTEGER,
        kick_returns INTEGER,
        kick_return_yards INTEGER,
        kick_return_tds INTEGER,
        
        -- Situational
        first_downs INTEGER,
        third_down_conversions INTEGER,
        third_down_attempts INTEGER,
        third_down_percentage NUMERIC,
        fourth_down_conversions INTEGER,
        fourth_down_attempts INTEGER,
        fourth_down_percentage NUMERIC,
        
        -- Time of possession
        possession_time VARCHAR(10),
        possession_seconds INTEGER,
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableQuery);
    console.log('Created game_team_stats_new table');
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

function transformStatsToColumns(teamGameData) {
  // Initialize the base record
  const record = {
    game_id: teamGameData.id,
    team: teamGameData.team,
    conference: teamGameData.conference,
    home_away: teamGameData.homeAway,
    points: teamGameData.points,
    season: teamGameData.season || 2024,
    week: teamGameData.week,
    season_type: teamGameData.seasonType || 'regular'
  };
  
  // DEBUG: Log the stats for the first few records
  if (teamGameData.team === 'Michigan' && teamGameData.week <= 2) {
    console.log('\n🔍 DEBUG - Michigan stats for week', teamGameData.week);
    console.log('Available stats:');
    if (teamGameData.stats && Array.isArray(teamGameData.stats)) {
      teamGameData.stats.forEach(stat => {
        console.log(`  "${stat.category}" = "${stat.stat}"`);
      });
    } else {
      console.log('  No stats array found');
    }
  }
  
  // Transform stats array into individual columns
  if (teamGameData.stats && Array.isArray(teamGameData.stats)) {
    teamGameData.stats.forEach(stat => {
      const category = stat.category;
      const categoryLower = category.toLowerCase().replace(/\s+/g, '_');
      let value = stat.stat;
      
      // Convert numeric values
      if (!isNaN(value) && value !== '') {
        value = parseFloat(value);
      }
      
      // Handle specific stat mappings - using exact API category names
      switch (category) {
        case 'completionAttempts':
          if (typeof value === 'string' && value.includes('-')) {
            const [completions, attempts] = value.split('-').map(v => parseInt(v));
            record.completions = completions;
            record.passing_attempts = attempts;
            record.completion_percentage = attempts > 0 ? (completions / attempts * 100) : 0;
          }
          break;
        case 'netPassingYards':
          record.net_passing_yards = value;
          break;
        case 'yardsPerPass':
          record.yards_per_pass = value;
          break;
        case 'passingTDs':
          record.passing_tds = value;
          break;
        case 'interceptions':
          record.interceptions_thrown = value;
          break;
        case 'rushingAttempts':
          record.rushing_attempts = value;
          break;
        case 'rushingYards':
          record.rushing_yards = value;
          break;
        case 'yardsPerRushAttempt':
          record.yards_per_rush = value;
          break;
        case 'rushingTDs':
          record.rushing_tds = value;
          break;
        case 'totalYards':
          record.total_yards = value;
          break;
        case 'tackles':
          record.tackles = value;
          break;
        case 'tacklesForLoss':
          record.tackles_for_loss = value;
          break;
        case 'sacks':
          record.sacks = value;
          break;
        case 'qbHurries':
          record.qb_hurries = value;
          break;
        case 'passesIntercepted':
          // This is defensive interceptions
          record.interceptions = value;
          break;
        case 'passesDeflected':
          record.passes_deflected = value;
          break;
        case 'fumblesRecovered':
          record.fumbles_recovered = value;
          break;
        case 'fumblesLost':
          record.fumbles_lost = value;
          break;
        case 'totalFumbles':
          record.total_fumbles = value;
          break;
        case 'turnovers':
          record.turnovers = value;
          break;
        case 'penalties':
          record.penalties = value;
          break;
        case 'penaltyYards':
          record.penalty_yards = value;
          break;
        case 'kickingPoints':
          record.kicking_points = value;
          break;
        case 'firstDowns':
          record.first_downs = value;
          break;
        case 'thirdDownEff':
          if (typeof value === 'string' && value.includes('-')) {
            const [conversions, attempts] = value.split('-').map(v => parseInt(v));
            record.third_down_conversions = conversions;
            record.third_down_attempts = attempts;
            record.third_down_percentage = attempts > 0 ? (conversions / attempts * 100) : 0;
          }
          break;
        case 'fourthDownEff':
          if (typeof value === 'string' && value.includes('-')) {
            const [conversions, attempts] = value.split('-').map(v => parseInt(v));
            record.fourth_down_conversions = conversions;
            record.fourth_down_attempts = attempts;
            record.fourth_down_percentage = attempts > 0 ? (conversions / attempts * 100) : 0;
          }
          break;
        case 'possessionTime':
          record.possession_time = value;
          // Convert time to seconds for easier calculations
          if (typeof value === 'string' && value.includes(':')) {
            const [minutes, seconds] = value.split(':').map(v => parseInt(v));
            record.possession_seconds = (minutes * 60) + seconds;
          }
          break;
        // Add more mappings as needed
        default:
          // For any unmapped stats, just use the category name (debug)
          if (teamGameData.team === 'Michigan' && teamGameData.week <= 2) {
            console.log(`  Unmapped stat: "${category}" = "${value}"`);
          }
          break;
      }
    });
  }
  
  return record;
}

async function insertGameTeamStats(gameStatsData) {
  const insertQuery = `
    INSERT INTO game_team_stats_new (
      game_id, team, conference, home_away, points, season, week, season_type,
      completions, passing_attempts, completion_percentage, net_passing_yards, yards_per_pass, passing_tds, interceptions_thrown,
      rushing_attempts, rushing_yards, yards_per_rush, rushing_tds,
      total_yards, total_plays, yards_per_play,
      tackles, tackles_for_loss, sacks, qb_hurries, interceptions, passes_deflected, fumbles_recovered,
      fumbles_lost, total_fumbles, turnovers, penalties, penalty_yards,
      kicking_points, punt_returns, punt_return_yards, punt_return_tds, kick_returns, kick_return_yards, kick_return_tds,
      first_downs, third_down_conversions, third_down_attempts, third_down_percentage,
      fourth_down_conversions, fourth_down_attempts, fourth_down_percentage,
      possession_time, possession_seconds
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
      $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
      $43, $44, $45, $46, $47, $48, $49, $50
    )
  `;

  let insertedCount = 0;
  let skippedCount = 0;

  // Process each game record (which contains multiple teams)
  for (const gameRecord of gameStatsData) {
    if (!gameRecord.teams || !Array.isArray(gameRecord.teams)) {
      console.log(`Skipping game ${gameRecord.id} - no teams array`);
      skippedCount++;
      continue;
    }

    // Process each team in the game
    for (const teamData of gameRecord.teams) {
      try {
        // DEBUG: Check what we're getting
        if (teamData.team === 'Michigan') {
          console.log('\n🏈 DEBUG - Processing Michigan record:');
          console.log('Team data keys:', Object.keys(teamData));
          console.log('Team name:', teamData.team);
          console.log('Conference:', teamData.conference);
          console.log('Game ID:', gameRecord.id);
        }

        const record = transformStatsToColumns({
          ...teamData,
          id: gameRecord.id,
          season: 2024, // Hard-code for now since API doesn't provide
          week: null,   // We need to get this from somewhere else
          seasonType: 'regular' // Default for now
        });
        
        // DEBUG: Check what we transformed
        if (teamData.team === 'Michigan') {
          console.log('Transformed record keys:', Object.keys(record));
          console.log('Transformed team name:', record.team);
          console.log('Transformed total_fumbles:', record.total_fumbles);
        }
        
        await pool.query(insertQuery, [
          record.game_id, record.team, record.conference, record.home_away, record.points, 
          record.season, record.week, record.season_type,
          record.completions, record.passing_attempts, record.completion_percentage, 
          record.net_passing_yards, record.yards_per_pass, record.passing_tds, record.interceptions_thrown,
          record.rushing_attempts, record.rushing_yards, record.yards_per_rush, record.rushing_tds,
          record.total_yards, record.total_plays, record.yards_per_play,
          record.tackles, record.tackles_for_loss, record.sacks, record.qb_hurries, 
          record.interceptions, record.passes_deflected, record.fumbles_recovered,
          record.fumbles_lost, record.total_fumbles, record.turnovers, record.penalties, record.penalty_yards,
          record.kicking_points, record.punt_returns, record.punt_return_yards, record.punt_return_tds,
          record.kick_returns, record.kick_return_yards, record.kick_return_tds,
          record.first_downs, record.third_down_conversions, record.third_down_attempts, record.third_down_percentage,
          record.fourth_down_conversions, record.fourth_down_attempts, record.fourth_down_percentage,
          record.possession_time, record.possession_seconds
        ]);
        
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting stats for ${teamData.team}:`, error.message);
        skippedCount++;
      }
    }
  }

  return { insertedCount, skippedCount };
}

async function fetchAll2024GameStats() {
  try {
    console.log('Starting 2024 game team stats fetch...');
    
    // Create the new table
    await createGameTeamStatsTable();
    
    let totalInserted = 0;
    let totalSkipped = 0;

    // Fetch regular season weeks (1-15) and postseason
    const weeks = Array.from({length: 15}, (_, i) => i + 1);
    weeks.push(16, 17, 18, 19); // Bowl games and playoffs

    for (const week of weeks) {
      const weekData = await fetchGameStatsForWeek(2024, week);
      
      if (weekData.length > 0) {
        const { insertedCount, skippedCount } = await insertGameTeamStats(weekData);
        totalInserted += insertedCount;
        totalSkipped += skippedCount;
        
        console.log(`  Week ${week}: Inserted ${insertedCount} records, skipped ${skippedCount}`);
      }
      
      // Rate limiting - wait 1 second between requests
      await delay(1000);
    }

    // Summary
    console.log('\n=== FETCH COMPLETE ===');
    console.log(`Total records inserted: ${totalInserted}`);
    console.log(`Total records skipped: ${totalSkipped}`);

    // Show sample of what we got
    const sampleQuery = `
      SELECT team, COUNT(*) as games_count, 
             AVG(total_fumbles) as avg_fumbles,
             AVG(interceptions) as avg_ints_forced,
             AVG(interceptions_thrown) as avg_ints_thrown
      FROM game_team_stats_new 
      WHERE season = 2024
      GROUP BY team 
      ORDER BY games_count DESC
      LIMIT 10
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    console.log('\nSample Team Stats:');
    console.table(sampleResult.rows);

    console.log('\n=== READY TO REPLACE OLD TABLE ===');
    console.log('If everything looks good, run these commands:');
    console.log('DROP TABLE game_team_stats;');
    console.log('ALTER TABLE game_team_stats_new RENAME TO game_team_stats;');

  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await pool.end();
  }
}

// Export for use as module or run directly
if (require.main === module) {
  fetchAll2024GameStats();
}

module.exports = { fetchAll2024GameStats };