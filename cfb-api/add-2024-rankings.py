#!/usr/bin/env python3
"""
Final fix - Clean import of 2024 data using UPSERT
"""

import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clean_import_2024():
    """Clean import of 2024 data using ON CONFLICT"""
    
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
        
        logger.info("🧹 CLEAN IMPORT OF 2024 DATA")
        logger.info("=" * 40)
        
        # 1. Check current state
        cursor.execute("SELECT season, COUNT(*) FROM team_power_ratings GROUP BY season ORDER BY season")
        current_data = cursor.fetchall()
        logger.info("Current data:")
        for row in current_data:
            logger.info(f"  Season {row['season']}: {row['count']} teams")
        
        # 2. Read CSV data
        csv_file = '2024FinalRankings.csv'
        teams_to_import = []
        
        with open(csv_file, 'r', encoding='utf-8') as file:
            lines = file.readlines()
            
        for line in lines[1:]:  # Skip header
            line = line.strip().replace('\r', '')
            if not line:
                continue
                
            parts = line.split(',')
            if len(parts) >= 2:
                team_name = parts[0].strip()
                try:
                    overall = float(parts[1].strip())
                    offense = float(parts[2].strip()) if len(parts) > 2 and parts[2].strip() else 0.0
                    defense = float(parts[3].strip()) if len(parts) > 3 and parts[3].strip() else 0.0
                    
                    teams_to_import.append({
                        'team_name': team_name,
                        'power_rating': overall,
                        'offense_rating': offense,
                        'defense_rating': defense,
                        'strength_of_schedule': 50.0,
                        'season': 2024
                    })
                except ValueError:
                    logger.warning(f"Skipping invalid line: {line}")
        
        logger.info(f"📊 Loaded {len(teams_to_import)} teams from CSV")
        
        # 3. Import using ON CONFLICT DO UPDATE (UPSERT)
        logger.info("🚀 Starting clean import with UPSERT...")
        
        success_count = 0
        for team in teams_to_import:
            try:
                cursor.execute("""
                    INSERT INTO team_power_ratings 
                    (team_name, power_rating, offense_rating, defense_rating, strength_of_schedule, season)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (team_name, season) 
                    DO UPDATE SET
                        power_rating = EXCLUDED.power_rating,
                        offense_rating = EXCLUDED.offense_rating,
                        defense_rating = EXCLUDED.defense_rating,
                        strength_of_schedule = EXCLUDED.strength_of_schedule
                """, (
                    team['team_name'],
                    team['power_rating'],
                    team['offense_rating'],
                    team['defense_rating'],
                    team['strength_of_schedule'],
                    team['season']
                ))
                success_count += 1
                
                if success_count % 50 == 0:
                    logger.info(f"Processed {success_count} teams...")
                    
            except Exception as e:
                logger.error(f"Error with {team['team_name']}: {e}")
        
        # 4. Commit all changes
        conn.commit()
        logger.info(f"✅ Successfully processed {success_count} teams!")
        
        # 5. Verify final state
        cursor.execute("SELECT season, COUNT(*) FROM team_power_ratings GROUP BY season ORDER BY season")
        final_data = cursor.fetchall()
        logger.info("Final data:")
        for row in final_data:
            logger.info(f"  Season {row['season']}: {row['count']} teams")
        
        # 6. Show sample 2024 data
        cursor.execute("""
            SELECT team_name, power_rating, offense_rating, defense_rating 
            FROM team_power_ratings 
            WHERE season = 2024 
            ORDER BY power_rating DESC 
            LIMIT 10
        """)
        sample_2024 = cursor.fetchall()
        logger.info("Top 10 teams from 2024:")
        for team in sample_2024:
            logger.info(f"  {team['team_name']}: {team['power_rating']} (O: {team['offense_rating']}, D: {team['defense_rating']})")
        
        # 7. Check specific teams
        cursor.execute("""
            SELECT team_name, power_rating, season 
            FROM team_power_ratings 
            WHERE LOWER(team_name) LIKE '%ohio%state%'
            ORDER BY season
        """)
        ohio_state = cursor.fetchall()
        logger.info("Ohio State data:")
        for team in ohio_state:
            logger.info(f"  {team['season']}: {team['power_rating']}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
        if conn:
            conn.rollback()
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    clean_import_2024()