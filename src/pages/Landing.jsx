import { Link } from 'react-router-dom'
import './Landing.css'

const games = [
  {
    id: 'pipe-dodger',
    title: 'Pipe Dodger',
    description: 'Navigate a little bird through an endless gauntlet of pipes. How far can you go?',
    inspired: 'Inspired by classic side-scrollers',
    emoji: '🐦',
    path: '/pipe-dodger',
  },
  // More games coming soon
]

const classics = [
  {
    id: 'dino-run',
    title: 'Pumpkin Run',
    description: 'Jump yarn balls, duck flying dogs. Speed builds. How far can Pumpkin go?',
    original: 'Chrome No-Internet Game, ~2014',
    emoji: '🐱',
    path: '/dino-run',
  },
  {
    id: 'blackjack',
    title: 'Blackjack',
    description: 'Standard casino rules. Hit, stand, or double down. Start with $500 in chips — don\'t blow it.',
    original: 'Classic Casino Card Game',
    emoji: '🃏',
    path: '/blackjack',
  },
]

export default function Landing() {
  return (
    <div className="landing">
      <header className="hero">
        <div className="hero-inner">
          <h1 className="site-title">
            <span className="bracket">[</span>
            games<span className="accent">by</span>jeff
            <span className="bracket">]</span>
          </h1>
          <p className="tagline">A personal arcade — built for fun, not profit.</p>
        </div>
      </header>

      <section className="disclaimer-banner">
        <p>
          ⚠️ <strong>Just for fun!</strong> This site is a non-commercial, personal hobby project.
          All games are original implementations inspired by classic arcade mechanics.
          No original assets, code, or trademarks are used. No ads. No monetization. Ever.
        </p>
      </section>

      <main className="game-grid-section">
        <h2 className="section-heading">// games</h2>
        <div className="game-grid">
          {games.map((game) => (
            <Link to={game.path} key={game.id} className="game-card">
              <div className="game-emoji">{game.emoji}</div>
              <h3 className="game-title">{game.title}</h3>
              <p className="game-desc">{game.description}</p>
              <span className="game-inspired">{game.inspired}</span>
              <div className="play-btn">▶ PLAY</div>
            </Link>
          ))}

          <div className="game-card coming-soon">
            <div className="game-emoji">🕹️</div>
            <h3 className="game-title">More Coming Soon</h3>
            <p className="game-desc">New originals in progress. Check back soon.</p>
            <div className="play-btn muted">COMING SOON</div>
          </div>
        </div>
      </main>

      <section className="game-grid-section classics-section">
        <h2 className="section-heading classics-heading">// classics</h2>
        <p className="classics-subheading">Games I grew up with — rebuilt from scratch, pixel by pixel.</p>
        <div className="game-grid">
          {classics.map((game) => (
            <Link to={game.path} key={game.id} className="game-card classic-card">
              <div className="game-emoji">{game.emoji}</div>
              <h3 className="game-title">{game.title}</h3>
              <p className="game-desc">{game.description}</p>
              <span className="game-inspired classic-origin">Originally: {game.original}</span>
              <div className="play-btn classic-btn">▶ PLAY</div>
            </Link>
          ))}

          <div className="game-card coming-soon">
            <div className="game-emoji">👾</div>
            <h3 className="game-title">More From the Vault</h3>
            <p className="game-desc">Snake, Breakout, Asteroids, Pac-Man... the greats are coming.</p>
            <div className="play-btn muted">COMING SOON</div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <p>
          Built by <a href="https://jeffreyaslaven.com" target="_blank" rel="noopener noreferrer">Jeffrey Slaven</a>
          &nbsp;·&nbsp; Non-commercial hobby project
        </p>
        <p className="footer-small">
          Game mechanics are inspired by classics. All code and art are original.
          No affiliation with original game creators.
        </p>
      </footer>
    </div>
  )
}
