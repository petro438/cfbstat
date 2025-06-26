CFB Analytics Site 🏈
A comprehensive college football analytics platform similar to KenPom for basketball, featuring advanced statistics, interactive dashboards, and data visualization for fans and bettors.
🌟 Features
Current Dashboards

Team Power Rankings - Overall team strength with 20-color percentile system
Luck Leaderboard - Expected wins vs actual wins, turnover margins, close game performance
Passing Stats Dashboard - Comprehensive passing analytics with offense/defense views

Basic & Advanced modes
Season totals vs per-game averages
FBS teams only with proper defensive perspective



Design System

DataGolf-inspired clean, professional aesthetic
Mobile-first responsive design
20-color percentile system for instant performance visualization
Typography: Consolas for numbers, Trebuchet MS for interface
Information density - maximum data per screen

🛠️ Tech Stack

Frontend: React 18.3.1 with React Router 6.26.1
Backend: Node.js/Express with CORS
Database: PostgreSQL (ScheduleDB)
Development: Local environment (ports 3000 + 5000)

📁 Project Structure
cfb-site/ (React frontend - port 3000)
├── src/
│   ├── App.js (main routing)
│   ├── HomePage.js (team rankings)
│   ├── LuckLeaderboard.js (luck/turnover stats)
│   ├── PassingStatsPage.js (passing analytics)
│   └── index.js
├── public/
└── package.json

cfb-api/ (Node.js API - port 5000)  
├── server.js (complete API endpoints)
├── dataconfig.env (database credentials)
├── simple-import.js (team import script)
└── package.json
🚀 Quick Start
Prerequisites

Node.js 16+
PostgreSQL database
College Football Data API key

Installation

Clone the repository

bashgit clone <your-repo-url>
cd cfb-analytics

Install dependencies

bash# Install API dependencies
cd cfb-api
npm install

# Install frontend dependencies
cd ../cfb-site
npm install

Setup database

bash# Create PostgreSQL database named 'ScheduleDB'
# Import teams data using simple-import.js
cd cfb-api
node simple-import.js

Configure environment
Create cfb-api/dataconfig.env:

envCFB_API_KEY=your_college_football_data_api_key
DB_HOST=localhost
DB_NAME=ScheduleDB
DB_DATABASE=ScheduleDB
DB_USER=postgres
DB_PASSWORD=your_password
DB_PORT=5432

Start development servers

bash# Terminal 1 - API Server
cd cfb-api
npm start

# Terminal 2 - React App  
cd cfb-site
npm start
Visit http://localhost:3000 to see the app!
📊 API Endpoints
Main Endpoints

GET /api/power-rankings - Team rankings with logos/conferences
GET /api/leaderboards/luck/:season - Luck/turnover statistics
GET /api/leaderboards/passing/:season - Passing statistics dashboard
GET /api/teams/:teamName - Individual team info
GET /api/teams/:teamName/stats?season=2025 - Team season stats
GET /api/teams/:teamName/games?season=2025 - Team schedule/results

Query Parameters

conference_only=true - Filter to conference games only
regular_season_only=true - Exclude postseason games
conference=SEC - Filter by specific conference
side=offense|defense - Offensive or defensive perspective
per_game=true - Show per-game averages instead of totals

🎨 Design System
Color Palette
20-Color Percentile System (Green = Elite, Red = Terrible):

96-100th: #58c36c Elite
91-95th: #6aca7c Excellent
81-85th: #8dd69b Good
61-65th: #d4f0d9 Okay
41-45th: #fbe1df Bad
21-25th: #f2928a Terrible
1-5th: #ea4335 Worst

Typography

Data/Numbers: Consolas (monospace)
Interface/Text: Trebuchet MS
Team Names: UPPERCASE in tables

Responsive Design

Mobile-first approach
Touch-friendly interface (44px minimum targets)
Horizontal scrolling for wide data tables
Abbreviated headers on mobile

📱 Page Types
Implemented

✅ Team Rankings & Stat Dashboards - All FBS teams with sortable stats
✅ Luck Leaderboard - Expected vs actual performance metrics
✅ Passing Stats Dashboard - Offense/defense with basic/advanced modes

Planned

🔄 Team Pages - Individual team deep dives
📋 Coach Profile Pages - Coaching history and stats
📋 Player Profile Pages - Player stats and recruiting info
📋 Game Pages - Pre-game analysis and post-game results
📋 Schedule Grid - Season-wide game visualization

🗄️ Database Schema
Key Tables

teams - Complete team info (863 teams: FBS, FCS, D2, D3)
team_power_ratings - Main rankings data
game_team_stats_new - Detailed game-by-game team statistics
games - Game schedules and results

Data Sources

Teams: College Football Data API
Stats: Game-by-game statistical data
Logos: ESPN CDN via College Football Data API

🚀 Deployment
Railway Deployment

Push code to GitHub
Connect Railway to your repository
Add PostgreSQL service
Set environment variables
Import data to production database

Environment Variables (Production)
envDATABASE_URL=postgresql://user:password@host:port/database
CFB_API_KEY=your_api_key
NODE_ENV=production
🧪 Testing
API Health Check
bashcurl http://localhost:5000/api/health
Debug Endpoints

GET /api/debug-teams - Database stats and sample teams
GET /api/data-stats - Coverage between teams and power ratings
GET /api/missing-data - Teams with missing data

📈 Performance Features

Client-side filtering for instant response
Efficient database queries with proper indexing
Responsive images with optimized team logos
Minimal API calls with comprehensive data loading

🤝 Contributing

Fork the repository
Create a feature branch (git checkout -b feature/new-dashboard)
Commit your changes (git commit -am 'Add new dashboard')
Push to the branch (git push origin feature/new-dashboard)
Create a Pull Request

📄 License
This project is licensed under the MIT License - see the LICENSE file for details.
🏆 Inspiration
Built with inspiration from:

KenPom (kenpom.com) - College basketball analytics
BartTorvik (barttorvik.com) - Advanced basketball metrics
DataGolf (datagolf.com) - Clean, data-focused design

📞 Support
For issues and questions:

Check existing GitHub issues
Create a new issue with detailed description
Include browser/environment information for bugs

