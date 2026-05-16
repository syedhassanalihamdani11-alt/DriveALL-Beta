"""DriveAll backend API tests - end-to-end coverage of auth, profile, rides, negotiation, chat, SOS."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://271f4390-3ef9-4e57-a946-563d86d7ae83.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

RIDER_TOKEN = "tok_rider_1778936464604"
DRIVER_TOKEN = "tok_driver_1778936465020"


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_root_ok():
    r = requests.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("app") == "DriveAll"
    assert data.get("status") == "ok"


# ---------- Auth ----------
def test_auth_me_requires_token():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_auth_me_invalid_token():
    r = requests.get(f"{API}/auth/me", headers=hdr("bad_token"))
    assert r.status_code == 401


def test_auth_me_rider():
    r = requests.get(f"{API}/auth/me", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["role"] == "rider"
    assert data["email"] == "rider_t@test.com"


def test_auth_me_driver():
    r = requests.get(f"{API}/auth/me", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "driver"


# ---------- Profile ----------
def test_patch_users_me_language():
    r = requests.patch(f"{API}/users/me", headers=hdr(RIDER_TOKEN), json={"language": "ur"})
    assert r.status_code == 200
    assert r.json()["language"] == "ur"
    # revert
    r = requests.patch(f"{API}/users/me", headers=hdr(RIDER_TOKEN), json={"language": "en"})
    assert r.json()["language"] == "en"


def test_patch_users_me_theme():
    r = requests.patch(f"{API}/users/me", headers=hdr(RIDER_TOKEN), json={"theme": "dark"})
    assert r.status_code == 200
    assert r.json()["theme"] == "dark"
    requests.patch(f"{API}/users/me", headers=hdr(RIDER_TOKEN), json={"theme": "light"})


# ---------- Driver status ----------
def test_driver_status_requires_driver_role():
    r = requests.post(f"{API}/drivers/status", headers=hdr(RIDER_TOKEN), json={"is_online": True})
    assert r.status_code == 403


def test_driver_status_ok():
    r = requests.post(f"{API}/drivers/status", headers=hdr(DRIVER_TOKEN), json={"is_online": True, "lat": 34.37, "lng": 73.47})
    assert r.status_code == 200
    assert r.json()["is_online"] is True


# ---------- Ride creation ----------
RIDE_PAYLOAD = {
    "pickup_lat": 34.37, "pickup_lng": 73.47, "pickup_label": "Hattian",
    "drop_lat": 34.40, "drop_lng": 73.50, "drop_label": "Muzaffarabad",
    "offer_price": 300.0,
}


def test_create_ride_requires_rider():
    r = requests.post(f"{API}/rides", headers=hdr(DRIVER_TOKEN), json=RIDE_PAYLOAD)
    assert r.status_code == 403


def test_create_ride_ok():
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    assert r.status_code == 200, r.text
    ride = r.json()
    assert ride["status"] == "searching"
    assert len(ride["pin"]) == 4 and ride["pin"].isdigit()
    assert ride["distance_km"] > 0
    assert ride["offer_expires_at"] is not None
    assert ride["last_offer_by"] == "rider"


# ---------- Driver requests list ----------
def test_driver_requests_role_check():
    r = requests.get(f"{API}/rides/driver/requests", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 403


def test_driver_requests_list():
    # create a fresh ride
    requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    r = requests.get(f"{API}/rides/driver/requests", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1


# ---------- Full E2E lifecycle ----------
def test_full_ride_lifecycle():
    # 1. rider creates ride
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    assert r.status_code == 200
    ride = r.json()
    ride_id = ride["ride_id"]
    pin = ride["pin"]

    # 2. driver cannot start (not yet accepted)
    r = requests.post(f"{API}/rides/{ride_id}/start", headers=hdr(DRIVER_TOKEN), json={"pin": pin})
    assert r.status_code in (400, 403)

    # 3. driver counters - assigns driver_id, last_offer_by=driver
    r = requests.post(f"{API}/rides/{ride_id}/counter", headers=hdr(DRIVER_TOKEN), json={"price": 350})
    assert r.status_code == 200, r.text
    upd = r.json()
    assert upd["status"] == "negotiating"
    assert upd["last_offer_by"] == "driver"
    assert upd["driver_counters"] == 1
    assert upd["driver_id"] is not None
    assert upd["current_price"] == 350

    # 4. driver cannot accept own offer
    r = requests.post(f"{API}/rides/{ride_id}/accept", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 400

    # 5. rider accepts
    r = requests.post(f"{API}/rides/{ride_id}/accept", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 200
    acc = r.json()
    assert acc["status"] == "accepted"
    assert acc["final_price"] == 350

    # 6. chat works after accepted
    r = requests.post(f"{API}/rides/{ride_id}/chat", headers=hdr(RIDER_TOKEN), json={"text": "Hi driver"})
    assert r.status_code == 200, r.text
    r = requests.get(f"{API}/rides/{ride_id}/chat", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 200
    msgs = r.json()
    assert any(m["text"] == "Hi driver" for m in msgs)

    # 7. start with wrong PIN
    r = requests.post(f"{API}/rides/{ride_id}/start", headers=hdr(DRIVER_TOKEN), json={"pin": "0000"})
    assert r.status_code == 400

    # 8. start with correct PIN
    r = requests.post(f"{API}/rides/{ride_id}/start", headers=hdr(DRIVER_TOKEN), json={"pin": pin})
    assert r.status_code == 200
    assert r.json()["status"] == "in_progress"

    # 9. complete - rider should not be able to
    r = requests.post(f"{API}/rides/{ride_id}/complete", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 403

    # earnings before
    me_before = requests.get(f"{API}/auth/me", headers=hdr(DRIVER_TOKEN)).json()
    earnings_before = me_before.get("earnings", 0)

    # 10. driver completes
    r = requests.post(f"{API}/rides/{ride_id}/complete", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 200
    assert r.json()["status"] == "completed"

    # earnings updated
    me_after = requests.get(f"{API}/auth/me", headers=hdr(DRIVER_TOKEN)).json()
    assert me_after.get("earnings", 0) >= earnings_before + 350 - 0.01

    # 11. SOS
    r = requests.post(f"{API}/rides/{ride_id}/sos", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 200
    assert r.json()["ok"] is True


# ---------- Negotiation edge cases ----------
def test_max_counter_offers():
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    ride_id = r.json()["ride_id"]
    # driver does 3 counters
    for i, p in enumerate([350, 360, 370]):
        r = requests.post(f"{API}/rides/{ride_id}/counter", headers=hdr(DRIVER_TOKEN), json={"price": p})
        assert r.status_code == 200, f"counter {i} failed: {r.text}"
    # 4th must fail
    r = requests.post(f"{API}/rides/{ride_id}/counter", headers=hdr(DRIVER_TOKEN), json={"price": 380})
    assert r.status_code == 400


def test_rider_cannot_accept_own_offer():
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    ride_id = r.json()["ride_id"]
    # rider just created => last_offer_by=rider
    r = requests.post(f"{API}/rides/{ride_id}/accept", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 400


def test_non_participant_cannot_access_ride():
    # Create ride
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    ride_id = r.json()["ride_id"]
    # Unauthenticated request
    r = requests.get(f"{API}/rides/{ride_id}")
    assert r.status_code == 401


def test_chat_blocked_before_acceptance():
    r = requests.post(f"{API}/rides", headers=hdr(RIDER_TOKEN), json=RIDE_PAYLOAD)
    ride_id = r.json()["ride_id"]
    # status is 'searching'
    r = requests.get(f"{API}/rides/{ride_id}/chat", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 400
    r = requests.post(f"{API}/rides/{ride_id}/chat", headers=hdr(RIDER_TOKEN), json={"text": "early"})
    assert r.status_code == 400


# ---------- Ride history ----------
def test_rides_history_rider():
    r = requests.get(f"{API}/rides/me/history", headers=hdr(RIDER_TOKEN))
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # sorted desc by created_at
    if len(data) >= 2:
        assert data[0]["created_at"] >= data[1]["created_at"]


def test_rides_history_driver():
    r = requests.get(f"{API}/rides/me/history", headers=hdr(DRIVER_TOKEN))
    assert r.status_code == 200
    assert isinstance(r.json(), list)
