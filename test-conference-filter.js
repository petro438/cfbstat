// test-conference-filter.js
const fetch = require('node-fetch'); // You might need to install this

const testConferenceFilter = async () => {
  const baseUrl = 'http://localhost:5000';
  
  console.log('🏈 Testing Conference Games Filter...\n');
  
  try {
    // Test 1: Regular SOS data
    console.log('📊 Test 1: Regular SOS calculation');
    const regularResponse = await fetch(`${baseUrl}/api/leaderboards/strength-of-schedule-enhanced/2025`);
    const regularData = await regularResponse.json();
    
    console.log(`✅ Regular SOS: ${regularData.teams?.length || 0} teams found`);
    if (regularData.teams?.[0]) {
      console.log(`   Sample team: ${regularData.teams[0].team} - ${regularData.teams[0].total_games} total games`);
    }
    
    // Test 2: Conference games only
    console.log('\n📊 Test 2: Conference games only');
    const conferenceResponse = await fetch(`${baseUrl}/api/leaderboards/strength-of-schedule-enhanced/2025?conferenceOnly=true`);
    const conferenceData = await conferenceResponse.json();
    
    console.log(`✅ Conference Only: ${conferenceData.teams?.length || 0} teams found`);
    if (conferenceData.teams?.[0]) {
      console.log(`   Sample team: ${conferenceData.teams[0].team} - ${conferenceData.teams[0].total_games} conference games`);
      console.log(`   Conference games filter: ${conferenceData.metadata?.conference_games_only ? 'ACTIVE' : 'INACTIVE'}`);
    }
    
    console.log('\n🎉 Tests completed! Now update your server.js and React component.');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure your API server is running on port 5000');
  }
};

testConferenceFilter();