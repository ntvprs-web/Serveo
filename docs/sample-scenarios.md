# SERVEO sample scenarios

These records are examples for local walkthroughs and API testing. They are not real people, organizations, requests, or impact results. Do not load sample records into a public deployment.

## Organizer trust and event safety

```json
{
  "organizer": { "name": "Demo Relief Collective", "email": "organizer@example.invalid", "organizationType": "ngo", "verificationStatus": "pending" },
  "document": { "fileName": "demo-authorization.pdf", "mimeType": "application/pdf", "maxSizeBytes": 5242880 },
  "event": { "title": "Demo Flood Relief Supply Drive", "category": "disaster", "city": "Patna", "date": "2026-12-12", "status": "approved" },
  "report": { "reason": "outdated", "note": "Walkthrough report; verify the supplied event time." }
}
```

## Blood donation and matching

```json
{
  "donor": { "displayName": "Demo Donor One", "bloodGroup": "O+", "city": "Delhi", "lastDonationDate": "2026-01-01", "cooldownDays": 90 },
  "donation": { "donationDate": "2026-05-15", "city": "Delhi", "status": "confirmed", "confirmedBy": "demo-blood-bank" },
  "stock": { "organization": "Demo City Blood Bank", "city": "Delhi", "bloodGroup": "AB+", "needLevel": "critical", "updatedAt": "2026-11-24T10:00:00+05:30" },
  "urgentRequest": { "patientName": "Demo Patient", "bloodGroup": "AB+", "units": 2, "hospital": "Demo General Hospital", "city": "Delhi", "lat": 28.6139, "lng": 77.2090 },
  "match": { "donorGroup": "O+", "compatibility": "compatible", "wave": 1, "contactShared": false }
}
```

Eligibility quiz answers should stay in the browser. Only the donor-selected last donation date and cooldown are persisted.

## Food handover

```json
{
  "restaurant": { "name": "Demo Kitchen", "organizationType": "restaurant", "verificationStatus": "approved" },
  "post": { "itemDescription": "Sealed vegetable rice meals", "approximateMeals": 24, "cookedAt": "2026-11-24T12:00:00+05:30", "pickupBy": "2026-11-24T15:30:00+05:30", "city": "Delhi", "status": "completed" },
  "recipient": { "name": "Demo Neighborhood NGO", "organizationType": "ngo", "verificationStatus": "approved" },
  "handover": { "restaurantConfirmed": true, "recipientConfirmed": true }
}
```

## Impact and volunteer attendance

```json
{
  "event": { "title": "Demo Community Health Camp", "city": "Delhi", "outcome": "event_held" },
  "attendance": { "volunteer": "Demo Volunteer One", "checkedInAt": "2026-11-24T09:00:00+05:30", "checkedOutAt": "2026-11-24T11:30:00+05:30", "hours": 2.5 },
  "impactExample": { "eventsHeld": 1, "donationsConfirmed": 1, "mealsDelivered": 24, "volunteerHours": 2.5, "citiesCovered": 1 }
}
```

`hours` and impact totals are computed from server records; do not submit the example totals as authoritative values.

## Disaster response and demand map

```json
{
  "disasterMode": { "active": true, "reason": "Demo monsoon response exercise", "region": "Patna", "endsAt": "2026-11-25T18:00:00+05:30" },
  "demandPoints": [
    { "kind": "urgent-blood-request", "city": "Patna", "lat": 25.5941, "lng": 85.1376, "weight": 1 },
    { "kind": "critical-blood-stock", "city": "Patna", "lat": 25.6010, "lng": 85.1200, "weight": 3 },
    { "kind": "unclaimed-food-post", "city": "Patna", "lat": 25.6100, "lng": 85.1500, "weight": 1 }
  ]
}
```

The live impact charts and admin heatmap use database records. Empty filters are shown as “No data yet”; these examples are only walkthrough inputs.
