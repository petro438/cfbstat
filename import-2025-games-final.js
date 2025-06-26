// Create this as: cfb-api/import-2025-games-final.js
// Final version that avoids foreign key issues and shows complete stats

const { Pool } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'ScheduleDB',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

const CFB_API_KEY = process.env.CFB_API_KEY;

async function import2025FBSGamesFinal() {
  console.log('🏈 Starting 2025 FBS games import (final version)...');
  
  try {
    // Fetch 2025 games from College Football Data API
    console.log('📡 Fetching 2025 regular season games...');
    
    const response = await fetch(`https://api.collegefootballdata.com/games?year=2025&seasonType=regular`, {
      headers: {
        'Authorization': `Bearer ${CFB_API_KEY}`,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`CFB API error: ${response.status} - ${response.statusText}`);
    }
    
    const allGames = await response.json();
    console.log(`✅ Found ${allGames.length} total games for 2025`);
    
    // Filter for FBS games only
    const fbsGames = allGames.filter(game => 
      game.homeClassification === 'fbs' || game.awayClassification === 'fbs'
    );
    
    console.log(`🎯 Filtered to ${fbsGames.length} games involving FBS teams`);
    
    // Clear existing 2025 games first
    console.log('🧹 Clearing existing 2025 games...');
    await pool.query('DELETE FROM games WHERE season = 2025');
    
    // Insert FBS games with minimal columns to avoid foreign key issues
    console.log('💾 Inserting FBS games (avoiding foreign key constraints)...');
    let insertedCount = 0;
    let errorCount = 0;
    
    for (const game of fbsGames) {
      try {
        // Use minimal columns to avoid foreign key constraints
        const insertQuery = `
          INSERT INTO games (
            id, season, week, season_type, start_date,
            home_team, away_team, 
            home_points, away_points,
            completed, neutral_site, conference_game,
            home_conference, away_conference,
            home_classification, away_classification
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (id) DO UPDATE SET
            start_date = EXCLUDED.start_date,
            completed = EXCLUDED.completed,
            home_points = EXCLUDED.home_points,
            away_points = EXCLUDED.away_points
        `;
        
        // Helper functions
        const safeString = (val) => val ? String(val) : null;
        const safeNumber = (val) => {
          if (val === null || val === undefined || val === '') return null;
          const num = parseFloat(val);
          return isNaN(num) ? null : num;
        };
        const safeBool = (val) => Boolean(val);
        
        const values = [
          game.id,                                      // id
          2025,                                         // season
          game.week,                                    // week
          game.seasonType || 'regular',                 // season_type
          game.startDate,                               // start_date
          safeString(game.homeTeam),                    // home_team
          safeString(game.awayTeam),                    // away_team
          safeNumber(game.homePoints),                  // home_points
          safeNumber(game.awayPoints),                  // away_points
          safeBool(game.completed),                     // completed
          safeBool(game.neutralSite),                   // neutral_site
          safeBool(game.conferenceGame),                // conference_game
          safeString(game.homeConference),              // home_conference
          safeString(game.awayConference),              // away_conference
          safeString(game.homeClassification),          // home_classification
          safeString(game.awayClassification)           // away_classification
        ];
        
        await pool.query(insertQuery, values);
        insertedCount++;
        
        if (insertedCount % 100 === 0) {
          console.log(`📈 Inserted ${insertedCount}/${fbsGames.length} FBS games...`);
        }
        
      } catch (err) {
        errorCount++;
        if (errorCount <= 3) {
          console.error(`❌ Error inserting game ${game.id}:`, err.message);
        }
      }
    }
    
    console.log(`✅ Successfully imported ${insertedCount} FBS games for 2025 season`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} games had errors and were skipped`);
    }
    
    // Complete verification and stats
    const verifyQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN completed = true THEN 1 END) as completed_games,
        COUNT(CASE WHEN completed = false THEN 1 END) as scheduled_games,
        COUNT(DISTINCT home_team) as unique_home_teams,
        COUNT(DISTINCT away_team) as unique_away_teams,
        MIN(start_date) as earliest_game,
        MAX(start_date) as latest_game
      FROM games 
      WHERE season = 2025
    `);
    
    console.log('📊 Complete Import Summary:', verifyQuery.rows[0]);
    
    // Show ALL FBS teams and their game counts
    const allFBSTeams = await pool.query(`
      SELECT 
        team_name,
        game_count,
        CASE WHEN t.school IS NOT NULL THEN '✅ Found in teams table' 
             ELSE '❌ Missing from teams table' END as status,
        t.conference
      FROM (
        SELECT team_name, COUNT(*) as game_count
        FROM (
          SELECT home_team as team_name 
          FROM games 
          WHERE season = 2025 AND home_classification = 'fbs'
          UNION ALL
          SELECT away_team as team_name 
          FROM games 
          WHERE season = 2025 AND away_classification = 'fbs'
        ) all_team_games
        GROUP BY team_name
      ) team_counts
      LEFT JOIN teams t ON LOWER(TRIM(t.school)) = LOWER(TRIM(team_counts.team_name))
      ORDER BY game_count DESC, team_name
    `);
    
    console.log(`\n🏈 ALL FBS TEAMS IN 2025 SCHEDULE (${allFBSTeams.rows.length} teams):`);
    allFBSTeams.rows.forEach(team => {
      console.log(`  ${team.status} ${team.team_name} (${team.game_count} games) ${team.conference ? `- ${team.conference}` : ''}`);
    });
    
    // Count missing teams
    const missingTeams = allFBSTeams.rows.filter(team => team.status.includes('Missing'));
    console.log(`\n⚠️  ${missingTeams.rows?.length || missingTeams.length} FBS teams missing from teams table`);
    
    // Show game type breakdown
    const gameTypes = await pool.query(`
      SELECT 
        home_classification,
        away_classification,
        COUNT(*) as game_count
      FROM games 
      WHERE season = 2025
      GROUP BY home_classification, away_classification
      ORDER BY game_count DESC
    `);
    
    console.log('\n📈 Game Types Breakdown:');
    gameTypes.rows.forEach(row => {
      console.log(`  ${row.home_classification} vs ${row.away_classification}: ${row.game_count} games`);
    });
    
    // Show week distribution
    const weekDistribution = await pool.query(`
      SELECT 
        week,
        COUNT(*) as game_count,
        COUNT(CASE WHEN home_classification = 'fbs' AND away_classification = 'fbs' THEN 1 END) as fbs_vs_fbs
      FROM games 
      WHERE season = 2025
      GROUP BY week
      ORDER BY week
    `);
    
    console.log('\n📅 Games by Week:');
    weekDistribution.rows.forEach(row => {
      console.log(`  Week ${row.week}: ${row.game_count} total games (${row.fbs_vs_fbs} FBS vs FBS)`);
    });
    
  } catch (error) {
    console.error('💥 Import failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the import
import2025FBSGamesFinal();