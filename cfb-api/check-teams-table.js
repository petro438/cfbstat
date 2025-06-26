// check-teams-table.js
// Script to explore the teams table in your PostgreSQL database

const { Pool } = require('pg');

// Update these with your actual database credentials
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'ScheduleDB',
  password: 'lunch4kids',
  port: 5432,
});

async function checkTeamsTable() {
  try {
    console.log('🔍 Checking teams table structure and data...\n');

    // 1. Check table structure
    console.log('📋 TABLE STRUCTURE:');
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'teams'
      ORDER BY ordinal_position;
    `;
    const columns = await pool.query(columnsQuery);
    console.table(columns.rows);

    // 2. Count total teams
    const countQuery = 'SELECT COUNT(*) as total_teams FROM teams';
    const countResult = await pool.query(countQuery);
    console.log(`\n📊 Total teams in database: ${countResult.rows[0].total_teams}\n`);

    // 3. Sample of team data
    console.log('📝 SAMPLE TEAM DATA (first 10 rows):');
    const sampleQuery = 'SELECT * FROM teams LIMIT 10';
    const sampleResult = await pool.query(sampleQuery);
    console.table(sampleResult.rows);

    // 4. Check for logo columns
    console.log('\n🖼️ CHECKING FOR LOGO DATA:');
    const logoQuery = `
      SELECT 
        school,
        CASE 
          WHEN "Logos[0]" IS NOT NULL THEN "Logos[0]"
          WHEN logos IS NOT NULL THEN logos
          WHEN logo IS NOT NULL THEN logo
          ELSE 'No logo found'
        END as logo_url
      FROM teams 
      WHERE school IS NOT NULL
      LIMIT 5
    `;
    try {
      const logoResult = await pool.query(logoQuery);
      console.table(logoResult.rows);
    } catch (err) {
      console.log('Could not find standard logo columns. Let me check what columns contain "logo"...');
      
      const logoColumnsQuery = `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'teams' 
        AND column_name ILIKE '%logo%'
      `;
      const logoColumns = await pool.query(logoColumnsQuery);
      console.log('Logo-related columns:', logoColumns.rows);
    }

    // 5. Check conference coverage
    console.log('\n🏈 CONFERENCE COVERAGE:');
    const conferenceQuery = `
      SELECT 
        conference,
        COUNT(*) as team_count
      FROM teams 
      WHERE conference IS NOT NULL
      GROUP BY conference
      ORDER BY team_count DESC
    `;
    const conferences = await pool.query(conferenceQuery);
    console.table(conferences.rows);

    // 6. Check for teams without conference
    const noConferenceQuery = `
      SELECT COUNT(*) as teams_without_conference
      FROM teams 
      WHERE conference IS NULL OR conference = ''
    `;
    const noConference = await pool.query(noConferenceQuery);
    console.log(`\n⚠️  Teams without conference: ${noConference.rows[0].teams_without_conference}`);

    // 7. Sample teams without conference
    if (noConference.rows[0].teams_without_conference > 0) {
      console.log('\n📋 TEAMS WITHOUT CONFERENCE (first 10):');
      const missingConfQuery = `
        SELECT school, mascot, classification
        FROM teams 
        WHERE conference IS NULL OR conference = ''
        LIMIT 10
      `;
      const missingConf = await pool.query(missingConfQuery);
      console.table(missingConf.rows);
    }

    // 8. Check team name variations
    console.log('\n🔤 SAMPLE TEAM NAMES (for matching with power_ratings):');
    const namesQuery = `
      SELECT school, mascot, abbreviation
      FROM teams 
      WHERE school IS NOT NULL
      ORDER BY school
      LIMIT 15
    `;
    const names = await pool.query(namesQuery);
    console.table(names.rows);

    console.log('\n✅ Teams table analysis complete!');

  } catch (err) {
    console.error('❌ Error checking teams table:', err.message);
    console.error('Full error:', err);
  } finally {
    await pool.end();
  }
}

// Run the check
checkTeamsTable();