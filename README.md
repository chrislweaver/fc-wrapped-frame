# FC Wrapped 📊

A Farcaster Mini App that generates Spotify Wrapped-style stats for your Farcaster activity.

## Features

- **5 Spotify-style slides** with beautiful gradient backgrounds
- **Engagement stats**: Total casts, likes, recasts
- **Posting patterns**: Most active day, peak hour, avg casts/day
- **Top cast**: Your most engaging cast
- **Personality vibe**: 16+ unique vibes based on your activity
- **Share to Farcaster**: One-tap sharing with embedded link

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript
- **Backend**: Hono server (Node.js)
- **Farcaster**: Frame SDK for native Mini App experience
- **Data**: Neynar API for Farcaster data
- **Hosting**: Railway

## Development

```bash
# Install dependencies
npm install

# Run dev server (frontend + backend)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `NEYNAR_API_KEY`: Neynar API key (has default fallback for development)
- `PORT`: Server port (default: 3001)
- `APP_URL`: Production URL for frame embeds

## Deployment

### Railway

1. Connect repo to Railway
2. Set environment variables
3. Deploy!

The `railway.json` configures:
- Build: Nixpacks
- Start: `npm run start`
- Health check: `/api/health`

## API Endpoints

- `GET /api/stats/:username` - Get user stats
- `GET /api/health` - Health check
- `POST /frame` - Frame action handler

## Frame Manifest

The `.well-known/farcaster.json` manifest needs to be signed with your Farcaster account for verification. Update the payload with your domain and sign with your custody key.

## License

MIT
