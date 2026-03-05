# Zynon Follow System API Documentation

Base URL

```
test server <!-- https://zynon.onrender.com/api/follow -->
```

Authentication

Most endpoints require authentication.

Header:

```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

The authenticated user is obtained from the JWT token (`req.user.id`).

---

1. FOLLOW USER

Endpoint

```
POST /:userId/follow
```

Description
Follow a user. If the account is private, a follow request will be created instead.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Parameters

```
userId (string) → Target user ID to follow
```

Body

```
None
```

Example Request

```
POST https://zynon.onrender.com/api/follow/65fabc123/follow
```

Success Response (Public Account)

```
Status: 201
{
  "success": true,
  "message": "User followed successfully"
}
```

Success Response (Private Account)

```
Status: 201
{
  "success": true,
  "message": "Follow request sent"
}
```

Error Responses

```
400
{
  "success": false,
  "message": "You cannot follow yourself"
}
```

```
400
{
  "success": false,
  "message": "Follow request already exists"
}
```

```
404
{
  "success": false,
  "message": "User profile not found"
}
```

---

2. UNFOLLOW USER

Endpoint

```
DELETE /:userId/unfollow
```

Description
Unfollow a user you are currently following.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Parameters

```
userId → Target user ID
```

Example Request

```
DELETE https://zynon.onrender.com/api/follow/65fabc123/unfollow
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "User unfollowed successfully"
}
```

Error Response

```
404
{
  "success": false,
  "message": "You are not following this user"
}
```

---

3. CANCEL FOLLOW REQUEST

Endpoint

```
DELETE /:userId/cancel-request
```

Description
Cancel a follow request that you previously sent to a private account.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Parameters

```
userId → Target user ID
```

Example Request

```
DELETE https://zynon.onrender.com/api/follow/65fabc123/cancel-request
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Follow request cancelled"
}
```

---

4. ACCEPT FOLLOW REQUEST

Endpoint

```
POST /:userId/accept
```

Description
Accept a follow request from another user.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Parameters

```
userId → User who sent the follow request
```

Example Request

```
POST https://zynon.onrender.com/api/follow/65fabc123/accept
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Follow request accepted"
}
```

Error Response

```
404
{
  "success": false,
  "message": "Follow request not found"
}
```

---

5. REJECT FOLLOW REQUEST

Endpoint

```
POST /:userId/reject
```

Description
Reject a follow request from another user.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Parameters

```
userId → User who sent the request
```

Example Request

```
POST https://zynon.onrender.com/api/follow/65fabc123/reject
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Follow request rejected"
}
```

---

6. GET FOLLOWERS

Endpoint

```
GET /:userId/followers
```

Description
Fetch a list of users who follow the specified user.

Headers

```
None
```

Parameters

```
userId → User whose followers are requested
```

Example Request

```
GET https://zynon.onrender.com/api/follow/65fabc123/followers
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Followers fetched successfully",
  "data": [
    {
      "_id": "followId",
      "follower": {
        "_id": "userId",
        "username": "udit"
      }
    }
  ]
}
```

---

7. GET FOLLOWING

Endpoint

```
GET /:userId/following
```

Description
Fetch users that the specified user is following.

Example Request

```
GET https://zynon.onrender.com/api/follow/65fabc123/following
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Following fetched successfully",
  "data": [
    {
      "_id": "followId",
      "following": {
        "_id": "userId",
        "username": "udit"
      }
    }
  ]
}
```

---

8. GET FOLLOW STATUS

Endpoint

```
GET /:userId/status
```

Description
Check the follow relationship between the authenticated user and the target user.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Example Request

```
GET https://zynon.onrender.com/api/follow/65fabc123/status
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Follow status fetched",
  "data": {
    "status": "following"
  }
}
```

Possible Status Values

```
not_following
requested
following
```

---

9. GET PENDING FOLLOW REQUESTS

Endpoint

```
GET /requests
```

Description
Fetch all follow requests sent to the authenticated user.

Headers

```
Authorization: Bearer <JWT_TOKEN>
```

Example Request

```
GET https://zynon.onrender.com/api/follow/requests
```

Success Response

```
Status: 200
{
  "success": true,
  "message": "Follow requests fetched",
  "data": [
    {
      "_id": "followId",
      "follower": {
        "_id": "userId",
        "username": "udit"
      }
    }
  ]
}
```

---

Database Behavior

Follow Collection Example

```
{
  "_id": "followId",
  "follower": "userA",
  "following": "userB",
  "status": "pending",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Status values

```
active → user is following
pending → follow request sent
```

---

UserProfile Counters

When a follow becomes active:

```
followersCount +1
followingCount +1
```

When unfollow happens:

```
followersCount -1
followingCount -1
```

---

End of Follow System API Documentation
