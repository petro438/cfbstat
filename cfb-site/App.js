import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './HomePage';
import TeamPage from './TeamPage';
import SOSLeaderboard from './SOSLeaderboard';
import LuckLeaderboard from './LuckLeaderboard';
import PassingStatsPage from './PassingStatsPage';

function App() {
  return (
    <Router>
      <div style={{ 
        fontFamily: 'Trebuchet MS, sans-serif',
        backgroundColor: '#ffffff',
        minHeight: '100vh'
      }}>
        {/* Navigation Header */}
        <nav style={{
          backgroundColor: '#f8f9fa',
          borderBottom: '1px solid #dee2e6',
          padding: '8px 16px',
          marginBottom: '0'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            <Link 
              to="/" 
              style={{
                fontSize: '20px',
                fontWeight: 'bold',
                color: '#212529',
                textDecoration: 'none',
                textTransform: 'uppercase'
              }}
            >
              CFB ANALYTICS
            </Link>
            
            <div style={{
              display: 'flex',
              gap: '16px',
              alignItems: 'center'
            }}>
              <Link
                to="/"
                style={{
                  color: '#007bff',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}
              >
                TEAM RANKINGS
              </Link>
              <Link
                to="/leaderboards/strength-of-schedule"
                style={{
                  color: '#007bff',
                  textDecoration: 'none',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}
              >
                STRENGTH OF SCHEDULE
              </Link>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/team/:teamName" element={<TeamPage />} />
          <Route path="/leaderboards/strength-of-schedule" element={<SOSLeaderboard />} />
          <Route path="/luck" element={<LuckLeaderboard />} />
          <Route path="/stats/passing" element={<PassingStatsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;