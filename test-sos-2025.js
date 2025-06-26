// Create this as: cfb-api/test-sos-2025.js
// Test the SOS calculation with your imported 2025 games

const { Pool } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || process.env.DB_DATABASE || 'ScheduleDB',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

async function testSOSCalculation() {
  console.log('🏈 Testing 2025 Strength of Schedule calculation...');
  
  try {
    // First, check our data sources
    console.log('\n📊 Data Source Check:');
    
    const gamesCheck = await pool.query(`
      SELECT COUNT(*) as total_2025_games,
             COUNT(DISTINCT home_team) + COUNT(DISTINCT away_team) as unique_teams
      FROM games 
      WHERE season = 2025
    `);
    console.log(`  ✅ ${gamesCheck.rows[0].total_2025_games} games imported for 2025`);
    console.log(`  ✅ ${gamesCheck.rows[0].unique_teams} unique team mentions`);
    
    const powerRatingsCheck = await pool.query(`
      SELECT COUNT(*) as teams_with_ratings
      FROM team_power_ratings 
      WHERE power_rating IS NOT NULL
    `);
    console.log(`  ✅ ${powerRatingsCheck.rows[0].teams_with_ratings} teams have power ratings`);
    
    // Test SOS calculation for a few specific teams
    console.log('\n🎯 Testing SOS Calculation for Sample Teams:');
    
    const sosTestQuery = `
      WITH team_schedules AS (
        -- Get all opponents for specific teams
        SELECT 
          g.home_team as team,
          g.away_team as opponent,
          g.week,
          g.completed
        FROM games g
        WHERE g.season = 2025 
          AND g.home_team IN ('Alabama', 'Georgia', 'Michigan', 'Texas')
        
        UNION ALL
        
        SELECT 
          g.away_team as team,
          g.home_team as opponent,
          g.week,
          g.completed
        FROM games g
        WHERE g.season = 2025 
          AND g.away_team IN ('Alabama', 'Georgia', 'Michigan', 'Texas')
      ),
      
      team_sos AS (
        SELECT 
          ts.team,
          COUNT(*) as total_games,
          -- Get opponent power ratings
          AVG(COALESCE(tpr.power_rating, 0)) as avg_opponent_power_rating,
          -- List some opponents for verification
          STRING_AGG(ts.opponent, ', ' ORDER BY ts.week) as opponents
        FROM team_schedules ts
        LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(tpr.team_name)) = LOWER(TRIM(ts.opponent))
        GROUP BY ts.team
      )
      
      SELECT 
        tsos.team,
        tsos.total_games,
        ROUND(tsos.avg_opponent_power_rating, 3) as strength_of_schedule,
        tpr_own.power_rating as team_own_rating,
        tsos.opponents
      FROM team_sos tsos
      LEFT JOIN team_power_ratings tpr_own ON LOWER(TRIM(tpr_own.team_name)) = LOWER(TRIM(tsos.team))
      ORDER BY tsos.avg_opponent_power_rating DESC
    `;
    
    const sosTest = await pool.query(sosTestQuery);
    
    if (sosTest.rows.length > 0) {
      console.log('Sample SOS Calculations:');
      sosTest.rows.forEach(team => {
        console.log(`  ${team.team}:`);
        console.log(`    • Games: ${team.total_games}`);
        console.log(`    • SOS: ${team.strength_of_schedule} (team rating: ${team.team_own_rating})`);
        console.log(`    • Opponents: ${team.opponents?.substring(0, 100)}...`);
        console.log('');
      });
    } else {
      console.log('❌ No SOS data calculated - checking for issues...');
      
      // Debug: Check if teams exist
      const teamCheck = await pool.query(`
        SELECT DISTINCT home_team 
        FROM games 
        WHERE season = 2025 
          AND home_team IN ('Alabama', 'Georgia', 'Michigan', 'Texas')
        LIMIT 5
      `);
      console.log('Teams found in games:', teamCheck.rows);
      
      // Debug: Check team name matching
      const nameMatchCheck = await pool.query(`
        SELECT g.home_team, tpr.team_name, tpr.power_rating
        FROM games g
        LEFT JOIN team_power_ratings tpr ON LOWER(TRIM(tpr.team_name)) = LOWER(TRIM(g.home_team))
        WHERE g.season = 2025
          AND g.home_team IS NOT NULL
        LIMIT 10
      `);
      console.log('Team name matching sample:', nameMatchCheck.rows);
    }
    
    // Quick test of the actual API endpoint
    console.log('\n🌐 Testing API Endpoint Response:');
    try {
      const response = await fetch('http://localhost:5000/api/leaderboards/strength-of-schedule/2025');
      if (response.ok) {
        const data = await response.json();
        console.log(`  ✅ API working: ${data.teams?.length || 0} teams in SOS leaderboard`);
        if (data.teams && data.teams.length > 0) {
          console.log(`  🏆 Hardest schedule: ${data.teams[0].team} (SOS: ${data.teams[0].strength_of_schedule})`);
          console.log(`  😎 Easiest schedule: ${data.teams[data.teams.length - 1].team} (SOS: ${data.teams[data.teams.length - 1].strength_of_schedule})`);
        }
      } else {
        console.log(`  ❌ API Error: ${response.status}`);
        console.log('  💡 Make sure your server is running: npm start');
      }
    } catch (err) {
      console.log(`  ❌ API Test failed: ${err.message}`);
      console.log('  💡 Make sure your server is running on port 5000');
    }
    
  } catch (error) {
    console.error('💥 SOS test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test
testSOSCalculation();