import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../data');
const CACHE_FILE = join(DATA_DIR, 'cache.json');

// Neynar API key
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || 'D53C3CBA-B9D4-4277-A813-DA5AC37BB1C5';

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// Cache interface
interface CacheEntry {
  data: any;
  timestamp: number;
}

interface Cache {
  users: Record<string, CacheEntry>;
}

// Load/save cache
function loadCache(): Cache {
  try {
    if (existsSync(CACHE_FILE)) {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading cache:', e);
  }
  return { users: {} };
}

function saveCache(cache: Cache): void {
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// Get cached user stats (1 hour TTL)
function getCachedStats(username: string): any | null {
  const cache = loadCache();
  const entry = cache.users[username];
  if (entry && Date.now() - entry.timestamp < 3600000) { // 1 hour
    return entry.data;
  }
  return null;
}

function setCachedStats(username: string, data: any): void {
  const cache = loadCache();
  cache.users[username] = { data, timestamp: Date.now() };
  saveCache(cache);
}

// Neynar API helpers
async function fetchUserByUsername(username: string): Promise<any> {
  const response = await fetch(
    `https://api.neynar.com/v2/farcaster/user/by_username?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY,
      },
    }
  );
  if (!response.ok) throw new Error('User not found');
  const data = await response.json();
  return data.user;
}

async function fetchUserCasts(fid: number, cursor?: string): Promise<any> {
  const url = new URL(`https://api.neynar.com/v2/farcaster/feed/user/${fid}/casts`);
  url.searchParams.set('limit', '150');
  if (cursor) url.searchParams.set('cursor', cursor);
  
  const response = await fetch(url.toString(), {
    headers: {
      'accept': 'application/json',
      'api_key': NEYNAR_API_KEY,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch casts');
  return response.json();
}

// Vibe calculation
function getVibeFromStats(stats: any): string {
  const engagementRate = stats.totalCasts > 0 
    ? (stats.totalLikes + stats.totalRecasts) / stats.totalCasts 
    : 0;
  
  if (engagementRate > 10) {
    return "🌟 The Influencer - Your casts hit different. People don't just read, they react!";
  }
  
  if (engagementRate > 5) {
    return "💫 The Resonator - You've found your voice, and the timeline loves it";
  }
  
  if (stats.avgCastsPerDay > 5) {
    return "⚡ The Power Poster - You're basically a Farcaster full-timer. Touch grass? Never heard of it.";
  }
  
  if (stats.avgCastsPerDay > 2) {
    return "🔥 The Regular - Consistent presence, reliable content. You're the backbone of FC.";
  }
  
  if (stats.mostActiveHour >= 0 && stats.mostActiveHour <= 5) {
    return "🌙 The Night Owl - 3AM casts hit different. Your best ideas come when everyone's asleep.";
  }
  
  if (stats.mostActiveHour >= 6 && stats.mostActiveHour <= 9) {
    return "☀️ The Early Bird - Morning coffee + casting. You're starting conversations before most wake up.";
  }
  
  if (stats.totalLikes > stats.totalRecasts * 3) {
    return "❤️ The Heart Collector - People love what you say but keep it to themselves. Silent admirers unite!";
  }
  
  if (stats.totalRecasts > stats.totalLikes) {
    return "🔄 The Signal Booster - Your casts are so good people need to share. Viral energy!";
  }
  
  if (stats.followerCount > 10000) {
    return "👑 The OG - You've built a kingdom. The timeline bends to your will.";
  }
  
  if (stats.followerCount > 1000) {
    return "🚀 Rising Star - You're on the up and up. The algorithm favors you.";
  }
  
  if (stats.mostActiveDay === 'Saturday' || stats.mostActiveDay === 'Sunday') {
    return "🎉 The Weekend Warrior - You save your best content for when it matters most.";
  }
  
  if (stats.mostActiveDay === 'Monday') {
    return "💪 The Monday Motivator - Starting weeks strong. Your energy is unmatched.";
  }
  
  if (stats.totalCasts < 10) {
    return "🌱 The Seedling - Just getting started! Your best casts are ahead of you.";
  }
  
  if (stats.avgCastsPerDay < 0.5) {
    return "🎯 The Sniper - Quality over quantity. When you speak, people listen.";
  }
  
  const defaultVibes = [
    "🎨 The Creative - You bring unique perspectives to the timeline",
    "🤝 The Connector - Building bridges one cast at a time",
    "🧠 The Thinker - Thoughtful takes in a sea of shitposts",
    "✨ The Authentic - You keep it real, and people respect that",
    "🎪 The Entertainer - Making the timeline a better place",
  ];
  
  const index = (stats.totalCasts + stats.followerCount) % defaultVibes.length;
  return defaultVibes[index];
}

// Calculate stats for a user
async function calculateStats(username: string): Promise<any> {
  // Check cache first
  const cached = getCachedStats(username);
  if (cached) {
    console.log(`Cache hit for ${username}`);
    return cached;
  }

  console.log(`Fetching stats for ${username}`);
  
  // Fetch user info
  const user = await fetchUserByUsername(username);
  
  // Fetch casts (up to 300)
  let allCasts: any[] = [];
  let cursor: string | undefined;
  
  for (let i = 0; i < 2; i++) {
    const castsResponse = await fetchUserCasts(user.fid, cursor);
    allCasts = [...allCasts, ...castsResponse.casts];
    cursor = castsResponse.next?.cursor;
    if (!cursor) break;
  }
  
  // Calculate stats
  let totalLikes = 0;
  let totalRecasts = 0;
  let topCast: any = null;
  let maxEngagement = 0;
  
  const dayCount: Record<string, number> = {};
  const hourCount: Record<number, number> = {};
  
  for (const cast of allCasts) {
    const likes = cast.reactions?.likes_count || 0;
    const recasts = cast.reactions?.recasts_count || 0;
    totalLikes += likes;
    totalRecasts += recasts;
    
    const engagement = likes + recasts;
    if (engagement > maxEngagement) {
      maxEngagement = engagement;
      topCast = {
        text: cast.text,
        likes,
        recasts,
        timestamp: cast.timestamp,
      };
    }
    
    const date = new Date(cast.timestamp);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    const hour = date.getHours();
    
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
    hourCount[hour] = (hourCount[hour] || 0) + 1;
  }
  
  let mostActiveDay = 'Monday';
  let maxDayCount = 0;
  for (const [day, count] of Object.entries(dayCount)) {
    if (count > maxDayCount) {
      maxDayCount = count;
      mostActiveDay = day;
    }
  }
  
  let mostActiveHour = 12;
  let maxHourCount = 0;
  for (const [hour, count] of Object.entries(hourCount)) {
    if (count > maxHourCount) {
      maxHourCount = count;
      mostActiveHour = parseInt(hour);
    }
  }
  
  const dates = new Set(allCasts.map(c => new Date(c.timestamp).toDateString()));
  const avgCastsPerDay = dates.size > 0 ? allCasts.length / dates.size : 0;
  
  const stats = {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name || user.username,
    pfpUrl: user.pfp_url,
    followerCount: user.follower_count || 0,
    followingCount: user.following_count || 0,
    totalCasts: allCasts.length,
    totalLikes,
    totalRecasts,
    topCast,
    avgCastsPerDay: Math.round(avgCastsPerDay * 10) / 10,
    mostActiveDay,
    mostActiveHour,
  };
  
  const result = {
    ...stats,
    vibe: getVibeFromStats(stats),
  };
  
  // Cache the result
  setCachedStats(username, result);
  
  return result;
}

const app = new Hono();

// CORS for development
app.use('/api/*', cors());

// API: Get user stats
app.get('/api/stats/:username', async (c) => {
  const username = c.req.param('username');
  
  try {
    const stats = await calculateStats(username);
    return c.json({ success: true, stats });
  } catch (e: any) {
    console.error('Error fetching stats:', e);
    return c.json({ success: false, error: e.message }, 500);
  }
});

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Frame POST handler
app.post('/frame', async (c) => {
  try {
    const appUrl = process.env.APP_URL || 'https://fc-wrapped-frame-production.up.railway.app';
    
    return c.html(`
<!DOCTYPE html>
<html>
<head>
  <meta property="fc:frame" content="vNext" />
  <meta property="fc:frame:image" content="${appUrl}/og.png" />
  <meta property="fc:frame:button:1" content="📊 See My Wrapped" />
  <meta property="fc:frame:button:1:action" content="link" />
  <meta property="fc:frame:button:1:target" content="${appUrl}" />
</head>
</html>
    `);
  } catch (e) {
    console.error('Frame error:', e);
    return c.json({ error: 'Frame error' }, 500);
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // Serve .well-known for Frame manifest
  app.use('/.well-known/*', serveStatic({ root: './dist' }));
  
  // Serve static assets
  app.use('/assets/*', serveStatic({ root: './dist' }));
  app.use('/og.png', serveStatic({ root: './dist', path: '/og.png' }));
  app.use('/og.svg', serveStatic({ root: './dist', path: '/og.svg' }));
  app.use('/icon.svg', serveStatic({ root: './dist', path: '/icon.svg' }));
  app.use('/icon.png', serveStatic({ root: './dist', path: '/icon.png' }));
  app.use('/splash.png', serveStatic({ root: './dist', path: '/splash.png' }));
  
  // Serve index.html for all other routes (SPA fallback)
  app.get('*', (c) => {
    const html = readFileSync(join(__dirname, '../dist/index.html'), 'utf-8');
    return c.html(html);
  });
}

const port = parseInt(process.env.PORT || '3001');
console.log(`📊 FC Wrapped API running on port ${port}`);

serve({ fetch: app.fetch, port });

export default app;
