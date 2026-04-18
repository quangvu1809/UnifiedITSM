from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import bcrypt
import time
from config import get_settings

router = APIRouter()
security = HTTPBearer(auto_error=False)

SECRET_KEY = "greenai-incident-assistant-2026"
TOKEN_EXPIRY = 86400  # 24 hours

# Demo users (in production, use a real database)
USERS = {
    "admin": {
        "password": bcrypt.hashpw("admin123".encode(), bcrypt.gensalt()).decode(),
        "name": "Admin User",
        "role": "admin",
    },
    "analyst": {
        "password": bcrypt.hashpw("analyst123".encode(), bcrypt.gensalt()).decode(),
        "name": "IT Analyst",
        "role": "analyst",
    },
    "demo": {
        "password": bcrypt.hashpw("demo".encode(), bcrypt.gensalt()).decode(),
        "name": "Demo User",
        "role": "viewer",
    },
}


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str


def create_token(username: str, role: str, name: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "name": name,
        "exp": int(time.time()) + TOKEN_EXPIRY,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(401, "Token required")
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


@router.post("/api/auth/login")
async def login(req: LoginRequest):
    user = USERS.get(req.username)
    if not user or not bcrypt.checkpw(req.password.encode(), user["password"].encode()):
        raise HTTPException(401, "Sai username hoặc password")

    token = create_token(req.username, user["role"], user["name"])
    return {
        "token": token,
        "user": {"username": req.username, "name": user["name"], "role": user["role"]},
    }


@router.post("/api/auth/register")
async def register(req: RegisterRequest):
    if req.username in USERS:
        raise HTTPException(400, "Username đã tồn tại")
    if len(req.password) < 4:
        raise HTTPException(400, "Password phải ít nhất 4 ký tự")

    USERS[req.username] = {
        "password": bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode(),
        "name": req.name,
        "role": "analyst",
    }

    token = create_token(req.username, "analyst", req.name)
    return {
        "token": token,
        "user": {"username": req.username, "name": req.name, "role": "analyst"},
    }


@router.get("/api/auth/me")
async def get_me(user=Depends(verify_token)):
    return {"username": user["sub"], "name": user["name"], "role": user["role"]}
