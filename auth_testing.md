# DriveAll — Auth Testing Playbook (Emergent Google Auth)

## Test User & Session via MongoDB
```bash
mongosh --eval "
use('driveall_db');
var userId = 'test-user-' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'test.rider.' + Date.now() + '@example.com',
  name: 'Test Rider',
  picture: 'https://via.placeholder.com/150',
  role: 'rider',
  language: 'en',
  theme: 'light',
  rating: 5.0,
  is_online: false,
  earnings: 0.0,
  phone: '+923001234567',
  village: 'Hattian',
  city: 'Muzaffarabad',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print('Session token: ' + sessionToken);
print('User ID: ' + userId);
"
```

## Backend API tests (use Bearer token)
```
curl -X GET "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN"
curl -X PATCH "$API_URL/api/users/me" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"language":"ur"}'
curl -X POST "$API_URL/api/rides" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"pickup_lat":34.37,"pickup_lng":73.47,"pickup_label":"A","drop_lat":34.4,"drop_lng":73.5,"drop_label":"B","offer_price":300}'
```

## Cleanup
```bash
mongosh --eval "use('driveall_db'); db.users.deleteMany({email:/test\.rider\./}); db.user_sessions.deleteMany({session_token:/test_session_/});"
```
