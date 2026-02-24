# TimeZoneApp

## Overview
A web app for converting times between time zones. Users select a date/time, search for a destination location (by city, zip code, country, or timezone name), and see the converted time formatted in military time. Features a dynamic weather-aware background that reflects the user's real local weather and time of day.

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS (static site, no build step)
- **Styling**: Tailwind CSS (CDN)
- **Date/Time**: Luxon library (CDN) for timezone conversion and formatting
- **Geocoding**: Nominatim (OpenStreetMap) - free, no API key
- **Timezone Lookup**: timeapi.io - free, no API key
- **IP Geolocation**: ip-api.com - free, no API key
- **Weather**: Open-Meteo API - free, no API key
- **Hosting**: Firebase Hosting with Cloudflare domain

## Project Structure
- `public/` - Static files served by Firebase Hosting
  - `index.html` - Main page (includes weather layer elements)
  - `style.css` - Custom styles (sky, weather effects, clouds, celestials)
  - `app.js` - Application logic (timezone conversion + weather system)
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
- Weather and celestial effects are 100% CSS + canvas (no image assets)

## Weather & Time-of-Day System

### State Code Format
Each visual state is encoded as `{hour}{letter}`:
- **hour** = 0-23 (military time)
- **letter** = weather condition (sequential: a through g)

### Weather Letter Codes
| Letter | Weather        |
|--------|----------------|
| a      | Clear / Sunny  |
| b      | Partly Cloudy  |
| c      | Overcast       |
| d      | Rain           |
| e      | Thunderstorm   |
| f      | Snow           |
| g      | Fog / Mist     |

### Visual Layers (z-order, back to front)
1. Sky gradient background (CSS pseudo-elements on body, dimmed by weather)
2. Stars canvas (`#stars-canvas`) - twinkling, fade with time + weather
3. Sun (`#weather-sun`) - CSS radial gradient with rotating conic rays
4. Moon (`#weather-moon`) - CSS crescent via box-shadow
5. Gloom overlay (`#weather-gloom`) - grey wash for overcast/rain/storm/fog
6. Clouds (`#weather-clouds`) - CSS shapes with drift animation
7. Precipitation canvas (`#weather-canvas`) - rain drops or snowflakes
8. Fog overlay (`#weather-fog`) - full-screen gradient for fog/mist
9. Lightning flash (`#weather-lightning`) - random white flash for thunderstorms
10. UI content (z-index: 1)
11. Footer (`#footer-link`) - weather-themed color, always legible

### Console API for Testing
Open browser DevTools (F12) and use:
```js
setWeatherState("14a")  // Set to 2pm clear
setWeatherState("3f")   // Set to 3am snow
setWeatherState("20d")  // Set to 8pm rain
getWeatherState()       // Show current state code
resetWeather()          // Return to auto-detected weather
weatherHelp()           // Print full help text
```

### Auto-Detection Flow
1. IP geolocation via ip-api.com -> lat/lon
2. Weather via Open-Meteo API (WMO codes) -> mapped to letter a-g
3. Local clock hour -> combined into state code
4. Updates every 30 seconds; weather re-fetched on page load
