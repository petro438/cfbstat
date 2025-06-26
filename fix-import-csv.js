// fixed-import-csv.js
const { Pool } = require('pg');
const fs = require('fs');
const { parse } = require('csv-parse');

// Update these with your actual database credentials from server.js
const pool = new Pool({
  user: 'your_username',
  host: 'localhost',
  database: 'your_database_name', 
  password: 'your_password',
  port: 5432,
});

async function importCSV() {
  let client;
  
  try {
    console.log('🚀 Starting CSV import...');
    
    // Get a client from the pool
    client = await pool.connect();
    
    // Drop and recreate teams table
    console.log('📋 Recreating teams table...');
    await client.query('DROP TABLE IF EXISTS teams CASCADE');
    
    const createQuery = `
      CREATE TABLE teams (
        id SERIAL PRIMARY KEY,
        school VARCHAR(255),
        mascot VARCHAR(255),
        abbreviation VARCHAR(10),
        conference VARCHAR(255),
        division VARCHAR(255),
        classification VARCHAR(50),
        color VARCHAR(50),
        alternate_color VARCHAR(50),
        logo_1 VARCHAR(500),
        logo_2 VARCHAR(500),
        twitter VARCHAR(255),
        location_city VARCHAR(255),
        location_state VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await client.query(createQuery);
    console.log('✅ Table created successfully');

    // Read and parse CSV synchronously
    console.log('📖 Reading CSV file...');
    const csvContent = fs.readFileSync('./cfbnames.csv', 'utf8');
    
    // Parse CSV
    const records = await new Promise((resolve, reject) => {
      parse(csvContent, {
        headers: true,
        skip_empty_lines: true
      }, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });
    
    console.log(`📊 Found ${records.length} teams in CSV`);
    console.log('💾 Inserting data into database...');
    
    // Insert data one by one
    let inserted = 0;
    for (const row of records) {
      try {
        await client.query(`
          INSERT INTO teams (
            school, mascot, abbreviation, conference, division, 
            classification, color, alternate_color, logo_1, logo_2, 
            twitter, location_city, location_state
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [
          row.School || null,
          row.Mascot || null,
          row.Abbreviation || null,
          row.Conference || null,
          row.Division || null,
          row.Classification || null,
          row.Color || null,
          row.AlternateColor || null,
          row['Logos[0]'] || null,
          row['Logos[1]'] || null,
          row.Twitter || null,
          row['Location City'] || null,
          row['Location State'] || null
        ]);
        
        inserted++;
        
        if (inserted % 50 === 0) {
          console.log(`   Inserted ${inserted}/${records.length} teams...`);
        }
      } catch (insertErr) {
        console.error(`Error inserting team ${row.School}:`, insertErr.message);
      }
    }
    
    console.log(`✅ Successfully imported ${inserted} teams!`);
    
    // Show some stats
    console.log('\n📊 IMPORT SUMMARY:');
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total_teams,
        COUNT(CASE WHEN classification = 'fbs' THEN 1 END) as fbs_teams,
        COUNT(CASE WHEN logo_1 IS NOT NULL THEN 1 END) as teams_with_logos,
        COUNT(CASE WHEN conference IS NOT NULL THEN 1 END) as teams_with_conference
      FROM teams
    `);
    console.table(stats.rows[0]);
    
    // Show sample teams
    console.log('\n🏈 SAMPLE TEAMS:');
    const sampleTeams = await client.query(`
      SELECT school, mascot, conference, classification, logo_1
      FROM teams 
      WHERE classification = 'fbs'
      ORDER BY school
      LIMIT 5
    `);
    console.table(sampleTeams.rows);
    
  } catch (err) {
    console.error('❌ Error importing CSV:', err.message);
  } finally {
    // Release the client back to the pool
    if (client) {
      client.release();
    }
    // End the pool
    await pool.end();
    console.log('\n🏁 Import complete!');
  }
}

// Run the import
importCSV().catch(console.error);