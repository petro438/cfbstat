// simple-import.js
// Simple, reliable team import script

const { Pool } = require('pg');
const https = require('https');
require('dotenv').config({ path: './dataconfig.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function fetchTeams() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.collegefootballdata.com',
      path: '/teams',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.CFB_API_KEY}`,
        'accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function importTeams() {
  try {
    console.log('🚀 Simple team import starting...');
    
    // Test database connection first
    console.log('🔍 Testing database connection...');
    const testResult = await pool.query('SELECT current_database(), current_user');
    console.log(`✅ Connected to: ${testResult.rows[0].current_database} as ${testResult.rows[0].current_user}`);
    
    // Fetch teams
    console.log('📡 Fetching teams from API...');
    const teams = await fetchTeams();
    console.log(`📊 Found ${teams.length} teams`);
    
    // Show breakdown by classification
    const classifications = {};
    teams.forEach(team => {
      const classification = team.classification || 'unknown';
      classifications[classification] = (classifications[classification] || 0) + 1;
    });
    
    console.log('\n📊 Teams by classification:');
    console.table(classifications);
    
    // Show sample team
    console.log('\n📋 Sample team:');
    console.log(JSON.stringify(teams[0], null, 2));
    
    // Create table with UPSERT capability (no duplicates)
    console.log('\n🔄 Creating teams table with duplicate prevention...');
    await pool.query('DROP TABLE IF EXISTS teams CASCADE');
    
    await pool.query(`
      CREATE TABLE teams (
        id SERIAL PRIMARY KEY,
        api_id INTEGER UNIQUE NOT NULL,
        school VARCHAR(255) NOT NULL,
        mascot VARCHAR(255),
        abbreviation VARCHAR(20),
        conference VARCHAR(255),
        division VARCHAR(100),
        classification VARCHAR(50),
        color VARCHAR(20),
        alt_color VARCHAR(20),
        logo_url VARCHAR(500),
        twitter VARCHAR(100),
        location_city VARCHAR(255),
        location_state VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Table created successfully');
    
    // Insert ALL teams with UPSERT (prevents duplicates)
    console.log('\n💾 Inserting ALL teams (with duplicate prevention)...');
    let inserted = 0;
    let updated = 0;
    
    for (const team of teams) {
      try {
        const logoUrl = (team.logos && team.logos.length > 0) ? team.logos[0] : null;
        
        const result = await pool.query(`
          INSERT INTO teams (
            api_id, school, mascot, abbreviation, conference, division, 
            classification, color, alt_color, logo_url, twitter, 
            location_city, location_state
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (api_id) 
          DO UPDATE SET
            school = EXCLUDED.school,
            mascot = EXCLUDED.mascot,
            abbreviation = EXCLUDED.abbreviation,
            conference = EXCLUDED.conference,
            division = EXCLUDED.division,
            classification = EXCLUDED.classification,
            color = EXCLUDED.color,
            alt_color = EXCLUDED.alt_color,
            logo_url = EXCLUDED.logo_url,
            twitter = EXCLUDED.twitter,
            location_city = EXCLUDED.location_city,
            location_state = EXCLUDED.location_state,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) AS inserted
        `, [
          team.id,
          team.school,
          team.mascot,
          team.abbreviation,
          team.conference,
          team.division,
          team.classification,
          team.color,
          team.alt_color,
          logoUrl,
          team.twitter,
          team.location?.city,
          team.location?.state
        ]);
        
        if (result.rows[0].inserted) {
          inserted++;
        } else {
          updated++;
        }
        
        if ((inserted + updated) % 50 === 0) {
          console.log(`   Processed ${inserted + updated}/${teams.length} teams (${inserted} new, ${updated} updated)...`);
        }
        
      } catch (err) {
        console.error(`❌ Error processing ${team.school}:`, err.message);
      }
    }
    
    console.log(`\n✅ Import complete! ${inserted} new teams inserted, ${updated} existing teams updated`);
    
    // Verify the insert worked
    console.log('\n🔍 Verifying import...');
    const countResult = await pool.query('SELECT COUNT(*) as count FROM teams');
    console.log(`✅ Total teams in database: ${countResult.rows[0].count}`);
    
    // Show breakdown by classification
    const classificationResult = await pool.query(`
      SELECT classification, COUNT(*) as count 
      FROM teams 
      GROUP BY classification 
      ORDER BY count DESC
    `);
    
    console.log('\n📊 Teams by classification in database:');
    console.table(classificationResult.rows);
    
    // Show sample teams from each major classification
    const sampleResult = await pool.query(`
      SELECT school, mascot, conference, classification, logo_url 
      FROM teams 
      WHERE classification IN ('fbs', 'fcs', 'ii', 'iii')
      ORDER BY classification, school 
      LIMIT 12
    `);
    
    console.log('\n🎯 Sample teams by classification:');
    console.table(sampleResult.rows);
    
    // Check Alabama specifically
    const alabamaResult = await pool.query(`
      SELECT * FROM teams WHERE school = 'Alabama'
    `);
    
    if (alabamaResult.rows.length > 0) {
      console.log('\n🏆 Alabama found:');
      console.table(alabamaResult.rows[0]);
    } else {
      console.log('\n❌ Alabama not found');
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
  } finally {
    await pool.end();
    console.log('\n🏁 Import complete!');
  }
}

importTeams();