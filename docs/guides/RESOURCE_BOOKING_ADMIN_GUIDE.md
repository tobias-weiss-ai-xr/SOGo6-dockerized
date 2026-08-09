# Resource Booking - Administrator Guide

**Feature**: Resource Booking (Tier 0 Foundation)  
**Version**: 1.0.0  
**Status**: ✅ Complete  
**Date**: 2025-08-21  

---

## 📖 Overview

As an administrator, you manage the **resources** that users can book. This includes creating resources, configuring booking policies, managing access, and handling resource lifecycle.

The admin interface is available at `/admin_panel/resources`.

---

## 🛠️ Managing Resources

### Create a Resource

1. Go to **Admin Panel → Resources**
2. Click **New Resource**
3. Fill in the details:

| Field | Required | Description |
|-------|----------|-------------|
| **Name** | ✅ | Display name (e.g., "Conference Room A") |
| **Email** | ✅ | Unique address used for calendar booking (e.g., `room-a@example.org`) |
| **Type** | ❌ | `room`, `equipment`, `vehicle`, or `other` |
| **Capacity** | ❌ | Number of seats (for rooms) |
| **Location** | ❌ | Physical location |
| **Description** | ❌ | Details shown to users |
| **Features** | ❌ | What it offers (projector, whiteboard, video...) |
| **Booking Policy** | ❌ | `open`, `moderated`, `restricted` |
| **Allowed Groups** | ❌ | LDAP groups that may book |
| **Auto-accept** | ❌ | Auto-approve bookings |

4. Click **Create**

> ⚠️ The **email** must be unique. It's used as the resource identity when booking calendar events (RFC 5545 attendee URI).

---

### Booking Policies Explained

| Policy | Behavior | Best For |
|--------|----------|----------|
| **Open** | Users book instantly | Flexible rooms |
| **Moderated** | Bookings require a moderator's approval | Premium/high-traffic rooms |
| **Restricted** | Only allowed groups can book | Executive suites, specialized equipment |

> 💡 With **Allowed Groups** you can restrict who sees and books a resource, even with an open policy.

---

## 📋 Viewing Resources

The admin list shows **all** resources including inactive ones. You can:

- **Search** by name or email
- **Filter** by type, policy, and status
- **See capacity, location, and features** at a glance
- **Check active status** (active/inactive badges)

---

## ✏️ Updating a Resource

Edit any resource to change its properties:
- Rename or re-describe
- Change capacity or location
- Add/remove features
- Change booking policy
- Update allowed groups
- **Activate / Deactivate**

> 💡 Deactivating immediately prevents new bookings. Existing bookings remain until their end time.

---

## 🗑️ Deleting a Resource

1. Open the resource details
2. Click **Delete**
3. Confirm

> ⚠️ Deleting a resource removes it permanently. Deactivate instead if you think you'll need it again.

---

## 📊 Monitoring

### Check availability

Use the admin availability check to:
- See whether a resource is free at a given time
- Identify conflicts before making changes
- Audit usage of popular resources

### Review bookings

You can list all bookings (across all users) to:
- Monitor usage patterns
- Identify over/under-used resources
- Manage moderated bookings (approve/reject)

---

## 🛡️ Access Control

### Admin access

Only users with the **admin role** can access the admin resource management interface. Access is enforced on both the UI and API (`has_admin_access`).

### Group restrictions

For **restricted** policies, enter the LDAP group names allowed to book. Users not in these groups won't see or book the resource.

> ⚠️ Group matching is case-sensitive and matches exact LDAP group names.

---

## ✅ Best Practices

1. **Use consistent type names** - Rooms are `room`, equipment is `equipment`, etc. This makes filtering predictable.
2. **Add complete features** - Users filter by features; a room missing its projector listing won't be found by projector-seekers.
3. **Set capacities accurately** - Users filter by minimum capacity; wrong values cause confusion.
4. **Deactivate, don't delete** - For temporary closures (renovation, maintenance), deactivate and reactivate later.
5. **Name resources clearly** - "Room 3.12" is better than "Room B".
6. **Moderate high-demand resources** - Avoid conflicts for popular meeting rooms.

---

## 🔧 Troubleshooting

### Users can't book a resource
- Is the resource **active**? Reactivate it.
- Is the **booking policy** too strict? Change to `open`.
- Are there **group restrictions** the user doesn't meet? Check allowed groups.
- Is the resource **already booked**? Check conflicts.

### Duplicate email error when creating
Email addresses must be unique. Use a different address or reuse the existing resource.

### Resource doesn't appear in search
- Check `is_active` is `true`
- Match resource names with what users search for
- Verify filters (type, capacity) match the resource's actual attributes

---

## 📑 Related Documentation

- [API Documentation](RESOURCE_BOOKING_API_DOCUMENTATION.md) - Full endpoint reference
- [User Guide](RESOURCE_BOOKING_USER_GUIDE.md) - End-user documentation
- [Implementation Summary](RESOURCE_BOOKING_IMPLEMENTATION_SUMMARY.md) - Development overview

---

*Complete resource management: create, configure, monitor, and control every bookable resource.*