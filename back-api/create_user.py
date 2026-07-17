import argparse
import sys
import os

# Add the app directory to sys.path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.models.user import User
import bcrypt

# Create tables
Base.metadata.create_all(bind=engine)

def get_password_hash(password):
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def main():
    parser = argparse.ArgumentParser(description="Create a new user in the database.")
    parser.add_argument("username", type=str, help="The username for the new account")
    parser.add_argument("password", type=str, help="The password for the new account")
    
    args = parser.parse_args()
    
    db = SessionLocal()
    try:
        # Check if user already exists
        user = db.query(User).filter(User.username == args.username).first()
        if user:
            print(f"Error: User '{args.username}' already exists.")
            sys.exit(1)
        
        # Create new user
        hashed_password = get_password_hash(args.password)
        new_user = User(username=args.username, password_hash=hashed_password)
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        print(f"Success: User '{args.username}' created with ID {new_user.id}.")
    finally:
        db.close()

if __name__ == "__main__":
    main()
