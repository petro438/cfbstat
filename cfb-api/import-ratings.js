const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Simple CSV parser
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  
  return lines.slice(1).map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/"/g, ''));
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = result[index] || '';
    });
    return obj;
  }).filter(obj => Object.values(obj).some(val => val && val.length > 0));
}

async function importRatings(csvFilePath) {
  try {
    console.log('📁 Reading CSV file...');
    const csvData = fs.readFileSync(csvFilePath, 'utf8');
    const ratings = parseCSV(csvData);
    
    console.log(`📊 Found ${ratings.length} teams in CSV`);
    
    // Clear existing data
    await pool.query('DELETE FROM team_power_ratings');
    console.log('🗑️  Cleared existing ratings');
    
    // Insert new data
    let successCount = 0;
    let errorCount = 0;
    
    for (const team of ratings) {
      // Skip verification rows
      if (team['Team Name'] && 
          team['Team Name'] !== 'VERIFICATION (FBS AVERAGES):' && 
          team['Team Name'] !== 'New FBS Averages:') {
        
        try {
          await pool.query(`
            INSERT INTO team_power_ratings 
            (team_name, power_rating, offense_rating, defense_rating, strength_of_schedule)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (team_name) 
            DO UPDATE SET 
              power_rating = EXCLUDED.power_rating,
              offense_rating = EXCLUDED.offense_rating,
              defense_rating = EXCLUDED.defense_rating,
              strength_of_schedule = EXCLUDED.strength_of_schedule,
              updated_at = CURRENT_TIMESTAMP
          `, [
            team['Team Name'],
            parseFloat(team['Power Rating']) || 0,
            parseFloat(team['Offense Rating']) || 0,
            parseFloat(team['Defense Rating']) || 0,
            parseFloat(team['Strength of Schedule']) || 0
          ]);
          successCount++;
        } catch (err) {
          console.error(`❌ Error inserting ${team['Team Name']}:`, err.message);
          errorCount++;
        }
      }
    }
    
    console.log(`✅ Import complete: ${successCount} teams imported, ${errorCount} errors`);
    
    // Show sample of imported data
    const sample = await pool.query(`
      SELECT team_name, power_rating, offense_rating, defense_rating 
      FROM team_power_ratings 
      ORDER BY power_rating DESC 
      LIMIT 5
    `);
    
    console.log('\n🏆 Top 5 teams:');
    sample.rows.forEach((team, i) => {
      console.log(`${i + 1}. ${team.team_name}: ${team.power_rating}`);
    });
    
  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    await pool.end();
  }
}

// Check if CSV file path was provided
const csvFilePath = process.argv[2];
if (!csvFilePath) {
  console.log('Usage: node import-ratings.js path/to/your/ratings.csv');
  console.log('Example: node import-ratings.js ../cfb-site/public/ratings.csv');
  process.exit(1);
}

importRatings(csvFilePath);