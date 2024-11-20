import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

class DB:
    def __init__(self):
        self.db = psycopg2.connect(
            database = os.getenv("DB_NAME"),
            host = os.getenv("DB_HOST"),
            user = os.getenv("DB_USER"),
            password = os.getenv("DB_PASSWORD"),
            port = os.getenv("DB_PORT")
        )
        print("Connected to the database")
        self.cursor = self.db.cursor()
        self.create_table()

    def create_table(self):
        query = """CREATE TABLE IF NOT EXISTS stats (
            id SERIAL PRIMARY KEY,
            first_user_name VARCHAR(255),
            second_user_name VARCHAR(255),
            first_wins INTEGER NOT NULL,
            second_wins INTEGER NOT NULL,
            draws INTEGER NOT NULL
        );"""
        callback = lambda: self.cursor.execute(query)
        self.execute(callback)
    
    def execute(self, callback):
        try:
            callback()
            self.db.commit()
        except (Exception, psycopg2.DatabaseError) as error:
            print(f"Error: {error}")
    
    def add_game_stats(self, first_user_name, second_user_name, first_wins, second_wins, draws):
        query = """
            INSERT INTO stats (first_user_name, second_user_name, first_wins, second_wins, draws)
            VALUES (%s, %s, %s, %s, %s)
        ;"""
        if first_wins >= second_wins:  
            callback = lambda: self.cursor.execute(query, (first_user_name, second_user_name, first_wins, second_wins, draws))
        else:
            callback = lambda: self.cursor.execute(query, (second_user_name, first_user_name, second_wins, first_wins, draws))
        self.execute(callback)

    def get_leaderboard(self):
        query = """
            SELECT *
            FROM stats
            ORDER BY first_wins DESC
            LIMIT 10;
        ;"""
        callback = lambda: self.cursor.execute(query)
        self.execute(callback)

        columns = list(self.cursor.description)
        result = self.cursor.fetchall()
        results = [] # make array of dictionaries from result which is list of tuples
        for row in result:
            row_dict = {}
            for i, col in enumerate(columns):
                row_dict[col.name] = row[i]
            results.append(row_dict)
        return results
    
    def __del__(self):
        self.cursor.close()
        self.db.close()