// Create this as: cfb-api/update-2025-results.js
// Script to update game results during the season (run weekly)

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

async function updateGameResults(weekNumber = null) {
  console.log('🏈 Updating 2025 game results...');
  
  try {
    // Build API URL - if no week specified, get all games
    let apiUrl = `https://api.collegefootballdata.com/games?year=2025&seasonType=regular`;
    if (weekNumber) {
      apiUrl += `&week=${weekNumber}`;
      console.log(`📡 Fetching results for week ${weekNumber}...`);
    } else {
      console.log('📡 Fetching all 2025 game results...');
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${CFB_API_KEY}`,
        'accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`CFB API error: ${response.status} - ${response.statusText}`);
    }
    
    const games = await response.json();
    console.log(`✅ Found ${games.length} games to check for updates`);
    
    if (games.length === 0) {
      console.log('⚠️  No games found for update');
      return;
    }
    
    let updatedCount = 0;
    let newlyCompletedCount = 0;
    
    for (const game of games) {
      try {
        // Check if this game exists and if it needs updating
        const existingGame = await pool.query(
          'SELECT completed, home_points, away_points FROM games WHERE id = $1',
          [game.id]
        );
        
        if (existingGame.rows.length === 0) {
          console.log(`⚠️  Game ${game.id} not found in database, skipping...`);
          continue;
        }
        
        const existing = existingGame.rows[0];
        const gameCompleted = Boolean(game.completed);
        const homePoints = game.home_points ? parseFloat(game.home_points) : null;
        const awayPoints = game.away_points ? parseFloat(game.away_points) : null;
        
        // Check if we need to update this game
        const needsUpdate = 
          existing.completed !== gameCompleted ||
          existing.home_points !== homePoints ||
          existing.away_points !== awayPoints;
        
        if (needsUpdate) {
          await pool.query(`
            UPDATE games SET 
              completed = $1,
              home_points = $2,
              away_points = $3,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
          `, [gameCompleted, homePoints, awayPoints, game.id]);
          
          updatedCount++;
          
          if (!existing.completed && gameCompleted) {
            newlyCompletedCount++;
            console.log(`🎉 Game completed: ${game.away_team} ${awayPoints} - ${homePoints} ${game.home_team}`);
          }
        }
        
      } catch (err) {
        console.error(`❌ Error updating game ${game.id}:`, err.message);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} games`);
    console.log(`🎉 ${newlyCompletedCount} newly completed games`);
    
    // Show current season progress
    const progressQuery = await pool.query(`
      SELECT 
        COUNT(*) as total_games,
        COUNT(CASE WHEN completed = true THEN 1 END) as completed_games,
        COUNT(CASE WHEN completed = false THEN 1 END) as remaining_games,
        ROUND(COUNT(CASE WHEN completed = true THEN 1 END) * 100.0 / COUNT(*), 1) as completion_percentage
      FROM games 
      WHERE season = 2025 AND season_type = 'regular'
    `);
    
    console.log('📊 Season Progress:', progressQuery.rows[0]);
    
    // Show recent completed games
    if (newlyCompletedCount > 0) {
      const recentGames = await pool.query(`
        SELECT home_team, away_team, home_points, away_points, start_date, week
        FROM games 
        WHERE season = 2025 
          AND completed = true 
          AND (home_points IS NOT NULL OR away_points IS NOT NULL)
        ORDER BY start_date DESC 
        LIMIT 10
      `);
      
      console.log('🏆 Recent completed games:');
      recentGames.rows.forEach(game => {
        const winner = game.home_points > game.away_points ? game.home_team : game.away_team;
        console.log(`  Week ${game.week}: ${game.away_team} ${game.away_points} - ${game.home_points} ${game.home_team} (${winner} wins)`);
      });
    }
    
  } catch (error) {
    console.error('💥 Update failed:', error);
  } finally {
    await pool.end();
  }
}

// Get week number from command line arguments
const weekArg = process.argv[2];
const weekNumber = weekArg ? parseInt(weekArg) : null;

if (weekNumber && (weekNumber < 1 || weekNumber > 15)) {
  console.log('⚠️  Week number should be between 1-15');
  process.exit(1);
}

// Run the update
updateGameResults(weekNumber);