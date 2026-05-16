"""DriveAll Backend — FastAPI + MongoDB
REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
import os
import uuid
import random
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Cookie, Header
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv()

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="DriveAll API")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ---------- Models ----------
class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["rider", "driver"]] = None
    language: Optional[Literal["en", "ur"]] = None
    theme: Optional[Literal["light", "dark"]] = None
    village: Optional[str] = None
    city: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_plate: Optional[str] = None
    cnic: Optional[str] = None
    license_no: Optional[str] = None


class DriverStatus(BaseModel):
    is_online: bool
    lat: Optional[float] = None
    lng: Optional[float] = None


class RideCreate(BaseModel):
    pickup_lat: float
    pickup_lng: float
    pickup_label: str
    drop_lat: float
    drop_lng: float
    drop_label: str
    offer_price: float
    notes: Optional[str] = None


class CounterOffer(BaseModel):
    price: float


class ChatMessage(BaseModel):
    text: str


# ---------- Auth helpers ----------
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> dict:
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = sess.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------- Auth routes ----------
@api.get("/")
async def root():
    return {"app": "DriveAll", "status": "ok"}


@api.post("/auth/session")
async def auth_session(payload: dict, response: Response):
    """Exchange Emergent session_id for our session_token. Sets httpOnly cookie."""
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    async with httpx.AsyncClient(timeout=15) as hx:
        r = await hx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data.get("name", existing["name"]), "picture": data.get("picture")}},
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "role": None,
            "language": "en",
            "theme": "light",
            "rating": 5.0,
            "is_online": False,
            "earnings": 0.0,
            "created_at": datetime.now(timezone.utc),
        })

    session_token = data["session_token"]
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60,
    )
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"user": user, "session_token": session_token}


@api.get("/auth/me")
async def auth_me(request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    return user


@api.post("/auth/logout")
async def auth_logout(response: Response, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------- Profile ----------
@api.patch("/users/me")
async def update_profile(payload: ProfileUpdate, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    user = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return user


@api.post("/drivers/status")
async def driver_status(payload: DriverStatus, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    if user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver role required")
    updates = {"is_online": payload.is_online}
    if payload.lat is not None:
        updates["current_lat"] = payload.lat
    if payload.lng is not None:
        updates["current_lng"] = payload.lng
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return {"ok": True, **updates}


# ---------- Rides ----------
def _haversine(lat1, lng1, lat2, lng2):
    from math import radians, sin, cos, asin, sqrt
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * R * asin(sqrt(a))


@api.post("/rides")
async def create_ride(payload: RideCreate, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    if user.get("role") != "rider":
        raise HTTPException(status_code=403, detail="Rider role required")
    ride_id = f"ride_{uuid.uuid4().hex[:12]}"
    pin = str(random.randint(1000, 9999))
    distance_km = round(_haversine(payload.pickup_lat, payload.pickup_lng, payload.drop_lat, payload.drop_lng), 2)
    now = datetime.now(timezone.utc)
    doc = {
        "ride_id": ride_id,
        "rider_id": user["user_id"],
        "rider_name": user["name"],
        "rider_phone": user.get("phone"),
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "pickup": {"lat": payload.pickup_lat, "lng": payload.pickup_lng, "label": payload.pickup_label},
        "drop": {"lat": payload.drop_lat, "lng": payload.drop_lng, "label": payload.drop_label},
        "distance_km": distance_km,
        "offer_price": payload.offer_price,
        "current_price": payload.offer_price,
        "final_price": None,
        "last_offer_by": "rider",
        "rider_counters": 0,
        "driver_counters": 0,
        "offer_expires_at": now + timedelta(seconds=90),
        "status": "searching",
        "pin": pin,
        "pin_verified": False,
        "notes": payload.notes,
        "created_at": now,
        "updated_at": now,
    }
    await db.rides.insert_one(doc)
    out = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    return out


@api.get("/rides/me/history")
async def my_rides(request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    q = {"$or": [{"rider_id": user["user_id"]}, {"driver_id": user["user_id"]}]}
    rides = await db.rides.find(q, {"_id": 0}).sort("created_at", -1).to_list(100)
    return rides


@api.get("/rides/driver/requests")
async def driver_requests(request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    if user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Driver role required")
    q = {"status": {"$in": ["searching", "negotiating"]}, "driver_id": None}
    q2 = {"status": "negotiating", "driver_id": user["user_id"], "final_price": None}
    a = await db.rides.find(q, {"_id": 0}).sort("created_at", -1).to_list(50)
    b = await db.rides.find(q2, {"_id": 0}).to_list(50)
    seen = set()
    out = []
    for r in (b + a):
        if r["ride_id"] in seen:
            continue
        seen.add(r["ride_id"])
        out.append(r)
    return out


@api.get("/rides/{ride_id}")
async def get_ride(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] not in (ride["rider_id"], ride.get("driver_id")) and user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Forbidden")
    return ride


@api.post("/rides/{ride_id}/counter")
async def counter_offer(ride_id: str, payload: CounterOffer, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["status"] not in ("searching", "negotiating"):
        raise HTTPException(status_code=400, detail="Ride not negotiable")

    is_driver = user.get("role") == "driver"
    is_rider = user["user_id"] == ride["rider_id"]
    if not (is_driver or is_rider):
        raise HTTPException(status_code=403, detail="Forbidden")

    side = "driver" if is_driver else "rider"
    counters_field = f"{side}_counters"
    if ride[counters_field] >= 3:
        raise HTTPException(status_code=400, detail="Max counter offers reached")

    now = datetime.now(timezone.utc)
    updates = {
        "current_price": payload.price,
        "last_offer_by": side,
        counters_field: ride[counters_field] + 1,
        "status": "negotiating",
        "offer_expires_at": now + timedelta(seconds=90),
        "updated_at": now,
    }
    if is_driver and not ride.get("driver_id"):
        updates["driver_id"] = user["user_id"]
        updates["driver_name"] = user["name"]
        updates["driver_phone"] = user.get("phone")

    await db.rides.update_one({"ride_id": ride_id}, {"$set": updates})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/accept")
async def accept_offer(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["status"] not in ("searching", "negotiating"):
        raise HTTPException(status_code=400, detail="Ride not acceptable")

    is_driver = user.get("role") == "driver"
    is_rider = user["user_id"] == ride["rider_id"]

    if is_driver:
        if ride["last_offer_by"] == "driver":
            raise HTTPException(status_code=400, detail="Cannot accept your own offer")
    elif is_rider:
        if ride["last_offer_by"] == "rider":
            raise HTTPException(status_code=400, detail="Cannot accept your own offer")
    else:
        raise HTTPException(status_code=403, detail="Forbidden")

    updates = {
        "status": "accepted",
        "final_price": ride["current_price"],
        "accepted_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    if is_driver and not ride.get("driver_id"):
        updates["driver_id"] = user["user_id"]
        updates["driver_name"] = user["name"]
        updates["driver_phone"] = user.get("phone")

    await db.rides.update_one({"ride_id": ride_id}, {"$set": updates})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/reject")
async def reject_offer(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if ride["status"] not in ("searching", "negotiating"):
        raise HTTPException(status_code=400, detail="Ride not active")
    is_rider = user["user_id"] == ride["rider_id"]
    is_assigned_driver = user["user_id"] == ride.get("driver_id")
    if not (is_rider or is_assigned_driver or user.get("role") == "driver"):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "cancelled", "updated_at": datetime.now(timezone.utc)}})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/start")
async def start_ride(ride_id: str, payload: dict, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Only assigned driver can start")
    if ride["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Ride not in accepted state")
    pin = str(payload.get("pin", "")).strip()
    if pin != ride["pin"]:
        raise HTTPException(status_code=400, detail="Invalid PIN")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "in_progress", "pin_verified": True, "started_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Only driver can complete")
    if ride["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Ride not in progress")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    await db.users.update_one({"user_id": ride["driver_id"]}, {"$inc": {"earnings": ride["final_price"] or 0}})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/sos")
async def trigger_sos(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] not in (ride["rider_id"], ride.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    await db.sos_alerts.insert_one({
        "alert_id": f"sos_{uuid.uuid4().hex[:10]}",
        "ride_id": ride_id,
        "user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc),
    })
    return {"ok": True, "message": "SOS alert recorded. Emergency contact notified."}


# ---------- Chat ----------
@api.get("/rides/{ride_id}/chat")
async def get_chat(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] not in (ride["rider_id"], ride.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    if ride["status"] not in ("accepted", "in_progress", "completed"):
        raise HTTPException(status_code=400, detail="Chat unlocks after ride confirmation")
    msgs = await db.chats.find({"ride_id": ride_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


@api.post("/rides/{ride_id}/chat")
async def send_chat(ride_id: str, payload: ChatMessage, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] not in (ride["rider_id"], ride.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    if ride["status"] not in ("accepted", "in_progress"):
        raise HTTPException(status_code=400, detail="Chat is closed")
    doc = {
        "message_id": f"msg_{uuid.uuid4().hex[:10]}",
        "ride_id": ride_id,
        "sender_id": user["user_id"],
        "sender_name": user["name"],
        "text": payload.text,
        "created_at": datetime.now(timezone.utc),
    }
    await db.chats.insert_one(doc)
    out = await db.chats.find_one({"message_id": doc["message_id"]}, {"_id": 0})
    return out


@api.post("/rides/{ride_id}/driver-location")
async def update_driver_location(ride_id: str, payload: dict, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Forbidden")
    lat = float(payload["lat"])
    lng = float(payload["lng"])
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"driver_location": {"lat": lat, "lng": lng}, "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True}


app.include_router(api)


@app.on_event("startup")
async def expire_offers_loop():
    async def loop():
        while True:
            try:
                now = datetime.now(timezone.utc)
                await db.rides.update_many(
                    {"status": {"$in": ["searching", "negotiating"]}, "offer_expires_at": {"$lt": now}},
                    {"$set": {"status": "expired", "updated_at": now}},
                )
            except Exception as e:
                print("expire loop err:", e)
            await asyncio.sleep(15)
    asyncio.create_task(loop())
