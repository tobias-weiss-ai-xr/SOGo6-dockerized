# Resource Booking - API Documentation

**Feature**: Resource Booking (Tier 0 Foundation)  
**Version**: 1.0.0  
**Status**: ✅ Complete  
**Date**: 2025-08-21  

---

## 📚 Overview

The Resource Booking API provides complete management of bookable resources (meeting rooms, equipment, vehicles) and their bookings. It follows the calendar-centric design where bookings are represented as calendar events with resource attendees (RFC 5545 compliant).

**Base URLs**:
- User API: `/api/user/v1/resources`
- Admin API: `/api/admin/v1/resources`

**Authentication**: Bearer Token (JWT)
- User endpoints: Any authenticated user
- Admin endpoints: Users with admin role

**Response Format**: All responses use the standard envelope:
```json
{
  "data": { ... },
  "error_code": null,
  "message": null,
  "success": true
}
```

---

## 🎯 User API Endpoints (7)

### 1. List Resources
`GET /api/user/v1/resources`

Returns a paginated list of resources with optional filters.

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `resource_type` | string | Filter: `room`, `equipment`, `vehicle`, `other` |
| `location` | string | Filter by location (substring match) |
| `capacity_min` | integer | Minimum capacity |
| `capacity_max` | integer | Maximum capacity |
| `search` | string | Search in name and description |
| `feature` | string | Filter by feature |
| `is_available` | boolean | Filter by current availability |
| `limit` | integer | Max results (default 50, max 500) |
| `offset` | integer | Pagination offset |

**Response**: List of Resource objects.

---

### 2. Get Resource Details
`GET /api/user/v1/resources/{resource_id}`

Returns details for a single resource.

**Response**: Detailed Resource object.

**Errors**:
- `404` `ERROR_RESOURCE_NOT_FOUND` - Resource does not exist

---

### 3. List Available Resources
`GET /api/user/v1/resources/available`

Returns all resources available during a specified time range.

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start_time` | datetime | ✅ | Start of availability window (ISO 8601) |
| `end_time` | datetime | ✅ | End of availability window (ISO 8601) |
| `timezone` | string | ❌ | IANA timezone (default `UTC`) |

**Response**:
```json
{
  "resources": [
    {
      "id": "res-001",
      "name": "Conference Room A",
      "is_available": true,
      "next_available": null
    }
  ],
  "total_count": 1,
  "start_time": "2025-08-25T10:00:00Z",
  "end_time": "2025-08-25T12:00:00Z"
}
```

---

### 4. Check Resource Availability
`POST /api/user/v1/resources/{resource_id}/check-availability`

Checks whether a specific resource is available for the requested time.

**Request Body**:
```json
{
  "start_time": "2025-08-25T10:00:00Z",
  "end_time": "2025-08-25T12:00:00Z",
  "timezone": "UTC",
  "exclude_booking_id": "booking-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_time` | datetime | ✅ | Booking start (ISO 8601) |
| `end_time` | datetime | ✅ | Booking end (ISO 8601) |
| `timezone` | string | ❌ | IANA timezone (default `UTC`) |
| `exclude_booking_id` | string | ❌ | Booking to exclude from conflict check (for edits) |

**Response**:
```json
{
  "available": true,
  "conflicts": []
}
```

**Errors**:
- `404` `ERROR_RESOURCE_NOT_FOUND` - Resource does not exist
- `409` - Resource conflicts detected

---

### 5. Book a Resource
`POST /api/user/v1/resources/{resource_id}/book`

Books a resource by creating a calendar event with the resource as attendee.

**Request Body**:
```json
{
  "start_time": "2025-08-25T10:00:00Z",
  "end_time": "2025-08-25T12:00:00Z",
  "timezone": "UTC",
  "title": "Team Meeting",
  "description": "Quarterly planning",
  "calendar_id": "cal-001",
  "is_online_meeting": true,
  "online_meeting_link": "https://teams.example.com/meet/123",
  "location": "Building A"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `start_time` | datetime | ✅ | Booking start |
| `end_time` | datetime | ✅ | Booking end |
| `timezone` | string | ❌ | IANA timezone |
| `title` | string | ✅ | Event title (1-255 chars) |
| `description` | string | ❌ | Event description |
| `calendar_id` | string | ❌ | Calendar for event (defaults to primary) |
| `is_online_meeting` | boolean | ❌ | Online meeting flag |
| `online_meeting_link` | string | ❌ | Video conference link |
| `location` | string | ❌ | Physical location |

**Response**:
```json
{
  "booking_id": "booking-001",
  "event_id": "event-001",
  "calendar_event": { ... },
  "message": "Resource booked successfully"
}
```

**Errors**:
- `404` `ERROR_RESOURCE_NOT_FOUND` - Resource does not exist
- `409` `ERROR_RESOURCE_CONFLICT` - Resource not available at requested time

---

### 6. List My Bookings
`GET /api/user/v1/resources/my-bookings`

Returns all bookings made by the current user.

**Response**:
```json
{
  "bookings": [
    {
      "id": "booking-001",
      "resource_id": "res-001",
      "resource_name": "Conference Room A",
      "event_id": "event-001",
      "start_time": "2025-08-25T10:00:00Z",
      "end_time": "2025-08-25T12:00:00Z",
      "title": "Team Meeting",
      "status": "confirmed",
      "organizer_id": "user-001",
      "organizer_name": "Max Mustermann",
      "created_at": "2025-08-01T08:00:00Z"
    }
  ],
  "total_count": 1
}
```

---

### 7. Get / Cancel a Booking
`GET /api/user/v1/resources/my-bookings/{booking_id}`

Returns details for a specific booking owned by the user.

`DELETE /api/user/v1/resources/my-bookings/{booking_id}`

Cancels a booking.

**Errors**:
- `404` `ERROR_BOOKING_NOT_FOUND` - Booking does not exist
- `403` `ERROR_BOOKING_ACCESS_DENIED` - Booking belongs to another user

---

## 🛡️ Admin API Endpoints (7)

### 1. Create Resource
`POST /api/admin/v1/resources`

Creates a new resource.

**Request Body**:
```json
{
  "name": "Conference Room A",
  "email": "room-a@example.org",
  "resource_type": "room",
  "description": "Ground floor, 20 seats",
  "capacity": 20,
  "location": "Building A, Floor 1",
  "features": ["projector", "video_conferencing", "whiteboard"],
  "booking_policy": "open",
  "allowed_groups": ["engineering", "sales"],
  "auto_accept": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Resource name |
| `email` | email | ✅ | Unique resource email (also used as attendee URI) |
| `resource_type` | string | ❌ | `room`, `equipment`, `vehicle`, `other` (default `room`) |
| `description` | string | ❌ | Description |
| `capacity` | integer | ❌ | Capacity (for rooms) |
| `location` | string | ❌ | Physical location |
| `features` | string[] | ❌ | Features list |
| `booking_policy` | string | ❌ | `open`, `moderated`, `restricted` (default `open`) |
| `allowed_groups` | string[] | ❌ | LDAP groups allowed to book |
| `auto_accept` | boolean | ❌ | Auto-accept bookings (default `true`) |

**Errors**:
- `409` `ERROR_RESOURCE_DUPLICATE` - Email already in use
- `400` - Invalid resource type or booking policy

---

### 2. List Resources (Admin)
`GET /api/admin/v1/resources`

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `active_only` | boolean | Filter to active resources only |

Returns all resources including inactive ones (admin sees everything).

---

### 3. List Available Resources (Admin)
`GET /api/admin/v1/resources/available`

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | string | ✅ | Start datetime |
| `end` | string | ✅ | End datetime |
| `resource_type` | string | ❌ | Filter by type |
| `min_capacity` | integer | ❌ | Minimum capacity |

---

### 4. Get Resource (Admin)
`GET /api/admin/v1/resources/{resource_id}`

Returns a single resource including inactive ones.

---

### 5. Update Resource (Admin)
`PATCH /api/admin/v1/resources/{resource_id}`

Updates a resource with partial fields (all optional).

**Errors**:
- `404` `ERROR_RESOURCE_NOT_FOUND`
- `409` `ERROR_RESOURCE_DUPLICATE`

---

### 6. Delete Resource (Admin)
`DELETE /api/admin/v1/resources/{resource_id}`

Deletes a resource.

**Errors**:
- `404` `ERROR_RESOURCE_NOT_FOUND`

---

### 7. Check Resource Availability (Admin)
`POST /api/admin/v1/resources/{resource_id}/availability`

Checks availability for a resource (admin variant with `start`/`end` params).

**Request Body**:
```json
{
  "resource_id": "res-001",
  "start": "2025-08-25T10:00:00Z",
  "end": "2025-08-25T12:00:00Z"
}
```

---

## 📦 Data Models

### Resource

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique resource ID |
| `name` | string | Resource name |
| `description` | string | Description |
| `email` | string | Resource email (attendee URI) |
| `resource_type` | string | `room`, `equipment`, `vehicle`, `other` |
| `capacity` | integer | Capacity |
| `location` | string | Physical location |
| `features` | string[] | Features |
| `is_active` | boolean | Active status |
| `booking_policy` | string | `open`, `moderated`, `restricted` |
| `auto_accept` | boolean | Auto-accept bookings |
| `allowed_groups` | string[] | Allowed LDAP groups |
| `created_at` | datetime | Creation timestamp |
| `updated_at` | datetime | Last update |
| `is_favorite` | boolean | User favorite flag |

### Booking

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique booking ID |
| `resource_id` | string | Booked resource |
| `resource_name` | string | Resource display name |
| `event_id` | string | Linked calendar event |
| `start_time` | datetime | Booking start |
| `end_time` | datetime | Booking end |
| `title` | string | Booking title |
| `status` | string | `confirmed`, `pending`, `cancelled`, `rejected` |
| `organizer_id` | string | Booking owner |
| `organizer_name` | string | Owner display name |
| `created_at` | datetime | Creation time |

---

## 🚨 Error Codes

| Error Code | HTTP Status | Description |
|-----------|-------------|-------------|
| `ERROR_RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `ERROR_RESOURCE_DUPLICATE` | 409 | Resource email already in use |
| `ERROR_RESOURCE_ACCESS_DENIED` | 403 | No access to resource |
| `ERROR_RESOURCE_NOT_AVAILABLE` | 409 | Resource deactivated/not available |
| `ERROR_RESOURCE_CONFLICT` | 409 | Time conflict with existing booking |
| `ERROR_BOOKING_NOT_FOUND` | 404 | Booking does not exist |
| `ERROR_BOOKING_ACCESS_DENIED` | 403 | Booking belongs to another user |
| `ERROR_BOOKING_CANCEL_FAILED` | 409 | Booking cancellation failed |
| `ERROR_INVALID_INPUT` | 400 | Schema validation failed |
| `ERROR_SERVER_ERROR` | 500 | Internal server error |

---

## 💡 Usage Examples

### Book a meeting room (cURL)

```bash
curl -X POST "https://api.example.com/api/user/v1/resources/res-001/book" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-08-25T10:00:00Z",
    "end_time": "2025-08-25T12:00:00Z",
    "title": "Team Meeting",
    "description": "Quarterly planning"
  }'
```

### Check availability (cURL)

```bash
curl -X POST "https://api.example.com/api/user/v1/resources/res-001/check-availability" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "2025-08-25T10:00:00Z",
    "end_time": "2025-08-25T12:00:00Z"
  }'
```

### Create a resource (admin, cURL)

```bash
curl -X POST "https://api.example.com/api/admin/v1/resources" \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Projector Cart",
    "email": "projector@example.org",
    "resource_type": "equipment",
    "features": ["projector", "hdmi"]
  }'
```

---

## 🔒 Security Notes

- All endpoints require authentication via JWT Bearer token
- Admin endpoints verify admin role via `has_admin_access`
- User booking access is scoped: users can only view/cancel their own bookings
- Resource emails serve as attendee URIs in calendar events (RFC 5545)
- Conflict detection prevents double-booking at the calendar level

---

## 📈 Performance

- List endpoints support pagination (`limit`/`offset`)
- Availability checks query the calendar engine's conflict detection
- Resources are cached with the standard module caching layer

---

*Documentation complete - 14 endpoints documented (7 user + 7 admin)*
