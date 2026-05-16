# DriveAll — Test Credentials

Authentication is via **Emergent-managed Google OAuth** (no app-managed passwords).

## Test users seeded in MongoDB

Use these to test backend / auth-gated flows. Pass as `Authorization: Bearer <session_token>`.

### Rider
- **session_token**: `tok_rider_1778936464604`
- **user_id**: `rider_t1778936464604`
- **email**: `rider_t@test.com`
- **role**: rider

### Driver (online)
- **session_token**: `tok_driver_1778936465020`
- **user_id**: `driver_t1778936465020`
- **email**: `driver_t@test.com`
- **role**: driver, is_online: true

## Seed new users (helpful for testing)
```bash
mongosh driveall_db --quiet --eval '
var u="rider_"+Date.now();
var t="tok_rider_"+Date.now();
db.users.insertOne({user_id:u,email:"rider_"+Date.now()+"@test.com",name:"Test Rider",role:"rider",language:"en",theme:"light",rating:5,is_online:false,earnings:0,phone:"+923001234567",village:"Hattian",city:"Muzaffarabad",created_at:new Date()});
db.user_sessions.insertOne({user_id:u,session_token:t,expires_at:new Date(Date.now()+7*86400000),created_at:new Date()});
print("RIDER: "+t);

var u2="driver_"+Date.now();
var t2="tok_driver_"+Date.now();
db.users.insertOne({user_id:u2,email:"driver_"+Date.now()+"@test.com",name:"Test Driver",role:"driver",language:"en",theme:"light",rating:5,is_online:true,earnings:0,phone:"+923009876543",village:"Hattian",city:"Muzaffarabad",vehicle_model:"Suzuki Mehran",vehicle_plate:"AJK-1234",cnic:"12345-6789012-3",license_no:"DL-9876",current_lat:34.37,current_lng:73.47,created_at:new Date()});
db.user_sessions.insertOne({user_id:u2,session_token:t2,expires_at:new Date(Date.now()+7*86400000),created_at:new Date()});
print("DRIVER: "+t2);
'
```

## Browser cookie testing
```js
await page.context.add_cookies([{
  "name": "session_token",
  "value": "tok_rider_1778936464604",
  "domain": "271f4390-3ef9-4e57-a946-563d86d7ae83.preview.emergentagent.com",
  "path": "/",
  "httpOnly": True,
  "secure": True,
  "sameSite": "None"
}]);
```

## Cleanup
```bash
mongosh driveall_db --eval 'db.users.deleteMany({email:/@test\.com$/}); db.user_sessions.deleteMany({session_token:/^tok_/});'
```
