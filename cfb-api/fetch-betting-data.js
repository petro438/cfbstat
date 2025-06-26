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

async function fetchBettingDataForWeek(year, week) {
  try {
    console.log(`Fetching betting data for ${year} week ${week}...`);
    
    const response = await fetch(`${BASE_URL}/lines?year=${year}&week=${week}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`  Found ${data.length} games with betting lines`);
    return data;
  } catch (error) {
    console.error(`Error fetching week ${week}:`, error.message);
    return [];
  }
}

async function createBettingTable() {
  try {
    // Drop table if exists and recreate
    await pool.query('DROP TABLE IF EXISTS game_betting_lines');
    
    const createTableQuery = `
      CREATE TABLE game_betting_lines (
        id SERIAL PRIMARY KEY,
        game_id INTEGER,
        home_team VARCHAR(100),
        away_team VARCHAR(100),
        week INTEGER,
        season INTEGER,
        provider VARCHAR(50),
        spread NUMERIC,
        formatted_spread VARCHAR(50),
        opening_spread NUMERIC,
        over_under NUMERIC,
        opening_over_under NUMERIC,
        home_moneyline INTEGER,
        away_moneyline INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableQuery);
    console.log('Created game_betting_lines table');
  } catch (error) {
    console.error('Error creating table:', error);
    throw error;
  }
}

async function insertBettingData(bettingData) {
  const insertQuery = `
    INSERT INTO game_betting_lines (
      game_id, home_team, away_team, week, season, provider, 
      spread, formatted_spread, opening_spread, over_under, 
      opening_over_under, home_moneyline, away_moneyline
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
  `;

  let insertedCount = 0;
  let skippedCount = 0;

  for (const game of bettingData) {
    // Skip games without betting lines
    if (!game.lines || game.lines.length === 0) {
      skippedCount++;
      continue;
    }

    for (const line of game.lines) {
      try {
        // Insert ALL lines (spread, moneyline, or both)
        await pool.query(insertQuery, [
          game.id,
          game.homeTeam,
          game.awayTeam,
          game.week,
          game.season,
          line.provider,
          line.spread || null,
          line.formattedSpread || null,
          line.spreadOpen || null,
          line.overUnder || null,
          line.overUnderOpen || null,
          line.homeMoneyline || null,
          line.awayMoneyline || null
        ]);
        insertedCount++;
      } catch (error) {
        console.error(`Error inserting line for game ${game.id}:`, error.message);
        skippedCount++;
      }
    }
  }

  return { insertedCount, skippedCount };
}

async function fetchAll2024BettingData() {
  try {
    console.log('Starting 2024 betting data fetch...');
    
    // Create the table
    await createBettingTable();
    
    let allBettingData = [];
    let totalInserted = 0;
    let totalSkipped = 0;

    // Fetch regular season weeks (1-15) and postseason
    const weeks = Array.from({length: 15}, (_, i) => i + 1);
    weeks.push(16, 17, 18, 19); // Bowl games and playoffs

    for (const week of weeks) {
      const weekData = await fetchBettingDataForWeek(2024, week);
      
      if (weekData.length > 0) {
        const { insertedCount, skippedCount } = await insertBettingData(weekData);
        totalInserted += insertedCount;
        totalSkipped += skippedCount;
        
        console.log(`  Week ${week}: Inserted ${insertedCount} lines, skipped ${skippedCount}`);
      }
      
      // Rate limiting - wait 1 second between requests
      await delay(1000);
    }

    // Summary
    console.log('\n=== FETCH COMPLETE ===');
    console.log(`Total lines inserted: ${totalInserted}`);
    console.log(`Total lines skipped: ${totalSkipped}`);

    // Show sample of what we got
    const sampleQuery = `
      SELECT 
        provider,
        COUNT(*) as total_lines,
        COUNT(CASE WHEN home_moneyline IS NOT NULL THEN 1 END) as lines_with_moneyline,
        COUNT(CASE WHEN spread IS NOT NULL THEN 1 END) as lines_with_spread,
        MIN(week) as first_week,
        MAX(week) as last_week
      FROM game_betting_lines
      GROUP BY provider 
      ORDER BY total_lines DESC
    `;
    
    const sampleResult = await pool.query(sampleQuery);
    console.log('\nProvider Summary:');
    console.table(sampleResult.rows);

    // Show Alabama sample
    const alabamaQuery = `
      SELECT home_team, away_team, week, provider, home_moneyline, away_moneyline, spread
      FROM game_betting_lines
      WHERE home_team = 'Alabama' OR away_team = 'Alabama'
      ORDER BY week, provider
      LIMIT 10
    `;
    
    const alabamaResult = await pool.query(alabamaQuery);
    console.log('\nAlabama Sample:');
    console.table(alabamaResult.rows);

  } catch (error) {
    console.error('Error in main function:', error);
  } finally {
    await pool.end();
  }
}

// Export for use as module or run directly
if (require.main === module) {
  fetchAll2024BettingData();
}

module.exports = { fetchAll2024BettingData };