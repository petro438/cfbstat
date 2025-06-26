#!/usr/bin/env python3
"""
Find and sync missing specific games like Miami vs Florida A&M
This script will identify missing games and fetch their drives
"""

import requests
import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_missing_games():
    """Find games that exist in the games table but are missing from drives table"""
    
    load_dotenv('dataconfig.env')
    
    DB_CONFIG = {
        'host': os.getenv('DB_HOST', 'localhost'),
        'database': os.getenv('DB_DATABASE'),
        'user': os.getenv('DB_USER'),
        'password': os.getenv('DB_PASSWORD'),
        'port': int(os.getenv('DB_PORT', 5432))
    }
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        
        # Find games that exist but have no drives data
        cursor.execute("""
            SELECT 
                g.id as game_id,
                g.season,
                g.week,
                g.season_type,
                g.home_team,
                g.away_team,
                COUNT(d.id) as drive_count
            FROM games g
            LEFT JOIN drives d ON g.id = d.game_id
            WHERE g.season = 2024
            GROUP BY g.id, g.season, g.week, g.season_type, g.home_team, g.away_team
            HAVING COUNT(d.id) = 0
            ORDER BY g.week, g.home_team
        """)
        
        missing_games = cursor.fetchall()
        
        logger.info(f"🔍 Found {len(missing_games)} games missing drives data:")
        
        for game in missing_games[:20]:  # Show first 20
            logger.info(f"  Week {game['week']}: {game['away_team']} @ {game['home_team']} (Game ID: {game['game_id']})")
        
        if len(missing_games) > 20:
            logger.info(f"  ... and {len(missing_games) - 20} more games")
        
        return missing_games
        
    except Exception as e:
        logger.error(f"Database error: {e}")
        return []
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def sync_specific_weeks_with_missing_games(missing_games):
    """Sync specific weeks that have missing games"""
    
    if not missing_games:
        logger.info("No missing games found!")
        return
    
    # Get unique weeks that have missing games
    missing_weeks = set()
    for game in missing_games:
        missing_weeks.add((game['week'], game['season_type']))
    
    logger.info(f"🎯 Need to re-sync {len(missing_weeks)} weeks with missing games:")
    for week, season_type in sorted(missing_weeks):
        logger.info(f"  Week {week} ({season_type})")
    
    # Ask user if they want to proceed
    response = input(f"\nRe-sync these {len(missing_weeks)} weeks? (y/n): ").lower().strip()
    if response not in ['y', 'yes']:
        logger.info("Cancelled by user")
        return
    
    # Re-sync each week with missing games
    for week, season_type in sorted(missing_weeks):
        logger.info(f"\n{'='*50}")
        logger.info(f"Re-syncing {season_type} week {week}")
        logger.info(f"{'='*50}")
        
        # Set environment variables and run the script for this specific week
        os.environ['SKIP_EXISTING'] = 'false'
        os.environ['START_WEEK'] = str(week)
        os.environ['END_WEEK'] = str(week)
        os.environ['DRIVES_SYNC_MODE'] = f'{season_type}_only'
        
        # Import and run the fetcher for this week
        try:
            from fixed_drives_fetcher import CFBDrivesFetcher
            
            API_KEY = os.getenv('CFB_API_KEY')
            DB_CONFIG = {
                'host': os.getenv('DB_HOST', 'localhost'),
                'database': os.getenv('DB_DATABASE'),
                'user': os.getenv('DB_USER'),
                'password': os.getenv('DB_PASSWORD'),
                'port': int(os.getenv('DB_PORT', 5432))
            }
            
            fetcher = CFBDrivesFetcher(API_KEY, DB_CONFIG)
            
            # Sync just this week
            fetcher.sync_drives_season(
                year=2024,
                season_types=[season_type],
                start_week=week,
                end_week=week,
                skip_existing=False,  # Force re-sync
                delay_seconds=1.5
            )
            
        except Exception as e:
            logger.error(f"Error syncing week {week}: {e}")
            continue

def main():
    """Main function"""
    
    logger.info("🔍 FINDING MISSING GAMES...")
    
    # Find games missing drives data
    missing_games = find_missing_games()
    
    if missing_games:
        logger.info(f"\n📋 SUMMARY:")
        logger.info(f"Total games missing drives: {len(missing_games)}")
        
        # Show some examples of missing matchups
        logger.info(f"\n🏈 Examples of missing games:")
        for game in missing_games[:10]:
            logger.info(f"  {game['away_team']} @ {game['home_team']} (Week {game['week']})")
        
        # Offer to sync the missing weeks
        sync_specific_weeks_with_missing_games(missing_games)
    else:
        logger.info("✅ No missing games found! Your drives data appears complete.")

if __name__ == "__main__":
    main()