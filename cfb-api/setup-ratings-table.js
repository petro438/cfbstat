const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function createRatingsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS team_power_ratings (
        id SERIAL PRIMARY KEY,
        team_name VARCHAR(100) NOT NULL,
        power_rating NUMERIC(8,4),
        offense_rating NUMERIC(8,4),
        defense_rating NUMERIC(8,4),
        strength_of_schedule NUMERIC(8,4),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(team_name)
      );
    `);
    
    console.log('✅ team_power_ratings table created successfully');
    
    // Create index for faster lookups
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_team_power_ratings_team_name 
      ON team_power_ratings(team_name);
    `);
    
    console.log('✅ Index created');
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error creating table:', err);
  }
}

createRatingsTable();