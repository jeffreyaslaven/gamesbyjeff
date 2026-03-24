import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import './Blackjack.css'

// ── Deck helpers ─────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣']
const VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

const SHOE_OPTIONS = [1, 2, 4, 6, 8]
// Reshuffle when ~25% of shoe remains (casino penetration)
function reshufflePoint(numDecks) { return Math.floor(numDecks * 52 * 0.25) }

function createShoe(numDecks = 1) {
  const deck = []
  for (let d = 0; d < numDecks; d++)
    for (const suit of SUITS)
      for (const value of VALUES)
        deck.push({ suit, value })
  return shuffle(deck)
}

function shuffle(deck) {
  const d = [...deck]
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[d[i], d[j]] = [d[j], d[i]]
  }
  return d
}

function cardNumeric(card) {
  if (['J', 'Q', 'K'].includes(card.value)) return 10
  if (card.value === 'A') return 11
  return parseInt(card.value)
}

function handTotal(hand) {
  let total = 0
  let aces = 0
  for (const card of hand) {
    total += cardNumeric(card)
    if (card.value === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  return total
}

function dealerShouldHit(hand) {
  let total = 0
  let aces = 0
  for (const card of hand) {
    total += cardNumeric(card)
    if (card.value === 'A') aces++
  }
  while (total > 21 && aces > 0) { total -= 10; aces-- }
  if (total < 17) return true
  if (total === 17 && aces > 0) return true
  return false
}

// ── Hi-Lo card counting ───────────────────────────────────────────────────────
// 2-6 = +1 (low cards removed → deck richer in highs = player advantage)
// 7-9 = 0  (neutral)
// 10/J/Q/K/A = -1 (high cards removed → deck poorer in highs = house advantage)

function hiLo(card) {
  if (['2', '3', '4', '5', '6'].includes(card.value)) return +1
  if (['7', '8', '9'].includes(card.value)) return 0
  return -1
}

function hiLoLabel(card) {
  const v = hiLo(card)
  if (v === +1) return '+1'
  if (v === -1) return '-1'
  return '0'
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Constants ─────────────────────────────────────────────────────────────────

const STARTING_CHIPS = 500
const CHIP_CONFIG = [
  { value: 5,   label: '$5',   color: '#e74c3c' },
  { value: 10,  label: '$10',  color: '#3498db' },
  { value: 25,  label: '$25',  color: '#2ecc71' },
  { value: 50,  label: '$50',  color: '#9b59b6' },
  { value: 100, label: '$100', color: '#e67e22' },
]

// ── Card component ────────────────────────────────────────────────────────────

function Card({ card, faceDown = false, fresh = false, showCount = false }) {
  if (faceDown) {
    return <div className="bj-card face-down"><span className="bj-card-back">?</span></div>
  }
  const red = card.suit === '♥' || card.suit === '♦'
  const v = hiLo(card)
  return (
    <div className={`bj-card ${red ? 'red' : 'black'} ${fresh ? 'deal-in' : ''}`}>
      <span className="bj-card-corner top-left">{card.value}<br />{card.suit}</span>
      <span className="bj-card-center-suit">{card.suit}</span>
      <span className="bj-card-corner bottom-right">{card.value}<br />{card.suit}</span>
      {showCount && (
        <span className={`bj-hilo-badge ${v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero'}`}>
          {hiLoLabel(card)}
        </span>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

function safeInt(value, fallback, min, max) {
  const n = parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(n, min), max)
}

export default function Blackjack() {
  const [balance, setBalance] = useState(() => {
    return safeInt(localStorage.getItem('bj-balance'), STARTING_CHIPS, 0, 1_000_000)
  })
  const [bet, setBet] = useState(0)
  const deckRef = useRef(createShoe(safeInt(localStorage.getItem('bj-decks'), 1, 1, 8)))
  const betRef = useRef(0)
  const [player, setPlayer] = useState([])
  const [dealer, setDealer] = useState([])
  const [holeDown, setHoleDown] = useState(true)
  const [freshIdx, setFreshIdx] = useState(null)
  const [freshSide, setFreshSide] = useState(null)
  const [phase, setPhase] = useState('betting')
  const [outcome, setOutcome] = useState(null)
  const [message, setMessage] = useState('')

  // Card counting state
  const [counting, setCounting] = useState(() => localStorage.getItem('bj-counting') === 'true')
  const [showHiLo, setShowHiLo] = useState(() => localStorage.getItem('bj-showHiLo') !== 'false')
  const [quizMode, setQuizMode] = useState(() => localStorage.getItem('bj-quiz') === 'true')
  const [showCountInfo, setShowCountInfo] = useState(false)
  const [numDecks, setNumDecks] = useState(() => safeInt(localStorage.getItem('bj-decks'), 1, 1, 8))
  const [runningCount, setRunningCount] = useState(0)
  const runningCountRef = useRef(0)
  // Quiz state
  const [quizPhase, setQuizPhase] = useState(null)   // null | 'asking' | 'feedback'
  const [quizInput, setQuizInput] = useState('')
  const [quizCorrect, setQuizCorrect] = useState(null)
  const [quizStreak, setQuizStreak] = useState(0)

  function changeShoe(n) {
    setNumDecks(n)
    localStorage.setItem('bj-decks', n)
    deckRef.current = createShoe(n)
    resetCount()
    setBet(0)
    betRef.current = 0
    setPlayer([])
    setDealer([])
    setHoleDown(true)
    setPhase('betting')
    setOutcome(null)
    setMessage('')
    setQuizPhase(null)
    setQuizInput('')
    setQuizCorrect(null)
  }

  function toggleCounting() {
    const next = !counting
    setCounting(next)
    localStorage.setItem('bj-counting', next)
  }

  function toggleShowHiLo() {
    const next = !showHiLo
    setShowHiLo(next)
    localStorage.setItem('bj-showHiLo', next)
  }

  function toggleQuizMode() {
    const next = !quizMode
    setQuizMode(next)
    localStorage.setItem('bj-quiz', next)
  }

  function submitQuiz() {
    const guess = parseInt(quizInput, 10)
    if (!Number.isFinite(guess)) return   // reject empty / non-numeric
    const correct = guess === runningCountRef.current
    setQuizCorrect(correct)
    setQuizStreak(s => correct ? s + 1 : 0)
    setQuizPhase('feedback')
  }

  function addToCount(cards) {
    const delta = cards.reduce((sum, c) => sum + hiLo(c), 0)
    runningCountRef.current += delta
    setRunningCount(runningCountRef.current)
  }

  function resetCount() {
    runningCountRef.current = 0
    setRunningCount(0)
  }

  function saveBalance(b) {
    localStorage.setItem('bj-balance', b)
    setBalance(b)
  }

  function addChip(value) {
    if (phase !== 'betting') return
    if (value > balance) return
    setBalance(b => { const n = b - value; localStorage.setItem('bj-balance', n); return n })
    setBet(b => { const n = b + value; betRef.current = n; return n })
  }

  function clearBet() {
    if (phase !== 'betting') return
    setBalance(b => { const n = b + bet; localStorage.setItem('bj-balance', n); return n })
    setBet(0)
    betRef.current = 0
  }

  async function deal() {
    if (bet === 0) return
    const d = deckRef.current
    const c1 = d.pop()  // player 1
    const c2 = d.pop()  // dealer 1
    const c3 = d.pop()  // player 2
    const c4 = d.pop()  // dealer hole

    setPhase('dealing')
    setHoleDown(true)

    setPlayer([c1]); setFreshSide('player'); setFreshIdx(0); addToCount([c1])
    await sleep(320)
    setDealer([c2]); setFreshSide('dealer'); setFreshIdx(0); addToCount([c2])
    await sleep(320)
    setPlayer([c1, c3]); setFreshSide('player'); setFreshIdx(1); addToCount([c3])
    await sleep(320)
    // hole card counted when flipped, not now
    setDealer([c2, c4]); setFreshSide('dealer'); setFreshIdx(1)
    await sleep(320)
    setFreshSide(null); setFreshIdx(null)

    const p = [c1, c3]
    const dl = [c2, c4]
    const pTotal = handTotal(p)
    const dTotal = handTotal(dl)

    if (pTotal === 21 && dTotal === 21) {
      setHoleDown(false); addToCount([c4])
      await sleep(300)
      await resolve(p, dl, 'push', 'Push — both Blackjack.', betRef.current)
    } else if (pTotal === 21) {
      setHoleDown(false); addToCount([c4])
      await sleep(300)
      await resolve(p, dl, 'blackjack', 'Blackjack! 🎉 Pays 3:2', betRef.current)
    } else {
      setPhase('playing')
    }
  }

  async function hit() {
    const card = deckRef.current.pop()
    const p = [...player, card]
    setPlayer(p)
    setFreshSide('player'); setFreshIdx(p.length - 1)
    addToCount([card])
    await sleep(200)
    setFreshSide(null); setFreshIdx(null)
    const total = handTotal(p)
    if (total > 21) await resolve(p, dealer, 'bust', 'Bust! 💥', betRef.current)
    else if (total === 21) await runDealer(p, dealer)
  }

  async function stand() {
    await runDealer(player, dealer)
  }

  async function doubleDown() {
    if (balance < bet) return
    const newBet = bet * 2
    setBalance(b => { const n = b - bet; localStorage.setItem('bj-balance', n); return n })
    setBet(newBet)
    betRef.current = newBet

    const card = deckRef.current.pop()
    const p = [...player, card]
    setPlayer(p)
    setFreshSide('player'); setFreshIdx(p.length - 1)
    addToCount([card])
    await sleep(300)
    setFreshSide(null); setFreshIdx(null)

    if (handTotal(p) > 21) await resolve(p, dealer, 'bust', 'Bust! 💥', newBet)
    else await runDealer(p, dealer, newBet)
  }

  async function runDealer(pHand, dHand, currentBet = betRef.current) {
    setPhase('dealer')
    // flip hole card and count it
    setHoleDown(false)
    addToCount([dHand[1]])
    await sleep(500)

    let dl = [...dHand]
    while (dealerShouldHit(dl)) {
      const card = deckRef.current.pop()
      dl = [...dl, card]
      setDealer([...dl])
      setFreshSide('dealer'); setFreshIdx(dl.length - 1)
      addToCount([card])
      await sleep(500)
      setFreshSide(null); setFreshIdx(null)
    }

    const pTotal = handTotal(pHand)
    const dTotal = handTotal(dl)
    let r, msg
    if (dTotal > 21)          { r = 'win';  msg = 'Dealer busts — you win! 🎉' }
    else if (pTotal > dTotal) { r = 'win';  msg = 'You win! 🎉' }
    else if (pTotal < dTotal) { r = 'lose'; msg = 'Dealer wins.' }
    else                      { r = 'push'; msg = 'Push — bet returned.' }

    await resolve(pHand, dl, r, msg, currentBet)
  }

  async function resolve(pHand, dHand, r, msg, currentBet) {
    setPlayer(pHand)
    setDealer(dHand)
    setPhase('result')
    setOutcome(r)
    setMessage(msg)
    setBalance(b => {
      let n = b
      if (r === 'blackjack') n += Math.floor(currentBet * 2.5)
      else if (r === 'win')  n += currentBet * 2
      else if (r === 'push') n += currentBet
      localStorage.setItem('bj-balance', n)
      return n
    })
    if (counting && quizMode) {
      setQuizInput('')
      setQuizCorrect(null)
      setQuizPhase('asking')
    }
  }

  function nextHand() {
    if (deckRef.current.length < reshufflePoint(numDecks)) {
      deckRef.current = createShoe(numDecks)
      resetCount()
    }
    setBet(0)
    betRef.current = 0
    setPlayer([])
    setDealer([])
    setHoleDown(true)
    setPhase('betting')
    setOutcome(null)
    setMessage('')
    setQuizPhase(null)
  }

  function resetGame() {
    saveBalance(STARTING_CHIPS)
    deckRef.current = createShoe(numDecks)
    resetCount()
    setBet(0)
    betRef.current = 0
    setPlayer([])
    setDealer([])
    setHoleDown(true)
    setPhase('betting')
    setOutcome(null)
    setMessage('')
    setQuizPhase(null)
    setQuizInput('')
    setQuizCorrect(null)
  }

  const pTotal = player.length ? handTotal(player) : null
  const dTotal = dealer.length ? handTotal(dealer) : null
  const showDealerTotal = phase === 'result' || phase === 'dealer'
  const canDouble = phase === 'playing' && player.length === 2 && balance >= bet
  const busy = phase === 'dealing' || phase === 'dealer'

  // True count = running count / decks remaining
  const decksRemaining = Math.max(deckRef.current.length / 52, 0.5)
  const totalCards = numDecks * 52
  const trueCount = Math.round(runningCount / decksRemaining)
  const countColor = runningCount > 0 ? '#68d391' : runningCount < 0 ? '#fc8181' : '#a0aec0'

  return (
    <div className="bj-wrap">
      <nav className="bj-nav">
        <Link to="/" className="bj-back">← Back</Link>
        <span className="bj-title">Blackjack</span>
        <div className="bj-nav-right">
          <button
            className={`bj-count-toggle ${counting ? 'active' : ''}`}
            onClick={toggleCounting}
            title="Toggle Hi-Lo card counting display"
          >
            {counting ? '🃏 Count: ON' : '🃏 Count'}
          </button>
          <span className="bj-balance">💰 ${balance}</span>
        </div>
      </nav>

      {/* ── Card counting panel ── */}
      {counting && (
        <div className="bj-count-panel">
          <div className="bj-count-stat">
            <span className="bj-count-label">Running Count</span>
            <span className="bj-count-value" style={{ color: countColor }}>
              {quizMode ? '?' : (runningCount > 0 ? `+${runningCount}` : runningCount)}
            </span>
          </div>
          <div className="bj-count-divider" />
          <div className="bj-count-stat">
            <span className="bj-count-label">True Count</span>
            <span className="bj-count-value" style={{ color: countColor }}>
              {quizMode ? '?' : (trueCount > 0 ? `+${trueCount}` : trueCount)}
            </span>
          </div>
          <div className="bj-count-divider" />
          <div className="bj-count-stat">
            <span className="bj-count-label">Shoe ({numDecks}D)</span>
            <span className="bj-count-value neutral">
              {deckRef.current.length}/{totalCards}
            </span>
          </div>
          <div className="bj-count-divider" />
          <div className="bj-count-stat">
            <span className="bj-count-label">Edge</span>
            <span className="bj-count-value" style={{ color: countColor }}>
              {trueCount >= 2 ? 'Bet more ↑' : trueCount <= -2 ? 'Bet less ↓' : 'Neutral'}
            </span>
          </div>
          <div className="bj-count-divider" />
          <div className="bj-count-toggles">
            <button
              className={`bj-mini-toggle ${showHiLo ? 'active' : ''}`}
              onClick={toggleShowHiLo}
              title="Show +1/0/−1 on each card"
            >
              {showHiLo ? '🏷 Values: ON' : '🏷 Values: OFF'}
            </button>
            <button
              className={`bj-mini-toggle ${quizMode ? 'active quiz' : ''}`}
              onClick={toggleQuizMode}
              title="Quiz you on the count after each hand"
            >
              {quizMode ? '🧠 Quiz: ON' : '🧠 Quiz: OFF'}
            </button>
            {quizMode && quizStreak > 0 && (
              <span className="bj-streak">🔥 {quizStreak}</span>
            )}
          </div>
          <button className="bj-count-info-btn" onClick={() => setShowCountInfo(true)} title="How does card counting work?">?</button>
        </div>
      )}

      {/* ── Card counting explainer modal ── */}
      {showCountInfo && (
        <div className="bj-modal-overlay" onClick={() => setShowCountInfo(false)}>
          <div className="bj-modal" onClick={e => e.stopPropagation()}>
            <button className="bj-modal-close" onClick={() => setShowCountInfo(false)}>✕</button>
            <h2 className="bj-modal-title">How Card Counting Works</h2>
            <p className="bj-modal-intro">
              Card counting is a legal strategy that tracks whether the remaining deck favors the player or the house. This game uses the <strong>Hi-Lo system</strong> — the most widely used method.
            </p>

            <h3 className="bj-modal-section">The Hi-Lo System</h3>
            <p className="bj-modal-text">
              Every card that's dealt changes the composition of the remaining deck. You assign each card a value and keep a running total in your head:
            </p>
            <div className="bj-modal-table">
              <div className="bj-modal-row header">
                <span>Cards</span><span>Count</span><span>Why</span>
              </div>
              <div className="bj-modal-row plus">
                <span>2 · 3 · 4 · 5 · 6</span><span>+1</span><span>Low cards gone → deck richer in highs</span>
              </div>
              <div className="bj-modal-row zero">
                <span>7 · 8 · 9</span><span>0</span><span>Neutral — no meaningful impact</span>
              </div>
              <div className="bj-modal-row minus">
                <span>10 · J · Q · K · A</span><span>−1</span><span>High cards gone → deck weaker for player</span>
              </div>
            </div>

            <h3 className="bj-modal-section">Running Count vs. True Count</h3>
            <p className="bj-modal-text">
              The <strong>running count</strong> is your raw tally. The <strong>true count</strong> adjusts for how many decks are left — divide the running count by decks remaining. True count is more accurate because a +6 in a fresh shoe is less meaningful than a +6 near the end.
            </p>

            <h3 className="bj-modal-section">How to Use It</h3>
            <p className="bj-modal-text">
              A <strong>high positive count</strong> means many low cards have been dealt — the deck is now rich in 10s and Aces, which helps the player (better blackjacks, dealer more likely to bust). Bet more. A <strong>negative count</strong> means the deck is lean on high cards — the house edge grows. Bet the minimum.
            </p>
            <div className="bj-modal-rule">
              True count ≥ +2 → raise your bet &nbsp;·&nbsp; True count ≤ −2 → bet the minimum
            </div>

            <h3 className="bj-modal-section">Practice Tips</h3>
            <ul className="bj-modal-list">
              <li>Start by counting a single card at a time — add or subtract as each card appears.</li>
              <li>Use the badges on the cards to check your work. Try to count before you look.</li>
              <li>The count resets to 0 whenever the deck is reshuffled (under 15 cards remaining).</li>
              <li>Card counting doesn't guarantee wins — it shifts the odds slightly in your favor over many hands.</li>
            </ul>
          </div>
        </div>
      )}

      <div className="bj-table">

        {/* ── Dealer area ── */}
        <div className="bj-dealer-area">
          <div className="bj-area-label">
            Dealer {showDealerTotal && dealer.length > 0 ? `(${dTotal})` : ''}
          </div>
          <div className="bj-hand">
            {dealer.map((card, i) => (
              <Card
                key={i}
                card={card}
                faceDown={i === 1 && holeDown}
                fresh={freshSide === 'dealer' && freshIdx === i}
                showCount={counting && showHiLo && !(i === 1 && holeDown)}
              />
            ))}
          </div>
        </div>

        {/* ── Message ── */}
        <div className={`bj-message-wrap ${phase === 'result' ? 'visible' : ''}`}>
          {message && <div className={`bj-message ${outcome}`}>{message}</div>}
        </div>

        {/* ── Player area ── */}
        <div className="bj-player-area">
          <div className="bj-area-label">
            You {pTotal ? `(${pTotal})` : ''}
          </div>
          <div className="bj-hand">
            {player.map((card, i) => (
              <Card
                key={i}
                card={card}
                fresh={freshSide === 'player' && freshIdx === i}
                showCount={counting && showHiLo}
              />
            ))}
          </div>
        </div>

        {/* ── Controls ── */}
        <div className="bj-controls">

          {phase === 'betting' && balance === 0 && bet === 0 && (
            <div className="bj-broke">
              <p>Out of chips!</p>
              <button className="bj-btn primary" onClick={resetGame}>
                Start Over (${STARTING_CHIPS})
              </button>
            </div>
          )}

          {phase === 'betting' && (balance > 0 || bet > 0) && (
            <div className="bj-betting">
              {counting && <div className="bj-shoe-selector">
                <span className="bj-shoe-label">Shoe:</span>
                {SHOE_OPTIONS.map(n => (
                  <button
                    key={n}
                    className={`bj-shoe-btn ${numDecks === n ? 'active' : ''}`}
                    onClick={() => changeShoe(n)}
                    disabled={phase !== 'betting'}
                  >
                    {n}D
                  </button>
                ))}
              </div>}
              <div className="bj-bet-label">Bet: <span className="bj-bet-amount">${bet}</span></div>
              <div className="bj-chips">
                {CHIP_CONFIG.map(({ value, label, color }) => (
                  <button
                    key={value}
                    className="bj-chip"
                    style={{ '--chip-color': color }}
                    onClick={() => addChip(value)}
                    disabled={value > balance}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="bj-bet-btns">
                <button className="bj-btn secondary" onClick={clearBet} disabled={bet === 0}>Clear</button>
                <button className="bj-btn primary" onClick={deal} disabled={bet === 0}>Deal</button>
              </div>
            </div>
          )}

          {phase === 'dealing' && (
            <div className="bj-dealing-label">Dealing…</div>
          )}

          {phase === 'playing' && (
            <div className="bj-actions">
              <div className="bj-current-bet">Bet: ${bet}</div>
              <div className="bj-action-btns">
                <button className="bj-btn hit" onClick={hit} disabled={busy}>Hit</button>
                <button className="bj-btn stand" onClick={stand} disabled={busy}>Stand</button>
                {canDouble && (
                  <button className="bj-btn double" onClick={doubleDown} disabled={busy}>
                    Double Down
                  </button>
                )}
              </div>
            </div>
          )}

          {phase === 'dealer' && (
            <div className="bj-dealing-label">Dealer's turn…</div>
          )}

          {phase === 'result' && (
            <div className="bj-result">
              <div className="bj-current-bet">Bet was: ${bet}</div>

              {/* Quiz prompt */}
              {quizPhase === 'asking' && (
                <div className="bj-quiz">
                  <div className="bj-quiz-prompt">What's the running count?</div>
                  <div className="bj-quiz-input-row">
                    <input
                      className="bj-quiz-input"
                      type="text"
                      inputMode="numeric"
                      pattern="-?[0-9]*"
                      value={quizInput}
                      onChange={e => {
                        // allow only an optional leading minus and digits, max 4 chars
                        const cleaned = e.target.value.replace(/[^-0-9]/g, '').slice(0, 4)
                        setQuizInput(cleaned)
                      }}
                      onKeyDown={e => e.key === 'Enter' && quizInput !== '' && submitQuiz()}
                      placeholder="0"
                      maxLength={4}
                    />
                    <button className="bj-btn primary" onClick={submitQuiz} disabled={quizInput === ''}>
                      Submit
                    </button>
                  </div>
                </div>
              )}

              {/* Quiz feedback */}
              {quizPhase === 'feedback' && (
                <div className={`bj-quiz-feedback ${quizCorrect ? 'correct' : 'wrong'}`}>
                  {quizCorrect
                    ? `✓ Correct! Count is ${runningCount > 0 ? '+' : ''}${runningCount} · Streak: ${quizStreak} 🔥`
                    : `✗ Not quite — count is ${runningCount > 0 ? '+' : ''}${runningCount} (you said ${quizInput})`
                  }
                </div>
              )}

              {/* Next hand / broke — only show after quiz is answered (or quiz off) */}
              {(quizPhase === 'feedback' || quizPhase === null) && (
                balance > 0 ? (
                  <button className="bj-btn primary" onClick={nextHand}>Next Hand</button>
                ) : (
                  <div className="bj-broke">
                    <p>Out of chips!</p>
                    <button className="bj-btn primary" onClick={resetGame}>
                      Start Over (${STARTING_CHIPS})
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
