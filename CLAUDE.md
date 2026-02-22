# TimeZoneApp

## Overview
A web app for converting times between time zones. Users select a date/time, search for a destination location (by city, zip code, country, or timezone name), and see the converted time formatted in military time.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (static site, no build step)
- **Styling**: Tailwind CSS (CDN)
- **Date/Time**: Luxon library (CDN) for timezone conversion and formatting
- **Geocoding**: Nominatim (OpenStreetMap) - free, no API key
- **Timezone Lookup**: timeapi.io - free, no API key
- **Hosting**: Firebase Hosting with Cloudflare domain

## Project Structure
- `public/` - Static files served by Firebase Hosting
  - `index.html` - Main page
  - `style.css` - Custom styles
  - `app.js` - Application logic
- `firebase.json` - Firebase hosting configuration
- `.firebaserc` - Firebase project alias

## Development
Open `public/index.html` directly in a browser for local testing.

## Deployment
```bash
firebase login
firebase deploy
```

## Key Design Decisions
- All APIs used are free and require no API keys (no secrets to manage)
- Reference time is stored internally as UTC
- User's local timezone is auto-detected via browser API
- Luxon handles all DST-aware timezone conversions
