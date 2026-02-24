# Half Past Where?

A fast, polished web app for converting times between time zones. Enter a date and time, search for any destination by city, zip code, country, or timezone abbreviation, and get a cleanly formatted result ready to copy and share — all set against a living sky that mirrors both the time of day and the real weather outside your window.

## Features

- **Flexible time input** - Defaults to your current local time; adjustable to any date and minute
- **Smart location search** - Accepts cities, US zip codes, countries, and timezone abbreviations (EST, GMT, JST, etc.)
- **Automatic DST handling** - Daylight saving time is resolved correctly for any date
- **Military time output** - Results formatted as `15:21 MST, Thursday March 5th`
- **One-click copy** - Copy the converted time as plain text
- **Responsive design** - Aspect-ratio-based layout that adapts to any screen shape
- **No accounts or sign-ups** - Just open and use
- **Dynamic sky background** - Time-aware visuals that change throughout the day
- **Live weather effects** - Auto-detects your location and shows real weather conditions
- **Cartoony CSS weather** - Sun, moon, clouds, rain, snow, thunderstorms, and fog — all built with pure CSS and canvas, no image assets

## Dynamic Sky

The background is a living sky that reflects your local time of day, built with 20 hand-tuned color phases and smooth interpolation between them.

| Time of Day | Colors |
|---|---|
| Night (9pm - 4am) | Deep inky blacks, dark navies, subtle purple undertones |
| Pre-dawn (4:30 - 5:30am) | Deep plum and dark violet emerging at the horizon |
| Dawn (5:30 - 6:30am) | Rich pinks and magentas bleeding upward |
| Sunrise (6:30 - 7:30am) | Warm oranges, golds, and coral streaks fading to purple above |
| Early morning (7:30 - 8:30am) | Golden light transitioning into soft blue |
| Morning (8:30 - 10am) | Clean, brightening light blues |
| Midday (10am - 2pm) | Vivid sky blues with a soft white glow |
| Afternoon (2 - 4pm) | Deeper blues with warm undertones |
| Golden hour (4 - 5:45pm) | Amber and orange horizon with deepening blue sky |
| Sunset (5:45 - 6:30pm) | Intense reds, corals, and pinks with purple above |
| Dusk (6:30 - 8pm) | Deep magentas fading to violet and navy |
| Twilight (8 - 9:30pm) | Last traces of color dissolving into night |

## Weather System

The site auto-detects your approximate location (via IP) and fetches the current weather conditions (via Open-Meteo). The background responds with visual effects:

| Weather | Visual Effect |
|---|---|
| Clear | Full sun/moon, bright sky, twinkling stars at night |
| Partly Cloudy | A few drifting CSS clouds, slightly dimmed sun |
| Overcast | Dense grey cloud cover, very dim sun |
| Rain | Animated rain streaks on canvas, dark clouds |
| Thunderstorm | Rain + periodic lightning flashes, ominous storm clouds |
| Snow | Animated falling snowflakes, light ground fog |
| Fog | Translucent gradient overlay, reduced visibility |

### Visual Effects

- **CSS Sun** - Radial gradient circle with rotating conic ray pattern and multi-layer glow, following a parabolic arc across the sky
- **CSS Moon** - Crescent created with box-shadow technique and subtle crater details, arcing through the night sky
- **CSS Clouds** - Pure CSS shapes with border-radius, animated drift, and variants for day/night/overcast/storm
- **Canvas Rain** - 200 individually animated rain streaks with wind angle and varied opacity
- **Canvas Snow** - 150 snowflakes with sinusoidal wobble, variable size, and gentle drift
- **Lightning** - Random white-flash overlay with double-flash probability for thunderstorms
- **Fog** - Multi-stop gradient overlay with gentle drift animation
- **Twinkling stars** - 120 individually animated stars that dim in cloudy weather and fade at dawn/dusk
- **30-second refresh cycle** - Sky and weather update automatically

### Weather State Codes

Each visual state is represented internally as a code: `{hour}{letter}`

- **Hour**: 0-23 (military time)
- **Letter**: Weather condition (assigned sequentially)

| Letter | Weather |
|---|---|
| `a` | Clear / Sunny |
| `b` | Partly Cloudy |
| `c` | Cloudy / Overcast |
| `d` | Rain |
| `e` | Thunderstorm |
| `f` | Snow |
| `g` | Fog / Mist |

**Examples**: `14a` = 2pm clear, `3f` = 3am snow, `20d` = 8pm rain, `0a` = midnight clear

### Testing Weather States via Console

Open your browser's Developer Tools (F12) and use these commands in the Console tab:

```js
// Set a specific state
setWeatherState("14a")   // 2pm, clear sky
setWeatherState("22f")   // 10pm, snow
setWeatherState("6e")    // 6am, thunderstorm
setWeatherState("15g")   // 3pm, fog
setWeatherState("12b")   // Noon, partly cloudy
setWeatherState("0a")    // Midnight, clear
setWeatherState("20d")   // 8pm, rain

// Check current state
getWeatherState()

// Return to auto-detected weather
resetWeather()

// Show full help
weatherHelp()
```

The bottom-right corner shows a small badge with the current state code for reference.

## How It Works

1. **Set your reference time** - The app detects your local timezone automatically and defaults to now
2. **Search for a destination** - Type a location or timezone into the search box
3. **Confirm the result** - A confirmation dialog shows the resolved location and timezone
4. **Copy the output** - The converted time appears in military format, ready to copy

### Supported Search Inputs

| Input Type | Example | Result |
|---|---|---|
| US zip code | `80501` | Longmont, CO (America/Denver) |
| City name | `Denver` | Denver, CO (America/Denver) |
| Country | `China` | China (Asia/Shanghai) |
| Timezone abbreviation | `GMT` | Etc/GMT |
| IANA timezone | `America/New_York` | America/New_York |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Styling | [Tailwind CSS](https://tailwindcss.com) (CDN) |
| Date/Time | [Luxon](https://moment.github.io/luxon/) (CDN) |
| Geocoding | [Nominatim / OpenStreetMap](https://nominatim.openstreetmap.org) |
| Timezone lookup | [TimeAPI.io](https://timeapi.io) |
| IP Geolocation | [ip-api.com](http://ip-api.com) |
| Weather | [Open-Meteo](https://open-meteo.com) |
| Hosting | [Firebase Hosting](https://firebase.google.com/products/hosting) |
| Domain/DNS | [Cloudflare](https://cloudflare.com) |

No API keys are required. All external services used are free and public.

## Project Structure

```
TimeZoneApp/
├── public/
│   ├── index.html      Main application page
│   ├── style.css       Custom styles and animations
│   ├── app.js          Application logic
│   └── 404.html        Error page
├── firebase.json       Firebase Hosting configuration
├── CLAUDE.md           Development notes
├── LICENSE             License file
└── README.md
```

## Local Development

No build step is needed. Open the app directly in a browser:

```bash
open public/index.html
```

Or serve it locally with any static file server:

```bash
npx serve public
```

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org) installed
- A [Firebase](https://firebase.google.com) project created

### Steps

```bash
# Install the Firebase CLI
npm install -g firebase-tools

# Authenticate
firebase login

# Link to your Firebase project
firebase use --add

# Deploy
firebase deploy
```

Your app will be live at `https://<your-project>.web.app`.

### Custom Domain (Cloudflare)

1. In the Firebase Console, go to **Hosting > Custom domain** and add your domain
2. In Cloudflare, add the DNS records Firebase provides (typically an A record or CNAME)
3. Wait for SSL provisioning to complete

## License

See [LICENSE](LICENSE) for details.
