# Resource Booking - User Guide

**Feature**: Resource Booking (Tier 0 Foundation)  
**Version**: 1.0.0  
**Status**: ✅ Complete  
**Date**: 2025-08-21  

---

## 📖 What is Resource Booking?

Resource Booking lets you reserve shared resources like:

- 🏢 **Meeting Rooms** - Conference rooms, boardrooms, huddle spaces
- 💻 **Equipment** - Projectors, laptops, video conferencing kits
- 🚗 **Vehicles** - Company cars, vans, bikes
- 📦 **Other** - Parking spots, catering, anything bookable

When you book a resource, a calendar event is created automatically — the resource appears on your calendar just like any other attendee.

---

## 🚀 Getting Started

1. Log in to your SOGo6 account
2. Click **Resources** in the main navigation
3. Browse available resources using filters and search
4. Click a resource to see details and availability
5. Book it for your next meeting!

---

## 🔍 Browsing Resources

### The Resource List Page

The resource browser (`/resources`) shows all resources you can book.

**You can:**
- **Search** by name or description
- **Filter by type** (rooms, equipment, vehicles)
- **Filter by capacity** (minimum seats)
- **Filter by features** (projector, video conference, whiteboard)
- **Sort** results

**Resource cards show:**
- Name and type icon
- Capacity (for rooms)
- Location
- Key features
- Current availability status

---

## 📋 Viewing Resource Details

Click any resource to open the detail page (`/resources/[id]`).

**The detail page shows:**
- Full description
- Location and capacity
- All features
- Booking policy
- Available time slots
- **Book this resource** button

---

## 📅 Booking a Resource

### Option 1: Quick Book (from the list)

1. Click **Book** on any resource card
2. The Quick Booking modal opens
3. Pick your **start time** and **end time**
4. Give the booking a **title**
5. Add an optional description
6. Click **Confirm Booking**

> ⚡ Availability is checked in real-time as you select times. If there's a conflict, you'll see a warning immediately.

### Option 2: Full Booking (from the detail page)

1. Open the resource detail page
2. Select your date and time
3. Fill in the booking form
4. Choose options like **online meeting** or **location**
5. Click **Book**

### Option 3: Book while creating a calendar event

1. Create a new event in the calendar
2. Click **Add Resource** in the event form
3. Search and select resources
4. Resources appear as attendees with a 🏢/💻 icon
5. Save the event

> 💡 Calendar events with resources show a **resource badge** (icon + count) — you can see at a glance which meetings use resources.

---

## 📚 Managing Your Bookings

### View your bookings

Go to **My Bookings** in the Resources section to see all your upcoming bookings:
- Date and time
- Resource name
- Status
- Linked calendar event

### Cancel a booking

1. Find the booking in **My Bookings**
2. Click **Cancel**
3. Confirm the cancellation

The linked calendar event is also removed.

> ⏰ Cancel as early as possible so others can book the resource.

---

## ✅ Booking Policies

Resources can have different booking policies:

| Policy | Meaning |
|--------|---------|
| **Open** | Book instantly - confirmed immediately |
| **Moderated** | Booking is reviewed by a moderator first |
| **Restricted** | Only specific groups/people can book |

The policy is shown on the resource detail page before you book.

---

## ❓ Frequently Asked Questions

### Why can't I book a resource?
- The resource is **already booked** for that time — try another time slot
- The resource is **deactivated** by the administrator
- Your group is **not authorized** to book this resource
- The **time range is invalid** (end before start, or in the past)

### Where do my bookings appear?
All bookings create calendar events in your primary calendar. You'll see them alongside your regular meetings.

### Can I see which resources are available?
Yes! The **Resources** page has an **availability view** — select a time range and see only resources that are free.

### Can I book resources for others?
Currently each user books for themselves. If you need resources for a group, create a calendar event and add the resource + attendees together.

### How are conflicts prevented?
When you select a time, the system checks against all existing bookings. If the resource is taken, you're notified immediately. The backend enforces this check again when the booking is submitted — double-booking is impossible.

---

## 🎯 Tips & Best Practices

1. **Book early** - Popular rooms fill up fast
2. **Use capacity filters** - Don't book a 20-seat room for 2 people
3. **Add resources to calendar events** - Gives attendees visibility
4. **Check features** - Make sure the room has the projector/video kit you need
5. **Cancel promptly** - Free up resources for colleagues
6. **Use online meetings** - Save rooms when participants join remotely

---

## 🆘 Getting Help

- **Administrator**: For resource setup, deactivation, or policy changes
- **Bug reports**: Include the resource name, date/time, and error message
- **Feature requests**: Share with your admin team

---

*Resource Booking makes it easy to find and book the right resource for every meeting.*
