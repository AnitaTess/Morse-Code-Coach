import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

const MORSE = {
  A: ".-",   B: "-...", C: "-.-.", D: "-..",  E: ".",
  F: "..-.", G: "--.",  H: "....", I: "..",   J: ".---",
  K: "-.-",  L: ".-..", M: "--",   N: "-.",   O: "---",
  P: ".--.", Q: "--.-", R: ".-.",  S: "...",  T: "-",
  U: "..-",  V: "...-", W: ".--",  X: "-..-", Y: "-.--",
  Z: "--..",
  "0": "-----", "1": ".----", "2": "..---", "3": "...--",
  "4": "....-", "5": ".....", "6": "-....", "7": "--...",
  "8": "---..", "9": "----."
};

const WORDS = [
  "CAT", "DOG", "SUN", "RUN", "LOW", "RUN", "SAD", "CAN", "CAR", "WHY", "MOON", "STAR", "TREE", "FIRE", "WIND", "RAIN", "MEET", "DAY", "NIGHT", "CANDY", "PHONE",
  "CODE", "BEEP", "SIGN", "WAVE", "TIME", "NOTE", "HELP", "SAFE", "RENT", "FALL", "BACK", "MOVIE", "GAME", "BOOK", "FOOD", "WALK", "LEARN", "AXE", "BEE", "CLOUD",
  "CUP", "BAG", "HAT", "MAP", "KEY", "RING", "FISH", "BIRD", "DUCK", "FROG", "LION", "BEAR", "WOLF", "COW", "PIG", "SHEEP", "GOAT", "HEN", "FOX", "HATE", "SPORT",
  "NORTH", "SOUTH", "EAST", "WEST", "SLOW", "FAST", "LIGHT", "DARK", "LOVE", "FEAR", "SING", "JUMP", "SONG", "GOLF", "GREAT", "CITY", "TOWN", "OWL", "OWNER", "SOS",
  "HELLO", "WORLD", "MORSE", "RADIO", "SOUND", "LIGHT", "BRAVE", "QUEUE", "WHERE", "THING", "HOUSE", "PLANE", "TRAIN", "EARTH", "ZOO", "ZONE", "ALL", "ANT", "AWARD",
  "PLANT", "STONE", "RIVER", "OCEAN", "MUSIC", "DANCE", "PEACE", "HAPPY", "QUICK", "SMART", "STRONG", "QUIZ", "ZEBRA", "QUEST", "JAZZ", "FRUIT", "BUILD", "START", "END", 
  "123", "404", "911", "2024", "007", "1998", "1984", "3002", "51", "666", "948", "12", "781", "369", "256", "519"
].filter(w => w.length >= 3 && w.length <= 6);


function useMorseAudio() {
  const ctxRef = useRef(null);

  const ensureCtx = async () => {
    if (!ctxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AudioCtx();
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  };

  const beep = async (durationMs, frequency = 650) => {
    const ctx = await ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.value = frequency;

    // soft fade in/out to avoid clicks
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  };

  const playMorse = async (pattern, { unitMs} = {}) => {
    // timing: dot = 1 unit, dash = 3 units, intra-symbol gap = 1 unit
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === ".") await beep(unitMs);
      if (ch === "-") await beep(unitMs * 3);
      if (i < pattern.length - 1) await sleep(unitMs); // gap between symbols
    }
  };

  return { playMorse, ensureCtx };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function TabButton({ active, children, onClick }) {
  return (
    <button className={`tab ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("learn"); // learn | practice
  const [query, setQuery] = useState("");
  const { playMorse, ensureCtx } = useMorseAudio();
  const [unitMs, setUnitMs] = useState(300);

  const entries = useMemo(() => Object.entries(MORSE), []);
  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return entries;
    return entries.filter(([k, v]) => k.includes(q) || v.includes(q));
  }, [entries, query]);

  // Practice state
  const [practiceTarget, setPracticeTarget] = useState(() => randomKey());
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null); // "ok" | "nope" | null
  const [streak, setStreak] = useState(0);

  // Write practice state
const [writeTarget, setWriteTarget] = useState(() => randomKey());
const [inputPattern, setInputPattern] = useState("");
const [writeResult, setWriteResult] = useState(null); // "ok" | "nope" | null
const [writeStreak, setWriteStreak] = useState(0);
const [isHolding, setIsHolding] = useState(false);

const holdStartRef = useRef(0);
const holdTimeoutRef = useRef(null);

const HOLD_THRESHOLD = 220;     // ms: longer than this = dash
const AUTO_SUBMIT_GAP = 900;    // ms: pause after last symbol triggers auto-check

// Listening practice state
const [listenWord, setListenWord] = useState(() => randomWord());
const [listenAnswer, setListenAnswer] = useState("");
const [listenResult, setListenResult] = useState(null); // "ok" | "nope" | null
const [listenStreak, setListenStreak] = useState(0);

async function playListening() {
  setListenResult(null);
  await playWord(listenWord);
}

function checkListening() {
  const a = listenAnswer.trim().toUpperCase();
  if (!a) return;

  if (a === listenWord) {
    setListenResult("ok");
    setListenStreak((s) => s + 1);
    const next = randomWord();
    setListenWord(next);
    setListenAnswer("");
    // optional: auto-play next after a tiny delay
    setTimeout(() => playWord(next), 300);
  } else {
    setListenResult("nope");
    setListenStreak(0);
  }
}

function nextListeningWord() {
  setListenWord(randomWord());
  setListenAnswer("");
  setListenResult(null);
}


function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

async function playWord(word) {
  await ensureCtx();

  for (let i = 0; i < word.length; i++) {
    const ch = word[i].toUpperCase();
    const pattern = MORSE[ch];
    if (!pattern) continue;

    await playMorse(pattern, { unitMs });

    // letter gap = 3 units (we already do 1 unit between symbols in playMorse)
    if (i < word.length - 1) await sleep(unitMs * 3);
  }
}

  function randomKey() {
    const keys = Object.keys(MORSE);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  async function playTarget() {
    await ensureCtx(); // makes "Click to enable sound" unnecessary on some browsers
    await playMorse(MORSE[practiceTarget], {unitMs});
  }

  function checkAnswer() {
    const a = answer.trim().toUpperCase();
    if (!a) return;
    if (a === practiceTarget) {
      setResult("ok");
      setStreak((s) => s + 1);
      const next = randomKey();
      setPracticeTarget(next);
      setAnswer("");
      // quick play next after a tiny delay (optional)
      setTimeout(() => playMorse(MORSE[next], {unitMs}), 250);
    } else {
      setResult("nope");
      setStreak(0);
    }
  }

 function scheduleAutoSubmit(nextPattern) {
  if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);

  holdTimeoutRef.current = setTimeout(() => {
    checkWrite(nextPattern);
  }, AUTO_SUBMIT_GAP);
}

function addSymbol(sym) {
  setInputPattern((prev) => {
    const next = prev + sym;
    setWriteResult(null);
    scheduleAutoSubmit(next);
    return next;
  });
}


function clearWrite() {
  setInputPattern("");
  setWriteResult(null);
  if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
}

function nextWriteTarget() {
  setWriteTarget(randomKey());
  clearWrite();
}

function checkWrite(pattern = inputPattern) {
  const expected = MORSE[writeTarget];
  const got = pattern;

  if (!got) return;

  if (got === expected) {
    setWriteResult("ok");
    setWriteStreak((s) => s + 1);
    setTimeout(() => nextWriteTarget(), 600);
  } else {
    setWriteResult("nope");
    setWriteStreak(0);
  }
}


function onPressStart(e) {
  e.preventDefault(); // helps on mobile to prevent ghost clicks
  setIsHolding(true);
  holdStartRef.current = performance.now();
}

function onPressEnd(e) {
  e.preventDefault();
  if (!isHolding) return;
  setIsHolding(false);

  const duration = performance.now() - holdStartRef.current;
  const sym = duration >= HOLD_THRESHOLD ? "-" : ".";
  addSymbol(sym);
}
useEffect(() => {
  if (tab !== "write" && holdTimeoutRef.current) {
    clearTimeout(holdTimeoutRef.current);
  }
}, [tab]);


  useEffect(() => {
    const onKey = (e) => {
      if (tab !== "practice") return;
      if (e.key === "Enter") checkAnswer();
      if (e.key === " ") {
        e.preventDefault();
        playTarget();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, answer, practiceTarget]);

  return (
    <div className="page">
      <div className="phone">
        <header className="header">
          <div>
            <div className="title">Morse Code Coach</div>
            <div className="subtitle">letters & numbers • learn & practice</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
  <span style={{ fontSize: 12, color: "var(--muted)" }}>Speed</span>
  <input
    type="range"
    min="200"
    max="500"
    step="10"
    value={unitMs}
    onChange={(e) => setUnitMs(Number(e.target.value))}
  />
</div>

          </div>
          <button className="iconBtn" onClick={() => ensureCtx()} title="Enable sound">
            🔊
          </button>
        </header>

        <main className="content">
          {tab === "learn" ? (
            <>
              <div className="searchRow">
                <input
                  className="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search: A, 5, .-"
                />
              </div>

              <div className="grid">
                {filtered.map(([ch, pattern]) => (
                  <div key={ch} className="card">
                    <div className="cardTop">
                      <div className="ch">{ch}</div>
                      <button
                        className="play"
                        onClick={() => playMorse(pattern, { unitMs })}
                        aria-label={`Play ${ch}`}
                      >
                        ▶
                      </button>
                    </div>
                    <div className="pattern">{pattern}</div>
                  </div>
                ))}
              </div>
            </>
          ) : tab === "practice" ? (
            <>
              <div className="practiceCard">
                <div className="practiceTop">
                  <div>
                    <div className="label">Listen & guess</div>
                    <div className="bigPattern">{MORSE[practiceTarget]}</div>
                  </div>
                  <button className="primary" onClick={playTarget}>
                    Play
                  </button>
                </div>

                <div className="row">
                  <input
                    className="answer"
                    value={answer}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setResult(null);
                    }}
                    placeholder="Type the letter/number…"
                    maxLength={1}
                  />
                  <button className="primary" onClick={checkAnswer}>
                    Check
                  </button>
                </div>

                <div className="meta">
                  <span className="pill">Streak: {streak}</span>
                  {result === "ok" && <span className="pill ok">Correct ✅</span>}
                  {result === "nope" && (
                    <span className="pill nope">
                      Nope — it was <b>{practiceTarget}</b>
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : tab === "write" ? (
             <>
    <div className="practiceCard">
      <div className="practiceTop">
        <div>
          <div className="label">Write this character</div>
          <div className="bigPattern">
            {writeTarget} 
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="label">Your input</div>
        <div className="bigPattern" style={{ fontSize: 22 }}>
          {inputPattern || "…"}
        </div>
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button
          className={`morseBtn ${isHolding ? "down" : ""}`}
          onPointerDown={onPressStart}
          onPointerUp={onPressEnd}
          onPointerCancel={onPressEnd}
          onPointerLeave={onPressEnd}
        >
          Tap = • &nbsp;&nbsp; Hold = —
        </button>
      </div>

      <div className="row">
        <button className="tab" onClick={clearWrite}>Clear</button>
      </div>

      <div className="meta">
        <span className="pill">Streak: {writeStreak}</span>
        {writeResult === "ok" && <span className="pill ok">Correct ✅</span>}
        {writeResult === "nope" && (
          <span className="pill nope">
            Expected <b>{MORSE[writeTarget]}</b>
          </span>
        )}
      </div>

      <div className="hint">
        Tip: pause ~1s after typing and it will auto-check.
      </div>
    </div>
  </>
) : (
  // Listening mode
  <>
    <div className="practiceCard">
      <div className="practiceTop">
        <div>
          <div className="label">Listening</div>
          <div className="bigPattern" style={{ fontSize: 20 }}>
            Hear the word and type it
          </div>
        </div>
        <button className="primary" onClick={playListening}>
          Play word
        </button>
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <input
          className="answer"
          value={listenAnswer}
          onChange={(e) => {
            setListenAnswer(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            setListenResult(null);
          }}
          placeholder="Type the word…"
          maxLength={6}
        />
      </div>
      <div>
         <button className="primary" style={{ marginTop: 12 }} onClick={checkListening}>
          Check
        </button>
      </div>

      <div className="meta">
        <span className="pill">Streak: {listenStreak}</span>
        {listenResult === "ok" && <span className="pill ok">Correct ✅</span>}
        {listenResult === "nope" && (
          <span className="pill nope">
            Nope — it was <b>{listenWord}</b>
          </span>
        )}
      </div>
      <div className="hint">
        Tip: Start with a slower speed (unit ~250–320ms) while learning words.
      </div>
    </div>
  </>
)}
        </main>

        <nav className="tabs">
          <TabButton active={tab === "learn"} onClick={() => setTab("learn")}>
            Learn
          </TabButton>
          <TabButton active={tab === "practice"} onClick={() => setTab("practice")}>
            Read
          </TabButton>
          <TabButton active={tab === "write"} onClick={() => setTab("write")}>
            Write
          </TabButton>
<TabButton active={tab === "listening"} onClick={() => setTab("listening")}>
  Listen
</TabButton>

        </nav>
      </div>
    </div>
  );
}

