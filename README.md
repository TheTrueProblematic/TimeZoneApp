# Time Zone Converter

A fast, minimal web app for converting times between time zones. Enter a date and time, search for any destination by city, zip code, country, or timezone abbreviation, and get a cleanly formatted result ready to copy and share.

## Features

- **Flexible time input** - Defaults to your current local time; adjustable to any date and minute
- **Smart location search** - Accepts cities, US zip codes, countries, and timezone abbreviations (EST, GMT, JST, etc.)
- **Automatic DST handling** - Daylight saving time is resolved correctly for any date
- **Military time output** - Results formatted as `15:21 MST, Thursday March 5th`
- **One-click copy** - Copy the converted time as plain text
- **Responsive design** - Works on desktop and mobile
- **No accounts or sign-ups** - Just open and use

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
