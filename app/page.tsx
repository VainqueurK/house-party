"use client";

import { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  Copy,
  Crown,
  Mic2,
  Moon,
  Play,
  Sparkles,
  Sun,
  Volume2,
  Users,
  WandSparkles,
} from "lucide-react";

type Avatar = { name: string; emoji: string; color: string; status?: string };

const avatars: Avatar[] = [
  { name: "Milo", emoji: "🦊", color: "orange" },
  { name: "Nia", emoji: "🌻", color: "yellow" },
  { name: "Theo", emoji: "🐸", color: "green" },
  { name: "Rae", emoji: "🪩", color: "pink" },
  { name: "Omar", emoji: "🧢", color: "blue" },
  { name: "Liv", emoji: "🌙", color: "purple" },
];

export default function Home() {
  const [view, setView] = useState<"home" | "join" | "lobby" | "game">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("PINE-42");
  const [copied, setCopied] = useState(false);
  const [narrating, setNarrating] = useState(false);
  const [night, setNight] = useState(false);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<"night" | "day">("night");

  const players = useMemo(() => [
    ...avatars.slice(0, 5),
    ...(name ? [{ name, emoji: "🦊", color: "orange", status: "You" }] : []),
  ], [name]);

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const line = phase === "night"
      ? "The sun has set. Everyone, close your eyes. Mafia, wake up."
      : "The sun is rising over Palermo. Open your eyes, and decide who you trust.";
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.86;
    utterance.pitch = 0.82;
    utterance.onstart = () => setNarrating(true);
    utterance.onend = () => setNarrating(false);
    window.speechSynthesis.speak(utterance);
  }

  function startGame() {
    setView("game");
    setTimeout(speak, 350);
  }

  function advancePhase() {
    const next = phase === "night" ? "day" : "night";
    setPhase(next);
    if (next === "night") setRound((value) => value + 1);
    setTimeout(speak, 100);
  }

  return (
    <main className={`party-app ${night ? "is-dimmed" : ""}`}>
      <header className="party-nav">
        <button className="brand" onClick={() => setView("home")} aria-label="House Party home">
          <span className="brand-mark"><Sparkles size={16} /></span>
          <span>house<span className="brand-dot">.</span>party</span>
        </button>
        <div className="nav-right">
          {view === "game" && <span className="live-pill"><span /> LIVE ROOM</span>}
          <button className="icon-button" onClick={() => setNight(!night)} aria-label="Toggle theme">
            {night ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="nav-avatar">🦊</span>
        </div>
      </header>

      {view === "home" && <>
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> YOUR LIVING ROOM, BUT LOUDER</div>
            <h1>Make a night<br />of <em>anything.</em></h1>
            <p className="hero-text">Social games for the people you love, the screen in the corner, and one very dramatic narrator.</p>
            <div className="hero-actions">
              <button className="primary-button" onClick={() => setView("lobby")}>Create a room <ArrowRight size={17} /></button>
              <button className="text-button" onClick={() => setView("join")}>Join with a code</button>
            </div>
            <div className="hero-note"><span className="note-avatars">👩🏾‍🦱 🧔🏻 👩🏻‍🦰</span> No accounts. No downloads. Just pass the popcorn.</div>
          </div>
          <div className="hero-art" aria-label="Illustration of a party game night">
            <div className="sun-glow" /><div className="moon-orb">☾</div>
            <div className="art-card art-card-back">WHO<br /><strong>CAN<br />YOU<br />TRUST?</strong></div>
            <div className="art-card art-card-front"><span>TONIGHT&apos;S GAME</span><strong>PALERMO</strong><small>the classic, with a little more drama</small><div className="mini-rule" /><span className="card-icon">♠</span></div>
            <span className="doodle doodle-one">✳</span><span className="doodle doodle-two">↗</span><span className="doodle doodle-three">✦</span>
          </div>
        </section>
        <section className="games-section wrap">
          <div className="section-heading"><div><div className="eyebrow">THE HOUSE MENU</div><h2>Pick your poison.</h2></div><span className="coming-soon">MORE GAMES COOKING <span>✦</span></span></div>
          <div className="game-grid">
            <button className="game-tile active" onClick={() => setView("lobby")}><div className="tile-art palermo-art">♠</div><div className="tile-info"><span className="tile-tag">READY TO PLAY</span><h3>Palermo</h3><p>Secrets, suspicions & a little chaos.</p><ArrowRight size={19} /></div></button>
            <div className="game-tile muted"><div className="tile-art imposter-art">?</div><div className="tile-info"><span className="tile-tag">COMING SOON</span><h3>The Imposter</h3><p>One word. One liar. No pressure.</p><span className="tile-lock">LOCKED</span></div></div>
            <div className="game-tile muted"><div className="tile-art blank-art"><WandSparkles size={30} /></div><div className="tile-info"><span className="tile-tag">COMING SOON</span><h3>Your next favourite</h3><p>We’re still thinking of something good.</p><span className="tile-lock">LOCKED</span></div></div>
          </div>
        </section>
      </>}

      {view === "join" && <JoinScreen code={code} setCode={setCode} name={name} setName={setName} onBack={() => setView("home")} onJoin={() => setView("lobby")} />}
      {view === "lobby" && <Lobby code={code} players={players} copied={copied} onCopy={() => { setCopied(true); navigator.clipboard?.writeText(code); setTimeout(() => setCopied(false), 1500); }} onBack={() => setView("home")} onStart={startGame} />}
      {view === "game" && <GameBoard phase={phase} round={round} players={players} narrating={narrating} onSpeak={speak} onAdvance={advancePhase} />}
    </main>
  );
}

function JoinScreen({ code, setCode, name, setName, onBack, onJoin }: { code: string; setCode: (v: string) => void; name: string; setName: (v: string) => void; onBack: () => void; onJoin: () => void }) {
  return <section className="center-screen wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Back home</button><div className="form-card"><div className="form-icon">✦</div><div className="eyebrow">STEP INTO THE ROOM</div><h2>Who are you<br /><em>tonight?</em></h2><label>Your name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Something your friends will recognise" /></label><label>Room code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label><button className="primary-button full" disabled={!name.trim()} onClick={onJoin}>Join the room <ArrowRight size={17} /></button></div></section>;
}

function Lobby({ code, players, copied, onCopy, onBack, onStart }: { code: string; players: Avatar[]; copied: boolean; onCopy: () => void; onBack: () => void; onStart: () => void }) {
  return <section className="lobby wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Leave room</button><div className="lobby-top"><div><div className="eyebrow">THE PALERMO ROOM</div><h2>Waiting for the<br /><em>usual suspects.</em></h2></div><div className="room-code"><span>ROOM CODE</span><strong>{code}</strong><button onClick={onCopy}>{copied ? "Copied!" : <><Copy size={14} /> Copy code</>}</button></div></div><div className="lobby-main"><div className="player-card"><div className="card-title"><span><Users size={17} /> Players <b>{players.length}</b></span><span className="ready-label"><i /> ROOM OPEN</span></div><div className="player-list">{players.map((player, index) => <div className="player-row" key={`${player.name}-${index}`}><span className={`player-avatar ${player.color}`}>{player.emoji}</span><strong>{player.name}</strong>{index === 0 && <Crown size={15} className="crown" />}{player.status && <span className="you-tag">{player.status}</span>}<span className="ready-dot" /> </div>)}</div><div className="invite-hint"><span>✦</span> Share the code on the big screen, or text it to the group chat.</div></div><div className="settings-card"><div className="card-title"><span>Game settings</span><span className="host-tag">HOST CONTROLS</span></div><div className="setting-row"><span>Game</span><strong>Palermo <small>classic rules</small></strong></div><div className="setting-row"><span>Narrator</span><strong><Volume2 size={16} /> Warm & theatrical</strong></div><div className="setting-row"><span>Rounds</span><strong>Until the last secret</strong></div><button className="primary-button full" onClick={onStart} disabled={players.length < 4}><Play size={16} fill="currentColor" /> Start the game</button><small className="min-players">{players.length < 4 ? `Need ${4 - players.length} more players to start` : "Everyone's in. Let’s make some questionable choices."}</small></div></div></section>;
}

function GameBoard({ phase, round, players, narrating, onSpeak, onAdvance }: { phase: "night" | "day"; round: number; players: Avatar[]; narrating: boolean; onSpeak: () => void; onAdvance: () => void }) {
  const isNight = phase === "night";
  return <section className={`game-screen ${isNight ? "night-phase" : "day-phase"}`}><div className="game-status"><span className="live-pill"><span /> LIVE ROOM</span><span>ROUND {round}</span><span className="game-audio"><Mic2 size={14} /> {narrating ? "Narrating..." : "Narrator ready"}</span></div><div className="game-center"><div className="phase-symbol">{isNight ? "☾" : "☀"}</div><div className="eyebrow">{isNight ? "PALERMO IS ASLEEP" : "PALERMO IS AWAKE"}</div><h1>{isNight ? <>Close your<br /><em>eyes.</em></> : <>Open your<br /><em>eyes.</em></>}</h1><p>{isNight ? "The streets are quiet. The secrets are not." : "The morning has arrived. Someone knows something."}</p><button className="narrate-button" onClick={onSpeak}><Volume2 size={17} /> {narrating ? "Narrating now" : "Play narration"}</button></div><div className="game-footer"><div className="mini-players">{players.map((p, i) => <span key={i} className={`player-avatar small ${p.color}`}>{p.emoji}</span>)}</div><span>{players.length} players in the room</span><button className="phase-button" onClick={onAdvance}>{isNight ? "Bring on the morning" : "Call it a night"} <ArrowRight size={16} /></button></div></section>;
}
