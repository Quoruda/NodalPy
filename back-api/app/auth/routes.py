from datetime import timedelta
import re
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.models.user import User
from app.models.schemas import Token, UserCreate
from app.auth.security import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/register", response_model=Token)
async def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(status_code=400, detail="Username already registered")
        
    pwd = user_in.password
    if len(pwd) < 8 or not re.search(r"[A-Z]", pwd) or not re.search(r"[a-z]", pwd) or not re.search(r"\d", pwd) or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", pwd):
        raise HTTPException(status_code=400, detail="Password does not meet strength requirements")
        
    hashed_password = get_password_hash(pwd)
    new_user = User(username=user_in.username, password_hash=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": new_user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "username": current_user.username}
