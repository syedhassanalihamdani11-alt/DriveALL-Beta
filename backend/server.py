"""DriveAll Backend — FastAPI + MongoDB
REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
"""
import os
import uuid
import random
import asyncio
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

import bcrypt
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
class SavedLocation(BaseModel):
    label: str
    lat: float
    lng: float
    address: str


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[Literal["rider", "driver"]] = None
    language: Optional[Literal["en", "ur"]] = None
    theme: Optional[Literal["light", "dark"]] = None
    village: Optional[str] = None
    city: Optional[str] = None
    picture: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_plate: Optional[str] = None
    vehicle_type: Optional[Literal["bike", "car", "rickshaw", "parcel", "transport"]] = None
    cnic: Optional[str] = None
    license_no: Optional[str] = None
    saved_locations: Optional[list] = None  # list of SavedLocation dicts


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
    vehicle_type: Literal["bike", "car", "rickshaw", "parcel", "transport"] = "car"
    notes: Optional[str] = None


class CounterOffer(BaseModel):
    price: float


class ChatMessage(BaseModel):
    text: str


class DriverProgress(BaseModel):
    stage: Literal["en_route", "arrived"]


# ---------- Vehicle & Location config ----------
VEHICLE_TYPES = {
    "bike":      {"key": "bike",      "label": "Bike",     "label_ur": "Bike",     "base": 80,  "per_km": 25, "desc": "Sasta, gali ke liye"},
    "car":       {"key": "car",       "label": "Car",      "label_ur": "Car",      "base": 150, "per_km": 50, "desc": "Family rides"},
    "rickshaw":  {"key": "rickshaw",  "label": "Rickshaw", "label_ur": "Rickshaw", "base": 100, "per_km": 30, "desc": "Local short rides"},
    "transport": {"key": "transport", "label": "Transport","label_ur": "Transport","base": 200, "per_km": 75, "desc": "Bulk / luggage"},
}

# Each POI is an INDEPENDENT geo point with its own lat/lng.
# Cities act as parent buckets only — picking an area pins exactly that area's coords.
LOCATIONS_DATA = [
    {
        "city": "Muzaffarabad", "type": "city", "lat": 34.3700, "lng": 73.4711,
        "areas": [
            {"name": "City Center / Madina Market", "lat": 34.3702, "lng": 73.4712},
            {"name": "PC Hotel Muzaffarabad",       "lat": 34.3681, "lng": 73.4677},
            {"name": "Chattar Domel",               "lat": 34.3503, "lng": 73.4517},
            {"name": "Neelum Bridge",               "lat": 34.3815, "lng": 73.4810},
            {"name": "Upper Adda",                  "lat": 34.3675, "lng": 73.4690},
            {"name": "Cantt Bazaar",                "lat": 34.3625, "lng": 73.4641},
            {"name": "Chehla Bandi",                "lat": 34.3733, "lng": 73.4810},
            {"name": "Plate",                       "lat": 34.3850, "lng": 73.4750},
            {"name": "Domail",                      "lat": 34.3580, "lng": 73.4700},
            {"name": "Lal Qila",                    "lat": 34.3789, "lng": 73.4733},
            {"name": "Neelum Road",                 "lat": 34.3830, "lng": 73.4920},
            {"name": "CMH Road",                    "lat": 34.3633, "lng": 73.4570},
        ],
    },
    {
        "city": "Garhi Dupatta", "type": "village", "lat": 34.2336, "lng": 73.6253,
        "areas": [
            {"name": "Garhi Dupatta Bazaar",        "lat": 34.2336, "lng": 73.6253},
            {"name": "Naliyan / Naliya",            "lat": 34.2890, "lng": 73.5430},
            {"name": "Langla",                      "lat": 34.2050, "lng": 73.6580},
            {"name": "Bela",                        "lat": 34.0710, "lng": 73.7560},
        ],
    },
    {
        "city": "Hattian Bala", "type": "village", "lat": 34.1647, "lng": 73.7522,
        "areas": [
            {"name": "Hattian Bala Bazaar",         "lat": 34.1647, "lng": 73.7522},
            {"name": "Channari (Chinari)",          "lat": 34.1503, "lng": 73.6989},
            {"name": "Chakothi Border Area",        "lat": 34.0975, "lng": 73.8000},
            {"name": "Ghora Abad",                  "lat": 34.1380, "lng": 73.7160},
            {"name": "Chikar",                      "lat": 34.2150, "lng": 73.6750},
            {"name": "Reshian",                     "lat": 34.2700, "lng": 73.6300},
            {"name": "Leepa Road",                  "lat": 34.2333, "lng": 73.9333},
            {"name": "Nadool Ground",               "lat": 34.1730, "lng": 73.7610},
            {"name": "Nadool Adalat Bazaar",        "lat": 34.1758, "lng": 73.7595},
        ],
    },
    {
        "city": "Chakothi", "type": "village", "lat": 34.0975, "lng": 73.8000,
        "areas": [
            {"name": "Chakothi Bazaar",             "lat": 34.0975, "lng": 73.8000},
            {"name": "LoC Road",                    "lat": 34.0890, "lng": 73.8120},
            {"name": "Uri Road",                    "lat": 34.1100, "lng": 73.7900},
        ],
    },
    {
        "city": "Mirpur", "type": "city", "lat": 33.1481, "lng": 73.7517,
        "areas": [
            {"name": "Allama Iqbal Road",           "lat": 33.1483, "lng": 73.7521},
            {"name": "New City",                    "lat": 33.1610, "lng": 73.7530},
            {"name": "Sector F",                    "lat": 33.1450, "lng": 73.7560},
            {"name": "Sector D",                    "lat": 33.1530, "lng": 73.7470},
            {"name": "Chowk Shaheedan",             "lat": 33.1495, "lng": 73.7505},
            {"name": "Bypass Chowk",                "lat": 33.1382, "lng": 73.7480},
            {"name": "Quaid-e-Azam Stadium Road",   "lat": 33.1565, "lng": 73.7501},
            {"name": "Mangla Road",                 "lat": 33.1310, "lng": 73.6810},
        ],
    },
    {
        "city": "Rawalakot", "type": "city", "lat": 33.8580, "lng": 73.7600,
        "areas": [
            {"name": "Bazaar Chowk",                "lat": 33.8581, "lng": 73.7601},
            {"name": "Banjosa Lake",                "lat": 33.7956, "lng": 73.8175},
            {"name": "Tolipir",                     "lat": 33.8853, "lng": 73.8689},
            {"name": "Hajira",                      "lat": 33.7720, "lng": 73.9220},
            {"name": "Trar Khel",                   "lat": 33.6450, "lng": 73.8970},
            {"name": "College Road",                "lat": 33.8610, "lng": 73.7615},
            {"name": "Poonch Road",                 "lat": 33.8550, "lng": 73.7560},
        ],
    },
    {
        "city": "Neelum Valley - Athmuqam", "type": "village", "lat": 34.5611, "lng": 73.8856,
        "areas": [
            {"name": "Athmuqam Bazaar",             "lat": 34.5611, "lng": 73.8856},
            {"name": "Pateeka",                     "lat": 34.4380, "lng": 73.6740},
            {"name": "Nausada",                     "lat": 34.5180, "lng": 73.8050},
            {"name": "Kel Road (south)",            "lat": 34.5800, "lng": 73.9200},
        ],
    },
    {
        "city": "Neelum Valley - Keran", "type": "village", "lat": 34.6325, "lng": 73.9281,
        "areas": [
            {"name": "Keran Bazaar",                "lat": 34.6325, "lng": 73.9281},
            {"name": "Upper Neelum",                "lat": 34.6750, "lng": 73.9580},
            {"name": "Dowarian",                    "lat": 34.6680, "lng": 73.9420},
        ],
    },
    {
        "city": "Neelum Valley - Sharda", "type": "village", "lat": 34.7866, "lng": 74.1857,
        "areas": [
            {"name": "Sharda Bazaar",               "lat": 34.7866, "lng": 74.1857},
            {"name": "Sharda Fort",                 "lat": 34.7900, "lng": 74.1900},
            {"name": "Surgan",                      "lat": 34.7510, "lng": 74.1430},
            {"name": "Phulwai",                     "lat": 34.7980, "lng": 74.2200},
        ],
    },
    {
        "city": "Kotli", "type": "city", "lat": 33.5187, "lng": 73.9023,
        "areas": [
            {"name": "Kotli City",                  "lat": 33.5187, "lng": 73.9023},
            {"name": "Sehnsa",                      "lat": 33.5630, "lng": 73.9520},
            {"name": "Khuiratta",                   "lat": 33.3220, "lng": 73.9810},
            {"name": "Chowki",                      "lat": 33.5710, "lng": 73.8920},
            {"name": "Tatta Pani",                  "lat": 33.5070, "lng": 73.9550},
            {"name": "Fatehpur Thakiala",           "lat": 33.6200, "lng": 73.8500},
            {"name": "Nakyal",                      "lat": 33.6480, "lng": 74.0820},
        ],
    },
]


async def _osrm_distance_km(lat1, lng1, lat2, lng2):
    """Use OSRM public router for real road distance. Falls back to haversine on failure."""
    try:
        url = f"https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2}?overview=false"
        async with httpx.AsyncClient(timeout=6) as hx:
            r = await hx.get(url)
        if r.status_code == 200:
            d = r.json()
            if d.get("code") == "Ok" and d.get("routes"):
                meters = d["routes"][0]["distance"]
                return round(meters / 1000.0, 2)
    except Exception:
        pass
    return None


def estimate_fare(vehicle_type: str, distance_km: float):
    cfg = VEHICLE_TYPES.get(vehicle_type) or VEHICLE_TYPES["car"]
    base = cfg["base"] + cfg["per_km"] * distance_km
    return {
        "vehicle_type": vehicle_type,
        "distance_km": round(distance_km, 2),
        "low": int(round(base * 0.9)),
        "suggested": int(round(base)),
        "high": int(round(base * 1.2)),
    }


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


# ---------- Config endpoints ----------
@api.get("/config/vehicles")
async def get_vehicles():
    return list(VEHICLE_TYPES.values())


@api.get("/config/locations")
async def get_locations():
    return LOCATIONS_DATA


@api.post("/fare/estimate")
async def fare_estimate(payload: dict):
    vt = payload.get("vehicle_type", "car")
    # If lat/lng supplied, use real road distance via OSRM; else fall back to provided distance.
    p_lat, p_lng = payload.get("pickup_lat"), payload.get("pickup_lng")
    d_lat, d_lng = payload.get("drop_lat"), payload.get("drop_lng")
    dist = None
    if all(v is not None for v in (p_lat, p_lng, d_lat, d_lng)):
        dist = await _osrm_distance_km(p_lat, p_lng, d_lat, d_lng)
    if dist is None:
        dist = float(payload.get("distance_km", 0))
    out = estimate_fare(vt, dist)
    out["source"] = "osrm" if "pickup_lat" in payload and dist == out["distance_km"] else "fallback"
    return out


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
    # Use real road distance from OSRM; haversine fallback only if routing fails
    road_dist = await _osrm_distance_km(payload.pickup_lat, payload.pickup_lng, payload.drop_lat, payload.drop_lng)
    distance_km = road_dist if road_dist is not None else round(_haversine(payload.pickup_lat, payload.pickup_lng, payload.drop_lat, payload.drop_lng), 2)
    now = datetime.now(timezone.utc)
    doc = {
        "ride_id": ride_id,
        "rider_id": user["user_id"],
        "rider_name": user["name"],
        "rider_phone": user.get("phone"),
        "driver_id": None,
        "driver_name": None,
        "driver_phone": None,
        "vehicle_type": payload.vehicle_type,
        "pickup": {"lat": payload.pickup_lat, "lng": payload.pickup_lng, "label": payload.pickup_label},
        "drop": {"lat": payload.drop_lat, "lng": payload.drop_lng, "label": payload.drop_label},
        "distance_km": distance_km,
        "fare_estimate": estimate_fare(payload.vehicle_type, distance_km),
        "offer_price": payload.offer_price,
        "current_price": payload.offer_price,
        "final_price": None,
        "last_offer_by": "rider",
        "rider_counters": 0,
        "driver_counters": 0,
        "offer_expires_at": now + timedelta(seconds=90),
        "status": "searching",
        "driver_stage": None,  # en_route, arrived
        "passenger_confirmed": False,
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
    # Filter by driver's vehicle type if set
    if user.get("vehicle_type"):
        q["vehicle_type"] = user["vehicle_type"]
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


@api.post("/rides/{ride_id}/driver-stage")
async def driver_stage(ride_id: str, payload: DriverProgress, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    """Driver updates progress: en_route (heading to pickup) or arrived (at pickup)."""
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Only assigned driver")
    if ride["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Ride not in accepted state")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"driver_stage": payload.stage, "updated_at": datetime.now(timezone.utc)}})
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
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "in_progress", "pin_verified": True, "driver_stage": "in_progress", "started_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/complete")
async def complete_ride(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    """Driver marks ride as completed → pending_confirm awaiting passenger confirmation."""
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("driver_id"):
        raise HTTPException(status_code=403, detail="Only driver can complete")
    if ride["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Ride not in progress")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "pending_confirm", "completed_at": datetime.now(timezone.utc), "updated_at": datetime.now(timezone.utc)}})
    return await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})


@api.post("/rides/{ride_id}/confirm-complete")
async def confirm_complete(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    """Passenger confirms cash exchange → ride closes & driver earnings credited."""
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] != ride.get("rider_id"):
        raise HTTPException(status_code=403, detail="Only passenger can confirm")
    if ride["status"] != "pending_confirm":
        raise HTTPException(status_code=400, detail="Ride not awaiting confirmation")
    await db.rides.update_one({"ride_id": ride_id}, {"$set": {"status": "completed", "passenger_confirmed": True, "updated_at": datetime.now(timezone.utc)}})
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
    alert = {
        "alert_id": f"sos_{uuid.uuid4().hex[:10]}",
        "ride_id": ride_id,
        "user_id": user["user_id"],
        "rider": {"name": ride["rider_name"], "phone": ride.get("rider_phone")},
        "driver": {"name": ride.get("driver_name"), "phone": ride.get("driver_phone")},
        "pickup": ride["pickup"],
        "drop": ride["drop"],
        "driver_location": ride.get("driver_location"),
        "created_at": datetime.now(timezone.utc),
    }
    await db.sos_alerts.insert_one(alert)
    return {
        "ok": True,
        "emergency_number": "1122",
        "emergency_label": "Rescue Kashmir (1122)",
        "message": "SOS alert recorded. Call 1122 immediately.",
    }


# ---------- Chat ----------
@api.get("/rides/{ride_id}/chat")
async def get_chat(ride_id: str, request: Request, session_token: Optional[str] = Cookie(default=None), authorization: Optional[str] = Header(default=None)):
    user = await get_current_user(request, session_token, authorization)
    ride = await db.rides.find_one({"ride_id": ride_id}, {"_id": 0})
    if not ride:
        raise HTTPException(status_code=404, detail="Ride not found")
    if user["user_id"] not in (ride["rider_id"], ride.get("driver_id")):
        raise HTTPException(status_code=403, detail="Forbidden")
    if ride["status"] not in ("accepted", "in_progress", "pending_confirm", "completed"):
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
    if ride["status"] not in ("accepted", "in_progress", "pending_confirm"):
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


# ---------- ADMIN PANEL ----------
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "DriveAll@AJK2026")


async def _ensure_admin_seed():
    """Idempotently seed/refresh the admin user with the configured password."""
    pw_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
    await db.admins.update_one(
        {"username": ADMIN_USERNAME},
        {"$set": {"username": ADMIN_USERNAME, "password_hash": pw_hash, "updated_at": datetime.now(timezone.utc)},
         "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
        upsert=True,
    )


async def _admin_from_token(token: Optional[str]) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Admin auth required")
    sess = await db.admin_sessions.find_one({"session_token": token}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    exp = sess.get("expires_at")
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp and exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp and exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Admin session expired")
    return sess


def _bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return None


admin_api = APIRouter(prefix="/api/admin")


@admin_api.post("/login")
async def admin_login(payload: dict):
    username = (payload.get("username") or "").strip()
    password = payload.get("password") or ""
    if not username or not password:
        raise HTTPException(status_code=400, detail="username & password required")
    rec = await db.admins.find_one({"username": username}, {"_id": 0})
    if not rec or not bcrypt.checkpw(password.encode(), rec["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = secrets.token_urlsafe(32)
    await db.admin_sessions.insert_one({
        "session_token": token,
        "username": username,
        "expires_at": datetime.now(timezone.utc) + timedelta(hours=12),
        "created_at": datetime.now(timezone.utc),
    })
    return {"token": token, "username": username}


@admin_api.get("/me")
async def admin_me(authorization: Optional[str] = Header(default=None)):
    sess = await _admin_from_token(_bearer_token(authorization))
    return {"username": sess["username"]}


@admin_api.post("/logout")
async def admin_logout(authorization: Optional[str] = Header(default=None)):
    tok = _bearer_token(authorization)
    if tok:
        await db.admin_sessions.delete_one({"session_token": tok})
    return {"ok": True}


@admin_api.get("/stats")
async def admin_stats(authorization: Optional[str] = Header(default=None)):
    await _admin_from_token(_bearer_token(authorization))
    riders, drivers, total_rides, completed, sos = await asyncio.gather(
        db.users.count_documents({"role": "rider"}),
        db.users.count_documents({"role": "driver"}),
        db.rides.count_documents({}),
        db.rides.count_documents({"status": "completed"}),
        db.sos_alerts.count_documents({}),
    )
    revenue_agg = await db.rides.aggregate([
        {"$match": {"status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$final_price"}}}
    ]).to_list(1)
    revenue = (revenue_agg[0]["total"] if revenue_agg else 0)
    return {
        "riders": riders, "drivers": drivers,
        "total_rides": total_rides, "completed_rides": completed,
        "sos_alerts": sos, "gross_fare": revenue,
    }


@admin_api.get("/users")
async def admin_users(role: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    await _admin_from_token(_bearer_token(authorization))
    q = {}
    if role in ("rider", "driver"):
        q["role"] = role
    docs = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return docs


@admin_api.post("/users/{user_id}/approve")
async def admin_approve_driver(user_id: str, authorization: Optional[str] = Header(default=None)):
    """Approve a driver (sets verified=True)."""
    await _admin_from_token(_bearer_token(authorization))
    res = await db.users.update_one({"user_id": user_id}, {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc)}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@admin_api.post("/users/{user_id}/suspend")
async def admin_suspend_user(user_id: str, payload: dict, authorization: Optional[str] = Header(default=None)):
    await _admin_from_token(_bearer_token(authorization))
    suspended = bool(payload.get("suspended", True))
    await db.users.update_one({"user_id": user_id}, {"$set": {"suspended": suspended}})
    return {"ok": True, "suspended": suspended}


@admin_api.get("/rides")
async def admin_rides(status: Optional[str] = None, authorization: Optional[str] = Header(default=None)):
    await _admin_from_token(_bearer_token(authorization))
    q = {}
    if status:
        q["status"] = status
    docs = await db.rides.find(q, {"_id": 0}).sort("created_at", -1).to_list(300)
    return docs


@admin_api.get("/sos")
async def admin_sos(authorization: Optional[str] = Header(default=None)):
    await _admin_from_token(_bearer_token(authorization))
    docs = await db.sos_alerts.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


app.include_router(admin_api)


@app.on_event("startup")
async def expire_offers_loop():
    await _ensure_admin_seed()

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
