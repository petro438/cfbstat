const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database_name',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log('Connected to PostgreSQL database');
    release();
  }
});

// API Routes

// Get all teams with basic info
app.get('/api/teams', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        school as team_name,
        mascot,
        abbreviation,
        conference,
        division,
        classification,
        color,
        alternate_color
      FROM teams 
      WHERE classification = 'fbs'
      ORDER BY school
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get team rankings (you'll replace this with your ratings CSV logic)
app.get('/api/rankings', async (req, res) => {
  try {
    // For now, we'll create a basic ranking based on SP+ ratings
    const result = await pool.query(`
      SELECT 
        t.school as team_name,
        t.conference,
        sp.rating as power_rating,
        sp.offense_rating,
        sp.defense_rating,
        0 as strength_of_schedule,  -- You'll add this column
        RANK() OVER (ORDER BY sp.rating DESC) as power_rank
      FROM teams t
      LEFT JOIN team_sp sp ON t.school = sp.team AND sp.year = 2024
      WHERE t.classification = 'fbs'
      ORDER BY sp.rating DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching rankings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get advanced team stats
app.get('/api/teams/:teamName/stats', async (req, res) => {
  try {
    const { teamName } = req.params;
    
    const result = await pool.query(`
      SELECT 
        season,
        team,
        conference,
        offense_passing_plays_ppa,
        offense_rushing_plays_ppa,
        defense_passing_plays_ppa,
        defense_rushing_plays_ppa,
        offense_success_rate,
        defense_success_rate,
        offense_explosiveness,
        defense_explosiveness
      FROM advanced_season_stats 
      WHERE team = $1 
      ORDER BY season DESC
      LIMIT 1
    `, [teamName]);
    
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Error fetching team stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get games for a team
app.get('/api/teams/:teamName/games', async (req, res) => {
  try {
    const { teamName } = req.params;
    const { season = 2024 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        g.id,
        g.season,
        g.week,
        g.start_date,
        g.home_team,
        g.away_team,
        g.home_points,
        g.away_points,
        g.completed,
        CASE 
          WHEN g.home_team = $1 THEN g.away_team
          ELSE g.home_team
        END as opponent,
        CASE 
          WHEN g.home_team = $1 THEN 'home'
          ELSE 'away'
        END as home_away
      FROM games g
      WHERE (g.home_team = $1 OR g.away_team = $1) 
        AND g.season = $2
      ORDER BY g.week
    `, [teamName, season]);
    
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching team games:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'CFB API is running' });
});

app.listen(port, () => {
  console.log(`CFB API server running on port ${port}`);
}); 