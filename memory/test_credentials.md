# DriveAll — Test Credentials

## 👑 ADMIN PANEL ACCESS

**URL**: https://271f4390-3ef9-4e57-a946-563d86d7ae83.preview.emergentagent.com/admin

- **Username**: `admin`
- **Password**: `DriveAll@AJK2026`

Capabilities: View riders/drivers, approve drivers, suspend users, monitor all rides, view SOS alerts, dashboard stats (riders, drivers, rides, completed, gross fare, SOS).

To change the password, edit `/app/backend/.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`) and restart backend — seed is idempotent and updates the hash on every startup.

---

## 🚖 RIDER / DRIVER TEST USERS (Google OAuth bypass)

User-facing auth is via **Emergent-managed Google OAuth**. For automated testing or bypassing OAuth, use these seeded Bearer tokens via `Authorization: Bearer <token>` OR localStorage key `da_token`.

### Rider
- **session_token**: `tok_rider_1778936464604`
- **user_id**: `rider_t1778936464604`
- **email**: `rider_t@test.com`
- **role**: rider

### Driver (online, vehicle: car)
- **session_token**: `tok_driver_1778936465020`
- **user_id**: `driver_t1778936465020`
- **email**: `driver_t@test.com`
- **role**: driver, is_online: true

---

## Seed fresh test users
```bash
mongosh driveall_db --quiet --eval '
var u="rider_"+Date.now();
var t="tok_rider_"+Date.now();
db.users.insertOne({user_id:u,email:"rider_"+Date.now()+"@test.com",name:"Test Rider",role:"rider",language:"en",theme:"light",rating:5,is_online:false,earnings:0,phone:"+923001234567",village:"Hattian",city:"Muzaffarabad",created_at:new Date()});
db.user_sessions.insertOne({user_id:u,session_token:t,expires_at:new Date(Date.now()+7*86400000),created_at:new Date()});
print("RIDER: "+t);

var u2="driver_"+Date.now();
var t2="tok_driver_"+Date.now();
db.users.insertOne({user_id:u2,email:"driver_"+Date.now()+"@test.com",name:"Test Driver",role:"driver",language:"en",theme:"light",rating:5,is_online:true,earnings:0,phone:"+923009876543",village:"Hattian",city:"Muzaffarabad",vehicle_type:"rickshaw",vehicle_model:"Suzuki",vehicle_plate:"AJK-1234",current_lat:34.37,current_lng:73.47,created_at:new Date()});
db.user_sessions.insertOne({user_id:u2,session_token:t2,expires_at:new Date(Date.now()+7*86400000),created_at:new Date()});
print("DRIVER: "+t2);
'
```

## Browser cookie/localStorage testing
```js
// User-facing app uses Bearer token in localStorage:
localStorage.setItem('da_token', 'tok_rider_1778936464604');

// Admin panel uses Bearer token in localStorage:
localStorage.setItem('da_admin_token', '<token from /api/admin/login>');
```

## Cleanup
```bash
mongosh driveall_db --eval 'db.users.deleteMany({email:/@test\.com$/}); db.user_sessions.deleteMany({session_token:/^tok_/});'
```
