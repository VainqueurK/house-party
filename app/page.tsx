"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ChevronLeft,
  Copy,
  Mic2,
  Moon,
  Play,
  Radio,
  Sparkles,
  Sun,
  Volume2,
  Users,
  WandSparkles,
} from "lucide-react";
import { useRoomSync, type RoomChat, type RoomPlayer } from "./lib/use-room-sync";
import { assignRoles, PHASE_LENGTHS, resolveNight, resolveVote, winnerFor, type PalermoActions, type PalermoRoles, type PalermoState } from "./lib/palermo";

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
  const [phase, setPhase] = useState<"night" | "day">("night");
  const [mode, setMode] = useState<"player" | "display">("player");
  const [displayState, setDisplayState] = useState<PalermoState | null>(null);
  const [roles, setRoles] = useState<PalermoRoles>({});

  useEffect(() => {
    const roomFromLink = new URLSearchParams(window.location.search).get("room");
    if (roomFromLink) {
      setCode(roomFromLink.toUpperCase());
      setView("join");
    }
  }, []);

  const sync = useRoomSync({
    code,
    name,
    enabled: view === "lobby" || view === "game",
    role: mode,
  });

  useEffect(() => {
    if (!sync.event) return;
    if (sync.event.type === "start") {
      setView("game");
      if (mode === "display") setTimeout(speak, 250);
    } else {
      setPhase(sync.event.phase);
      if (mode === "display") setTimeout(speak, 100);
    }
    // Events are one-shot messages; this effect intentionally consumes each value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sync.event]);

  useEffect(() => {
    if (mode === "player" && sync.gameState) setView("game");
  }, [mode, sync.gameState]);

  const demoPlayers = useMemo(() => [
    ...avatars.slice(0, 5),
    ...(name ? [{ name, emoji: "🦊", color: "orange", status: "You" }] : []),
  ], [name]);

  const players: (Avatar | RoomPlayer)[] = sync.enabled && sync.players.length > 0
    ? sync.players.map((player) => ({ ...player, status: player.name === name ? "You" : player.status }))
    : mode === "display" ? [] : demoPlayers;

  const gameState = mode === "display" ? displayState : sync.gameState;

  useEffect(() => {
    if (mode !== "display" || !displayState || displayState.phase === "won") return;
    const wait = Math.max(200, displayState.endsAt - Date.now());
    const timer = window.setTimeout(() => advanceGame(), wait);
    return () => window.clearTimeout(timer);
    // The display state is the timer source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayState, mode]);

  function publishGameState(next: PalermoState) {
    setDisplayState(next);
    void sync.sendGameState(next);
  }

  function startPalermo() {
    if (mode !== "display") return;
    const roster = sync.players.map((player) => ({ id: player.id, name: player.name, emoji: player.emoji, color: player.color, alive: true }));
    if (roster.length < 4) return;
    const assigned = assignRoles(roster);
    setRoles(assigned);
    roster.forEach((player) => void sync.sendPrivateRole(player.id, assigned[player.id]));
    publishGameState({ phase: "role-reveal", round: 1, endsAt: Date.now() + PHASE_LENGTHS["role-reveal"] * 1000, players: roster });
    setView("game");
  }

  function latestActions(): PalermoActions {
    return sync.actions.reduce<PalermoActions>((result, action) => {
      if (action.kind === "mafia") result.mafiaTarget = action.targetId;
      if (action.kind === "doctor") result.doctorTarget = action.targetId;
      if (action.kind === "detective") result.detectiveTarget = action.targetId;
      return result;
    }, {});
  }

  function advanceGame() {
    if (mode !== "display" || !displayState) return;
    const now = Date.now();
    if (displayState.phase === "role-reveal") {
      sync.clearActions();
      publishGameState({ ...displayState, phase: "night", endsAt: now + PHASE_LENGTHS.night * 1000 });
    } else if (displayState.phase === "night") {
      const resolved = resolveNight(displayState.players, roles, latestActions());
      const killedName = resolved.killedId ? displayState.players.find((player) => player.id === resolved.killedId)?.name : undefined;
      sync.clearActions();
      publishGameState({ ...displayState, phase: "discussion", endsAt: now + PHASE_LENGTHS.discussion * 1000, players: resolved.players, resultText: killedName ? `${killedName} did not make it through the night.` : "The doctor kept everyone alive." });
    } else if (displayState.phase === "discussion") {
      sync.clearActions();
      publishGameState({ ...displayState, phase: "voting", endsAt: now + PHASE_LENGTHS.voting * 1000, resultText: "Choose carefully. Your vote is final." });
    } else if (displayState.phase === "voting") {
      const votes = sync.actions.filter((action) => action.kind === "vote" && action.playerId).reduce<Record<string, string>>((all, action) => ({ ...all, [action.playerId as string]: action.targetId }), {});
      const resolved = resolveVote(displayState.players, votes);
      const winner = winnerFor(resolved.players, roles);
      const eliminatedName = resolved.eliminatedId ? displayState.players.find((player) => player.id === resolved.eliminatedId)?.name : undefined;
      sync.clearActions();
      publishGameState({ ...displayState, phase: winner ? "won" : "result", endsAt: winner ? 0 : now + PHASE_LENGTHS.result * 1000, players: resolved.players, winner, eliminatedId: resolved.eliminatedId, resultText: winner ? `${winner === "town" ? "The town" : "The mafia"} wins.` : eliminatedName ? `${eliminatedName} has been voted out.` : "The vote was tied. Nobody leaves." });
    } else if (displayState.phase === "result") {
      publishGameState({ ...displayState, phase: "night", round: displayState.round + 1, endsAt: now + PHASE_LENGTHS.night * 1000, resultText: undefined });
    }
  }

  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const currentPhase = displayState?.phase ?? phase;
    const line = currentPhase === "role-reveal"
      ? "Your roles have been dealt. Read your secret, and keep it hidden."
      : currentPhase === "night"
        ? "The sun has set. Everyone, close your eyes. Mafia, wake up."
        : currentPhase === "discussion"
          ? "The sun is rising over Palermo. Open your eyes, and decide who you trust."
          : currentPhase === "voting"
            ? "The time has come. Point the finger, and cast your vote."
            : "Palermo has spoken. Let the story continue.";
    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.86;
    utterance.pitch = 0.82;
    const preferredVoice = window.speechSynthesis.getVoices().find((voice) => /natural|google uk english female|samantha|daniel/i.test(voice.name));
    if (preferredVoice) utterance.voice = preferredVoice;
    utterance.onstart = () => setNarrating(true);
    utterance.onend = () => setNarrating(false);
    window.speechSynthesis.speak(utterance);
  }

  function startGame() {
    startPalermo();
  }

  function advancePhase() {
    advanceGame();
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
              <button className="primary-button" onClick={() => { setMode("display"); setName(""); setView("lobby"); }}>Create a room <ArrowRight size={17} /></button>
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

      {view === "join" && <JoinScreen code={code} setCode={setCode} name={name} setName={setName} onBack={() => setView("home")} onJoin={() => { setMode("player"); setView("lobby"); }} />}
      {view === "lobby" && <Lobby code={code} players={players} chat={sync.chat} sendChat={sync.sendChat} displayMode={mode === "display"} copied={copied} onCopy={() => { setCopied(true); navigator.clipboard?.writeText(`${window.location.origin}/?room=${code}`); setTimeout(() => setCopied(false), 1500); }} onBack={() => setView("home")} onStart={startGame} />}
      {view === "game" && gameState && (mode === "display" ? <GameBoard state={gameState} players={players} narrating={narrating} onSpeak={speak} onAdvance={advancePhase} /> : <PlayerController state={gameState} playerId={sync.playerId} role={sync.myRole} onAction={(action) => void sync.sendAction(action)} />)}
    </main>
  );
}

function JoinScreen({ code, setCode, name, setName, onBack, onJoin }: { code: string; setCode: (v: string) => void; name: string; setName: (v: string) => void; onBack: () => void; onJoin: () => void }) {
  return <section className="center-screen wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Back home</button><div className="form-card"><div className="form-icon">✦</div><div className="eyebrow">STEP INTO THE ROOM</div><h2>Who are you<br /><em>tonight?</em></h2><label>Your name<input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Something your friends will recognise" /></label><label>Room code<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} /></label><button className="primary-button full" disabled={!name.trim()} onClick={onJoin}>Join the room <ArrowRight size={17} /></button></div></section>;
}

function Lobby({ code, players, chat, sendChat, displayMode, copied, onCopy, onBack, onStart }: { code: string; players: Avatar[]; chat: RoomChat[]; sendChat: (text: string) => Promise<void>; displayMode: boolean; copied: boolean; onCopy: () => void; onBack: () => void; onStart: () => void }) {
  const [message, setMessage] = useState("");
  async function submitChat(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    await sendChat(message);
    setMessage("");
  }
  return <section className="lobby wrap"><button className="back-link" onClick={onBack}><ChevronLeft size={16} /> Leave room</button><div className="lobby-top"><div><div className="eyebrow">{displayMode ? "SHARED SCREEN MODE" : "PALERMO CONTROLLER"}</div><h2>{displayMode ? <>Put us<br /><em>on the TV.</em></> : <>Waiting for the<br /><em>display.</em></>}</h2></div><div className="room-code"><span>ROOM CODE</span><strong>{code}</strong><button onClick={onCopy}>{copied ? "Copied!" : <><Copy size={14} /> Copy join link</>}</button></div></div><div className="lobby-main"><div className="player-card"><div className="card-title"><span><Users size={17} /> Players <b>{players.length}</b></span><span className="ready-label"><i /> ROOM OPEN</span></div><div className="player-list">{players.map((player, index) => <div className="player-row" key={`${player.name}-${index}`}><span className={`player-avatar ${player.color}`}>{player.emoji}</span><strong>{player.name}</strong>{player.status && <span className="you-tag">{player.status}</span>}<span className="ready-dot" /> </div>)}</div><div className="invite-hint"><span>✦</span> {displayMode ? "Share this code on the big screen. Everyone else joins from their phone." : "Keep this screen open. The big screen will guide the game."}</div></div><div className="settings-card"><div className="card-title"><span>{displayMode ? "Display settings" : "Your controller"}</span><span className="host-tag">{displayMode ? "NARRATOR SCREEN" : "MOBILE PLAYER"}</span></div><div className="setting-row"><span>Game</span><strong>Palermo <small>classic rules</small></strong></div><div className="setting-row"><span>Narrator</span><strong><Volume2 size={16} /> Warm & theatrical</strong></div><div className="setting-row"><span>Rounds</span><strong>Until the last secret</strong></div>{displayMode ? <button className="primary-button full" onClick={onStart} disabled={players.length < 4}><Play size={16} fill="currentColor" /> Start the game</button> : <div className="controller-wait"><Radio size={18} /> Waiting for the display to start</div>}<small className="min-players">{players.length < 4 ? `Need ${4 - players.length} more players to start` : displayMode ? "Everyone's in. Let’s make some questionable choices." : "Look up at the TV when the game begins."}</small></div></div><div className="chat-card"><div className="card-title"><span>Lobby chat</span><span className="host-tag">SAY HELLO</span></div><div className="chat-messages">{chat.length ? chat.map((item) => <div className="chat-message" key={item.id}><span>{item.emoji}</span><strong>{item.name}</strong><p>{item.text}</p></div>) : <span className="chat-empty">Your group chat, but with better timing.</span>}</div><form className="chat-form" onSubmit={submitChat}><input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={180} placeholder="Type to the room..." aria-label="Lobby message" /><button className="primary-button" type="submit">Send</button></form></div></section>;
}

function PlayerController({ state, playerId, role, onAction }: { state: PalermoState; playerId: string; role: import("./lib/palermo").PalermoRole | null; onAction: (action: import("./lib/use-room-sync").GameAction) => void }) {
  const [selected, setSelected] = useState("");
  const alive = state.players.filter((player) => player.alive);
  const isAlive = state.players.find((player) => player.id === playerId)?.alive ?? false;
  const canAct = isAlive && (state.phase === "night" || state.phase === "voting");
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Your role";
  const roleCopy: Record<string, string> = {
    mafia: "You are part of the mafia. Work together quietly and remove the town.",
    detective: "Each night, investigate one player and learn whether they are mafia.",
    doctor: "Each night, protect one player from the mafia.",
    villager: "Read the room, trust your instincts, and find the mafia by day.",
  };
  function choose(targetId: string) {
    setSelected(targetId);
    if (state.phase === "night" && role && role !== "villager") onAction({ kind: role, targetId });
    if (state.phase === "voting") onAction({ kind: "vote", targetId });
  }
  return <section className="controller-screen wrap"><div className="controller-card"><div className="phase-symbol">{state.phase === "night" ? "☾" : state.phase === "voting" ? "⚖" : "☀"}</div><div className="eyebrow">ROUND {state.round} · {state.phase.replace("-", " ").toUpperCase()}</div>{state.phase === "role-reveal" ? <><div className="role-badge">{roleLabel}</div><h1>Keep your<br /><em>secret.</em></h1><p>{role ? roleCopy[role] : "Your private role is being dealt. Keep it hidden from the room."}</p></> : state.phase === "won" ? <><h1>{state.winner === "town" ? "Town wins." : "Mafia wins."}</h1><p>{state.resultText}</p></> : <><h1>{state.phase === "night" ? <>Your turn,<br /><em>quietly.</em></> : state.phase === "voting" ? <>Who do you<br /><em>trust?</em></> : <>Look up at<br /><em>the TV.</em></>}</h1><p>{state.phase === "night" && role !== "villager" ? "Choose your action below. The TV will tell you when the night is over." : state.phase === "voting" ? "Tap one player to cast your vote. You can change it before time runs out." : state.resultText ?? "The shared screen is guiding Palermo. Keep this phone nearby."}</p>{canAct && ((state.phase === "night" && role !== "villager") || state.phase === "voting") && <div className="controller-targets">{alive.map((player) => <button key={player.id} className={selected === player.id ? "target-button selected" : "target-button"} onClick={() => choose(player.id)}><span className={`player-avatar small ${player.color}`}>{player.emoji}</span><strong>{player.name}</strong>{selected === player.id && <span>✓</span>}</button>)}</div>}{state.phase === "night" && role === "villager" && <div className="controller-status">☾ You are safe in the night. Watch the TV.</div>}</>}</div></section>;
}

function GameBoard({ state, players, narrating, onSpeak, onAdvance }: { state: PalermoState; players: (Avatar | RoomPlayer)[]; narrating: boolean; onSpeak: () => void; onAdvance: () => void }) {
  const [seconds, setSeconds] = useState(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))), 250);
    return () => window.clearInterval(timer);
  }, [state.endsAt]);
  const isNight = state.phase === "night" || state.phase === "role-reveal";
  const won = state.phase === "won";
  const headline = won ? state.winner === "town" ? "The town wins." : "The mafia wins." : state.phase === "role-reveal" ? <>Meet your<br /><em>secret.</em></> : state.phase === "night" ? <>Close your<br /><em>eyes.</em></> : state.phase === "discussion" ? <>Talk it<br /><em>out.</em></> : state.phase === "voting" ? <>Point the<br /><em>finger.</em></> : <>{state.resultText ?? "The night is over."}</>;
  const label = won ? "GAME OVER" : state.phase === "role-reveal" ? "ROLES ARE BEING DEALT" : state.phase === "night" ? "PALERMO IS ASLEEP" : state.phase === "discussion" ? "DAY DISCUSSION" : state.phase === "voting" ? "THE VOTE IS OPEN" : "THE RESULT";
  return <section className={`game-screen ${isNight ? "night-phase" : "day-phase"}`}><div className="game-status"><span className="live-pill"><span /> DISPLAY MODE</span><span>ROUND {state.round}</span><span className="game-audio"><Mic2 size={14} /> {narrating ? "Narrating..." : "Narrator ready"}</span></div><div className="game-center"><div className="phase-symbol">{won ? "✦" : isNight ? "☾" : state.phase === "voting" ? "⚖" : "☀"}</div><div className="eyebrow">{label}</div><h1>{headline}</h1><p>{state.resultText ?? (state.phase === "role-reveal" ? "Read your role, then keep it secret." : state.phase === "night" ? "The streets are quiet. The secrets are not." : state.phase === "discussion" ? "Make your case. Listen for the lie." : state.phase === "voting" ? "Every vote changes the story." : "The room has spoken." )}</p>{!won && <div className="display-timer">{seconds}<small>seconds</small></div>}<button className="narrate-button" onClick={onSpeak}><Volume2 size={17} /> {narrating ? "Narrating now" : "Play narration"}</button></div><div className="game-footer"><div className="mini-players">{players.map((p, i) => <span key={i} className={`player-avatar small ${p.color}`}>{p.emoji}</span>)}</div><span>{state.players.filter((player) => player.alive).length} alive · {state.players.length} players</span>{!won && <button className="phase-button" onClick={onAdvance}>{seconds > 0 ? "Skip timer" : "Continue"} <ArrowRight size={16} /></button>}</div></section>;
}
