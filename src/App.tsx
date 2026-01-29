import { useEffect, useState, useCallback } from 'react'
import sdk from '@farcaster/frame-sdk'
import './index.css'

interface UserStats {
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  followerCount: number
  followingCount: number
  totalCasts: number
  totalLikes: number
  totalRecasts: number
  topCast: {
    text: string
    likes: number
    recasts: number
    timestamp: string
  } | null
  avgCastsPerDay: number
  mostActiveDay: string
  mostActiveHour: number
  vibe: string
}

type ViewState = 'start' | 'loading' | 'stats' | 'error'

export default function App() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)
  const [viewState, setViewState] = useState<ViewState>('start')
  const [stats, setStats] = useState<UserStats | null>(null)
  const [error, setError] = useState<string>('')
  const [context, setContext] = useState<any>(null)
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    const init = async () => {
      try {
        const ctx = await sdk.context
        setContext(ctx)
        await sdk.actions.ready()
        setIsSDKLoaded(true)
      } catch (err) {
        console.error('SDK init error:', err)
        // Still allow the app to work (for testing outside Warpcast)
        setIsSDKLoaded(true)
      }
    }
    init()
  }, [])

  const loadStats = useCallback(async () => {
    const username = context?.user?.username
    
    if (!username) {
      setError('Could not get your Farcaster username. Open in Warpcast!')
      setViewState('error')
      return
    }
    
    setViewState('loading')
    setSlideIndex(0)
    
    try {
      const response = await fetch(`/api/stats/${encodeURIComponent(username)}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load stats')
      }
      
      setStats(data.stats)
      setViewState('stats')
    } catch (err) {
      console.error('Error loading stats:', err)
      setError('Failed to load your stats. Try again!')
      setViewState('error')
    }
  }, [context])

  const shareToFarcaster = useCallback(async () => {
    if (!stats) return
    
    const text = `📊 My FC Wrapped:\n\n📝 ${stats.totalCasts} casts\n❤️ ${stats.totalLikes} likes received\n🔄 ${stats.totalRecasts} recasts\n\nMy vibe: ${stats.vibe.split(' - ')[0]}\n\nGet your Wrapped 👇`
    
    try {
      await sdk.actions.composeCast({
        text,
        embeds: ['https://fc-wrapped-frame-production.up.railway.app'],
      })
    } catch (err) {
      console.error('Error sharing:', err)
    }
  }, [stats])

  const nextSlide = () => setSlideIndex(i => Math.min(i + 1, 4))
  const prevSlide = () => setSlideIndex(i => Math.max(i - 1, 0))

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewState !== 'stats') return
      if (e.key === 'ArrowRight') nextSlide()
      if (e.key === 'ArrowLeft') prevSlide()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [viewState])

  // Handle swipe navigation
  useEffect(() => {
    if (viewState !== 'stats') return
    
    let touchStartX = 0
    let touchEndX = 0
    
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX
    }
    
    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX
      const diff = touchStartX - touchEndX
      if (Math.abs(diff) > 50) {
        if (diff > 0) nextSlide()
        else prevSlide()
      }
    }
    
    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchend', handleTouchEnd)
    
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [viewState])

  if (!isSDKLoaded) {
    return (
      <div className="app">
        <div className="loading-screen">
          <span className="loading-icon">📊</span>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {viewState === 'start' && (
        <div className="start-screen">
          <div className="hero-icon">📊</div>
          <h1 className="title">FC Wrapped</h1>
          <p className="tagline">Your Farcaster story, beautifully told</p>
          
          <div className="features">
            <div className="feature">📝 Total Casts</div>
            <div className="feature">❤️ Likes Received</div>
            <div className="feature">🔄 Recasts</div>
            <div className="feature">⭐ Top Moments</div>
            <div className="feature">🎭 Your Vibe</div>
          </div>
          
          <button className="start-btn" onClick={loadStats}>
            ✨ See My Wrapped
          </button>
          
          {context?.user && (
            <p className="user-hint">Ready for @{context.user.username}</p>
          )}
          
          {!context?.user && (
            <p className="user-hint user-hint-warning">Open in Warpcast for full experience</p>
          )}
        </div>
      )}

      {viewState === 'loading' && (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p className="loading-text">Crunching your numbers...</p>
          <p className="loading-subtext">Analyzing your casts ✨</p>
        </div>
      )}

      {viewState === 'error' && (
        <div className="error-screen">
          <span className="error-icon">😕</span>
          <p className="error-text">{error}</p>
          <button className="retry-btn" onClick={() => setViewState('start')}>
            Go Back
          </button>
        </div>
      )}

      {viewState === 'stats' && stats && (
        <div className="stats-container">
          {/* Slide 0: Overview */}
          {slideIndex === 0 && (
            <div className="slide slide-overview">
              <div className="slide-content">
                <img src={stats.pfpUrl} alt="" className="pfp" />
                <h2 className="stat-name">@{stats.username}</h2>
                <p className="stat-subtitle">Your Farcaster Wrapped</p>
                
                <div className="stat-grid">
                  <div className="stat-item">
                    <span className="stat-number">{stats.totalCasts.toLocaleString()}</span>
                    <span className="stat-label">Casts</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.totalLikes.toLocaleString()}</span>
                    <span className="stat-label">Likes</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{stats.totalRecasts.toLocaleString()}</span>
                    <span className="stat-label">Recasts</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slide 1: Engagement */}
          {slideIndex === 1 && (
            <div className="slide slide-engagement">
              <div className="slide-content">
                <span className="slide-emoji">🔥</span>
                <h2 className="slide-title">Your Engagement</h2>
                
                <div className="big-stat">
                  <span className="big-number">{(stats.totalLikes + stats.totalRecasts).toLocaleString()}</span>
                  <span className="big-label">Total Interactions</span>
                </div>
                
                <div className="engagement-breakdown">
                  <div className="engagement-row">
                    <span>❤️ Likes</span>
                    <span className="engagement-value">{stats.totalLikes.toLocaleString()}</span>
                  </div>
                  <div className="engagement-row">
                    <span>🔄 Recasts</span>
                    <span className="engagement-value">{stats.totalRecasts.toLocaleString()}</span>
                  </div>
                  <div className="engagement-row">
                    <span>👥 Followers</span>
                    <span className="engagement-value">{stats.followerCount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Slide 2: Patterns */}
          {slideIndex === 2 && (
            <div className="slide slide-patterns">
              <div className="slide-content">
                <span className="slide-emoji">📅</span>
                <h2 className="slide-title">Your Patterns</h2>
                
                <div className="pattern-card">
                  <span className="pattern-label">Most Active Day</span>
                  <span className="pattern-value">{stats.mostActiveDay}</span>
                </div>
                
                <div className="pattern-card">
                  <span className="pattern-label">Peak Hour</span>
                  <span className="pattern-value">
                    {stats.mostActiveHour > 12 
                      ? `${stats.mostActiveHour - 12} PM` 
                      : stats.mostActiveHour === 0 
                        ? '12 AM' 
                        : stats.mostActiveHour === 12
                          ? '12 PM'
                          : `${stats.mostActiveHour} AM`}
                  </span>
                </div>
                
                <div className="pattern-card">
                  <span className="pattern-label">Avg Casts/Day</span>
                  <span className="pattern-value">{stats.avgCastsPerDay}</span>
                </div>
              </div>
            </div>
          )}

          {/* Slide 3: Top Cast */}
          {slideIndex === 3 && (
            <div className="slide slide-top">
              <div className="slide-content">
                <span className="slide-emoji">⭐</span>
                <h2 className="slide-title">Your Top Cast</h2>
                
                {stats.topCast ? (
                  <div className="top-cast-card">
                    <p className="top-cast-text">"{stats.topCast.text.slice(0, 180)}{stats.topCast.text.length > 180 ? '...' : ''}"</p>
                    <div className="top-cast-stats">
                      <span>❤️ {stats.topCast.likes}</span>
                      <span>🔄 {stats.topCast.recasts}</span>
                    </div>
                  </div>
                ) : (
                  <p className="no-top-cast">Keep casting to find your top moment!</p>
                )}
              </div>
            </div>
          )}

          {/* Slide 4: Vibe */}
          {slideIndex === 4 && (
            <div className="slide slide-vibe">
              <div className="slide-content">
                <span className="slide-emoji">🎭</span>
                <h2 className="slide-title">Your Vibe</h2>
                
                <div className="vibe-card">
                  <p className="vibe-text">{stats.vibe}</p>
                </div>
                
                <button className="share-btn" onClick={shareToFarcaster}>
                  📢 Share My Wrapped
                </button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="nav-controls">
            <button 
              className="nav-btn" 
              onClick={prevSlide} 
              disabled={slideIndex === 0}
            >
              ←
            </button>
            
            <div className="nav-dots">
              {[0, 1, 2, 3, 4].map(i => (
                <span 
                  key={i} 
                  className={`nav-dot ${slideIndex === i ? 'active' : ''}`}
                  onClick={() => setSlideIndex(i)}
                />
              ))}
            </div>
            
            <button 
              className="nav-btn" 
              onClick={nextSlide} 
              disabled={slideIndex === 4}
            >
              →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
