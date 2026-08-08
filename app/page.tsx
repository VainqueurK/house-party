"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Eye,
  EyeOff,
  Mic2,
  Moon,
  Play,
  Radio,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  Users,
  WandSparkles,
} from "lucide-react";
import {
  useRoomSync,
  type RoomChat,
  type RoomPlayer,
} from "./lib/use-room-sync";
import { useNarrator } from "./lib/use-narrator";
import { playGameSound, unlockGameAudio } from "./lib/game-audio";
import {
  assignRoles,
  PHASE_LENGTHS,
  resolveNight,
  resolveVote,
  winnerFor,
  type PalermoActions,
  type PalermoRoles,
  type PalermoState,
} from "./lib/palermo";

type Avatar = { name: string; emoji: string; color: string; status?: string };
type GraphicsQuality = "cinematic" | "performance";
type RoomMode = "player" | "display" | "host-player";

const PalermoStage = dynamic(() => import("./components/palermo-stage"), {
  ssr: false,
  loading: () => <div className="stage-loading">Building Palermo…</div>,
});

const avatars: Avatar[] = [
  { name: "Milo", emoji: "🦊", color: "orange" },
  { name: "Nia", emoji: "🌻", color: "yellow" },
  { name: "Theo", emoji: "🐸", color: "green" },
  { name: "Rae", emoji: "🪩", color: "pink" },
  { name: "Omar", emoji: "🧢", color: "blue" },
  { name: "Liv", emoji: "🌙", color: "purple" },
];

function narrationFor(state: PalermoState) {
  if (state.phase === "role-reveal")
    return "Your secret roles have arrived. Check your phone, read your role, and keep your screen hidden.";
  if (state.phase === "night")
    return "Night falls over Palermo. Keep your phone hidden. If your role has a night action, make your choice quietly now.";
  if (state.phase === "night-result") {
    if (state.cinematic?.kind === "night" && state.cinematic.protected)
      return "A shadow moved through Palermo, but someone was watching. The attack has been stopped.";
    return (
      state.resultText ??
      "Something moved in the dark. Dawn will reveal what Palermo has lost."
    );
  }
  if (state.phase === "discussion")
    return `${state.resultText ?? "Morning has come."} Look up from your phones. Talk it out, listen closely, and decide who you trust.`;
  if (state.phase === "voting")
    return "The vote is open. Make your choice privately on your phone. You may change it until time runs out.";
  if (state.phase === "vote-result")
    return `${state.resultText ?? "The room has spoken."} Night will return soon.`;
  return state.resultText ?? "Palermo has spoken.";
}

export default function Home() {
  const [view, setView] = useState<"home" | "join" | "lobby" | "game">("home");
  const [name, setName] = useState("");
  const [code, setCode] = useState("PINE-42");
  const [copied, setCopied] = useState(false);
  const [night, setNight] = useState(false);
  const [mode, setMode] = useState<RoomMode>("player");
  const [creatingPlayableRoom, setCreatingPlayableRoom] = useState(false);
  const [displayState, setDisplayState] = useState<PalermoState | null>(null);
  const [roles, setRoles] = useState<PalermoRoles>({});
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [graphicsQuality, setGraphicsQuality] =
    useState<GraphicsQuality>("cinematic");
  const narrator = useNarrator();
  const narratedRevision = useRef(0);
  const advancedRevision = useRef<number | null>(null);

  useEffect(() => {
    const narrationSetting = localStorage.getItem(
      "house-party:narration-enabled",
    );
    const qualitySetting = localStorage.getItem("house-party:graphics-quality");
    if (narrationSetting !== null)
      setNarrationEnabled(narrationSetting !== "false");
    if (qualitySetting === "performance" || qualitySetting === "cinematic")
      setGraphicsQuality(qualitySetting);
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    const roomFromLink = new URLSearchParams(window.location.search).get(
      "room",
    );
    if (roomFromLink) {
      setCode(roomFromLink.toUpperCase());
      const saved = localStorage.getItem("house-party:session");
      if (saved) {
        try {
          const session = JSON.parse(saved) as {
            code: string;
            name: string;
            mode: RoomMode;
            view: "lobby" | "game";
          };
          if (
            session.code === roomFromLink.toUpperCase() &&
            (session.mode !== "display" ||
              new URLSearchParams(window.location.search).get("display") ===
                "1")
          ) {
            setName(session.name);
            setMode(session.mode);
            setView(session.view);
            if (session.mode !== "player") {
              const state = localStorage.getItem(
                `house-party:display-state:${session.code}`,
              );
              const savedRoles = localStorage.getItem(
                `house-party:display-roles:${session.code}`,
              );
              if (state) {
                const restored = JSON.parse(state) as PalermoState;
                setDisplayState({
                  ...restored,
                  revision: restored.revision ?? 1,
                });
              }
              if (savedRoles) setRoles(JSON.parse(savedRoles) as PalermoRoles);
            }
            return;
          }
        } catch {
          localStorage.removeItem("house-party:session");
        }
      }
      setView("join");
    }
  }, []);

  const sync = useRoomSync({
    code,
    name,
    enabled: view === "lobby" || view === "game",
    role: mode,
  });
  const isHost = mode === "display" || mode === "host-player";
  const isPlayer = mode === "player" || mode === "host-player";
  const { sendPrivateRole } = sync;

  useEffect(() => {
    if (isPlayer && sync.gameState) setView("game");
  }, [isPlayer, sync.gameState]);

  useEffect(() => {
    if (view !== "lobby" && view !== "game") return;
    localStorage.setItem(
      "house-party:session",
      JSON.stringify({ code, name, mode, view }),
    );
  }, [code, mode, name, view]);

  useEffect(() => {
    if (!isHost || !displayState) return;
    localStorage.setItem(
      `house-party:display-state:${code}`,
      JSON.stringify(displayState),
    );
    localStorage.setItem(
      `house-party:display-roles:${code}`,
      JSON.stringify(roles),
    );
  }, [code, displayState, isHost, roles]);

  useEffect(() => {
    if (!isHost || !sync.syncRequests.length) return;
    const requesterIds = [...new Set(sync.syncRequests)];
    requesterIds.forEach((id) => {
      if (displayState) void sync.sendGameState(displayState);
      if (roles[id]) void sync.sendPrivateRole(id, roles[id]);
    });
    sync.clearSyncRequests();
  }, [displayState, isHost, roles, sync]);

  useEffect(() => {
    if (!isHost || displayState?.phase !== "role-reveal") return;
    const resendRoles = () => {
      for (const player of displayState.players) {
        const role = roles[player.id];
        if (role) void sendPrivateRole(player.id, role);
      }
    };
    const timer = window.setInterval(resendRoles, 1800);
    return () => window.clearInterval(timer);
  }, [displayState, isHost, roles, sendPrivateRole]);

  useEffect(() => {
    if (!sync.roomClosed) return;
    localStorage.removeItem("house-party:session");
    history.replaceState({}, "", "/");
    setView("home");
  }, [sync.roomClosed]);

  const demoPlayers = useMemo(
    () => [
      ...avatars.slice(0, 5),
      ...(name ? [{ name, emoji: "🦊", color: "orange", status: "You" }] : []),
    ],
    [name],
  );

  const players: (Avatar | RoomPlayer)[] =
    sync.enabled && sync.players.length > 0
      ? sync.players.map((player) => ({
          ...player,
          status: player.name === name ? "You" : player.status,
        }))
      : mode === "display"
        ? []
        : demoPlayers;

  const gameState = isHost ? displayState : sync.gameState;

  useEffect(() => {
    if (
      !isHost ||
      !displayState ||
      !narrationEnabled ||
      (narrator.status !== "ready" && narrator.status !== "fallback")
    )
      return;
    if (narratedRevision.current === displayState.revision) return;
    narratedRevision.current = displayState.revision;
    const cinematicDelay =
      displayState.phase === "night-result" ||
      displayState.phase === "vote-result"
        ? Math.max(
            0,
            displayState.endsAt -
              PHASE_LENGTHS[displayState.phase] * 520 -
              Date.now(),
          )
        : 0;
    const timer = window.setTimeout(
      () => void narrator.speak(narrationFor(displayState)),
      cinematicDelay,
    );
    return () => window.clearTimeout(timer);
  }, [displayState, isHost, narrationEnabled, narrator]);

  function toggleNarration() {
    const next = !narrationEnabled;
    setNarrationEnabled(next);
    localStorage.setItem("house-party:narration-enabled", String(next));
    if (next) {
      narratedRevision.current = 0;
      void narrator.prepare();
    } else narrator.stop();
  }

  function toggleGraphicsQuality() {
    const next = graphicsQuality === "cinematic" ? "performance" : "cinematic";
    setGraphicsQuality(next);
    localStorage.setItem("house-party:graphics-quality", next);
  }

  useEffect(() => {
    if (!isHost || !displayState || displayState.phase === "won")
      return;
    const phaseActions = sync.actions.filter(
      (action) =>
        action.round === displayState.round &&
        action.phase === displayState.phase,
    );
    const received = new Set(phaseActions.map((action) => action.playerId)).size;
    const expected =
      displayState.phase === "night"
        ? displayState.players.filter(
            (player) => player.alive && roles[player.id] !== "villager",
          ).length
        : displayState.phase === "voting"
          ? displayState.players.filter((player) => player.alive).length
          : 0;
    // On unreliable networks, never auto-resolve a choice phase while a
    // controller may still be reconnecting. The host can continue manually
    // once the visible timer has elapsed.
    if (expected > received) return;
    const wait = Math.max(200, displayState.endsAt - Date.now());
    const timer = window.setTimeout(() => advanceGame(), wait);
    return () => window.clearTimeout(timer);
    // The display state is the timer source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayState, isHost, roles, sync.actions]);

  function publishGameState(next: PalermoState) {
    setDisplayState(next);
    void sync.sendGameState(next);
  }

  function newRoomCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const word = Array.from(
      { length: 4 },
      () => letters[Math.floor(Math.random() * letters.length)],
    ).join("");
    return `${word}-${Math.floor(10 + Math.random() * 90)}`;
  }

  function createRoom() {
    const nextCode = newRoomCode();
    setCreatingPlayableRoom(false);
    setCode(nextCode);
    setMode("display");
    setName("");
    setDisplayState(null);
    setRoles({});
    setView("lobby");
    if (narrationEnabled) void narrator.prepare();
    history.replaceState({}, "", `/?room=${nextCode}&display=1`);
  }

  function preparePlayableRoom() {
    const nextCode = newRoomCode();
    setCreatingPlayableRoom(true);
    setCode(nextCode);
    setName("");
    setMode("host-player");
    setDisplayState(null);
    setRoles({});
    setView("join");
    history.replaceState({}, "", `/?room=${nextCode}`);
  }

  function joinRoom() {
    unlockGameAudio();
    if (!creatingPlayableRoom) setMode("player");
    setView("lobby");
    history.replaceState({}, "", `/?room=${code.toUpperCase()}`);
  }

  function leaveRoom() {
    const finishLeaving = () => {
      localStorage.removeItem("house-party:session");
      if (isHost) {
        localStorage.removeItem(`house-party:display-state:${code}`);
        localStorage.removeItem(`house-party:display-roles:${code}`);
      }
      history.replaceState({}, "", "/");
      setDisplayState(null);
      setRoles({});
      setView("home");
    };
    if (isHost) {
      void sync.closeRoom();
      window.setTimeout(finishLeaving, 250);
    } else finishLeaving();
  }

  async function startPalermo() {
    if (!isHost) return;
    const roster = sync.players.map((player) => ({
      id: player.id,
      name: player.name,
      emoji: player.emoji,
      color: player.color,
      alive: true,
    }));
    if (roster.length < 4) return;
    const assigned = assignRoles(roster);
    setRoles(assigned);
    await Promise.all(
      roster.map((player) =>
        sync.sendPrivateRole(player.id, assigned[player.id]),
      ),
    );
    if (narrationEnabled) void narrator.prepare();
    publishGameState({
      revision: 1,
      phase: "role-reveal",
      round: 1,
      endsAt: Date.now() + PHASE_LENGTHS["role-reveal"] * 1000,
      players: roster,
      screenMode: mode === "host-player" ? "everyone" : "shared",
    });
    setView("game");
  }

  function latestActions(): PalermoActions {
    return sync.actions
      .filter(
        (action) =>
          action.round === displayState?.round &&
          action.phase === displayState?.phase,
      )
      .reduce<PalermoActions>((result, action) => {
        if (action.kind === "mafia") result.mafiaTarget = action.targetId;
        if (action.kind === "doctor") result.doctorTarget = action.targetId;
        if (action.kind === "detective")
          result.detectiveTarget = action.targetId;
        return result;
      }, {});
  }

  function advanceGame() {
    if (!isHost || !displayState) return;
    if (advancedRevision.current === displayState.revision) return;
    advancedRevision.current = displayState.revision;
    const now = Date.now();
    if (displayState.phase === "role-reveal") {
      sync.clearActions();
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: "night",
        endsAt: now + PHASE_LENGTHS.night * 1000,
      });
    } else if (displayState.phase === "night") {
      const detectiveAction = sync.actions.find(
        (action) =>
          action.round === displayState.round &&
          action.phase === "night" &&
          action.kind === "detective",
      );
      if (detectiveAction?.playerId) {
        const target = displayState.players.find(
          (player) => player.id === detectiveAction.targetId,
        );
        if (target)
          void sync.sendPrivateInvestigation(detectiveAction.playerId, {
            round: displayState.round,
            targetName: target.name,
            isMafia: roles[target.id] === "mafia",
          });
      }
      const nightActions = latestActions();
      const resolved = resolveNight(displayState.players, roles, nightActions);
      const killedName = resolved.killedId
        ? displayState.players.find((player) => player.id === resolved.killedId)
            ?.name
        : undefined;
      const winner = winnerFor(resolved.players, roles);
      sync.clearActions();
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: "night-result",
        endsAt: now + PHASE_LENGTHS["night-result"] * 1000,
        players: resolved.players,
        winner,
        cinematic: {
          id: `night-${displayState.round}-${displayState.revision + 1}`,
          kind: "night",
          attackedId: nightActions.mafiaTarget,
          killedId: resolved.killedId,
          protected: Boolean(
            nightActions.mafiaTarget &&
              nightActions.mafiaTarget === nightActions.doctorTarget,
          ),
        },
        resultText: killedName
          ? `${killedName} did not make it through the night.`
          : nightActions.mafiaTarget &&
              nightActions.mafiaTarget === nightActions.doctorTarget
            ? "Someone intervened. Palermo wakes with everyone alive."
            : "The night passed without a victim.",
      });
    } else if (displayState.phase === "night-result") {
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: displayState.winner ? "won" : "discussion",
        endsAt: displayState.winner ? 0 : now + PHASE_LENGTHS.discussion * 1000,
        resultText: displayState.winner
          ? `${displayState.winner === "town" ? "The town" : "The mafia"} wins.`
          : displayState.resultText,
        cinematic: undefined,
      });
    } else if (displayState.phase === "discussion") {
      sync.clearActions();
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: "voting",
        endsAt: now + PHASE_LENGTHS.voting * 1000,
        resultText: "Choose carefully. Your vote stays private.",
      });
    } else if (displayState.phase === "voting") {
      const votes = sync.actions
        .filter((action) => action.kind === "vote" && action.playerId)
        .reduce<
          Record<string, string>
        >((all, action) => ({ ...all, [action.playerId as string]: action.targetId }), {});
      const resolved = resolveVote(displayState.players, votes);
      const winner = winnerFor(resolved.players, roles);
      const eliminatedName = resolved.eliminatedId
        ? displayState.players.find(
            (player) => player.id === resolved.eliminatedId,
          )?.name
        : undefined;
      sync.clearActions();
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: "vote-result",
        endsAt: now + PHASE_LENGTHS["vote-result"] * 1000,
        players: resolved.players,
        winner,
        eliminatedId: resolved.eliminatedId,
        cinematic: {
          id: `vote-${displayState.round}-${displayState.revision + 1}`,
          kind: "vote",
          eliminatedId: resolved.eliminatedId,
          tied: resolved.tied,
        },
        resultText: eliminatedName
          ? `${eliminatedName} has been voted out.`
          : "The vote was tied. Nobody leaves.",
      });
    } else if (displayState.phase === "vote-result") {
      publishGameState({
        ...displayState,
        revision: displayState.revision + 1,
        phase: displayState.winner ? "won" : "night",
        round: displayState.winner
          ? displayState.round
          : displayState.round + 1,
        endsAt: displayState.winner ? 0 : now + PHASE_LENGTHS.night * 1000,
        resultText: displayState.winner
          ? `${displayState.winner === "town" ? "The town" : "The mafia"} wins.`
          : undefined,
        cinematic: undefined,
      });
    }
  }

  function speak() {
    if (displayState) void narrator.speak(narrationFor(displayState));
  }

  function startGame() {
    void startPalermo();
  }

  function advancePhase() {
    advanceGame();
  }

  const currentActions = displayState
    ? sync.actions.filter(
        (action) =>
          action.round === displayState.round &&
          action.phase === displayState.phase,
      )
    : [];
  const actionCount = new Set(currentActions.map((action) => action.playerId))
    .size;
  const requiredActionCount =
    displayState?.phase === "night"
      ? displayState.players.filter(
          (player) => player.alive && roles[player.id] !== "villager",
        ).length
      : displayState?.phase === "voting"
        ? displayState.players.filter((player) => player.alive).length
        : 0;

  return (
    <main
      className={`party-app ${night ? "is-dimmed" : ""} ${view === "game" ? "is-playing" : ""}`}
    >
      <header className="party-nav">
        <button
          className="brand"
          onClick={() =>
            view === "lobby" || view === "game" ? leaveRoom() : setView("home")
          }
          aria-label="House Party home"
        >
          <span className="brand-mark">
            <Sparkles size={16} />
          </span>
          <span>
            house<span className="brand-dot">.</span>party
          </span>
        </button>
        <div className="nav-right">
          {view === "game" && (
            <span className="live-pill">
              <span /> LIVE ROOM
            </span>
          )}
          <button
            className="icon-button"
            onClick={() => setNight(!night)}
            aria-label="Toggle theme"
          >
            {night ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <span className="nav-avatar">🦊</span>
        </div>
      </header>

      {view === "home" && (
        <>
          <section className="hero wrap">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="eyebrow-line" /> YOUR LIVING ROOM, BUT LOUDER
              </div>
              <h1>
                Make a night
                <br />
                of <em>anything.</em>
              </h1>
              <p className="hero-text">
                Social games for the people you love, the screen in the corner,
                and one very dramatic narrator.
              </p>
              <div className="hero-actions">
                <button className="primary-button" onClick={preparePlayableRoom}>
                  Create &amp; play <ArrowRight size={17} />
                </button>
                <button className="text-button" onClick={createRoom}>
                  Use a shared screen
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setCreatingPlayableRoom(false);
                    setView("join");
                  }}
                >
                  Join with a code
                </button>
              </div>
              <div className="hero-note">
                <span className="note-avatars">👩🏾‍🦱 🧔🏻 👩🏻‍🦰</span> No accounts. No
                downloads. Just pass the popcorn.
              </div>
            </div>
            <div
              className="hero-art"
              aria-label="Illustration of a party game night"
            >
              <div className="sun-glow" />
              <div className="moon-orb">☾</div>
              <div className="art-card art-card-back">
                WHO
                <br />
                <strong>
                  CAN
                  <br />
                  YOU
                  <br />
                  TRUST?
                </strong>
              </div>
              <div className="art-card art-card-front">
                <span>TONIGHT&apos;S GAME</span>
                <strong>PALERMO</strong>
                <small>the classic, with a little more drama</small>
                <div className="mini-rule" />
                <span className="card-icon">♠</span>
              </div>
              <span className="doodle doodle-one">✳</span>
              <span className="doodle doodle-two">↗</span>
              <span className="doodle doodle-three">✦</span>
            </div>
          </section>
          <section className="games-section wrap">
            <div className="section-heading">
              <div>
                <div className="eyebrow">THE HOUSE MENU</div>
                <h2>Pick your poison.</h2>
              </div>
              <span className="coming-soon">
                MORE GAMES COOKING <span>✦</span>
              </span>
            </div>
            <div className="game-grid">
              <button
                className="game-tile active"
                onClick={() => setView("lobby")}
              >
                <div className="tile-art palermo-art">♠</div>
                <div className="tile-info">
                  <span className="tile-tag">READY TO PLAY</span>
                  <h3>Palermo</h3>
                  <p>Secrets, suspicions & a little chaos.</p>
                  <ArrowRight size={19} />
                </div>
              </button>
              <div className="game-tile muted">
                <div className="tile-art imposter-art">?</div>
                <div className="tile-info">
                  <span className="tile-tag">COMING SOON</span>
                  <h3>The Imposter</h3>
                  <p>One word. One liar. No pressure.</p>
                  <span className="tile-lock">LOCKED</span>
                </div>
              </div>
              <div className="game-tile muted">
                <div className="tile-art blank-art">
                  <WandSparkles size={30} />
                </div>
                <div className="tile-info">
                  <span className="tile-tag">COMING SOON</span>
                  <h3>Your next favourite</h3>
                  <p>We’re still thinking of something good.</p>
                  <span className="tile-lock">LOCKED</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      {view === "join" && (
        <JoinScreen
          code={code}
          setCode={setCode}
          name={name}
          setName={setName}
          creatingRoom={creatingPlayableRoom}
          onBack={() => {
            history.replaceState({}, "", "/");
            setView("home");
          }}
          onJoin={joinRoom}
        />
      )}
      {view === "lobby" && (
        <Lobby
          code={code}
          players={players}
          chat={sync.chat}
          sendChat={sync.sendChat}
          connected={sync.connected}
          displayMode={mode === "display"}
          hostMode={isHost}
          playingHost={mode === "host-player"}
          narrationEnabled={narrationEnabled}
          narratorStatus={narrator.status}
          narratorProgress={narrator.progress}
          onPrepareNarrator={() => void narrator.prepare()}
          onToggleNarration={toggleNarration}
          graphicsQuality={graphicsQuality}
          onToggleGraphicsQuality={toggleGraphicsQuality}
          copied={copied}
          onCopy={() => {
            setCopied(true);
            navigator.clipboard?.writeText(
              `${window.location.origin}/?room=${code}`,
            );
            setTimeout(() => setCopied(false), 1500);
          }}
          onBack={leaveRoom}
          onStart={startGame}
        />
      )}
      {view === "game" &&
        gameState &&
        (mode === "display" ? (
          <GameBoard
            state={gameState}
            players={players}
            actionCount={actionCount}
            requiredActionCount={requiredActionCount}
            narrationEnabled={narrationEnabled}
            narratorStatus={narrator.status}
            graphicsQuality={graphicsQuality}
            onToggleNarration={toggleNarration}
            onToggleGraphicsQuality={toggleGraphicsQuality}
            onSpeak={speak}
            onAdvance={advancePhase}
          />
        ) : (
          <PlayerController
            state={gameState}
            playerId={sync.playerId}
            role={sync.myRole}
            investigationResult={sync.investigationResult}
            onAction={sync.sendAction}
            hosting={mode === "host-player"}
            actionCount={actionCount}
            requiredActionCount={requiredActionCount}
            onAdvance={advancePhase}
            onSpeak={speak}
            connected={sync.connected}
          />
        ))}
    </main>
  );
}

function JoinScreen({
  code,
  setCode,
  name,
  setName,
  creatingRoom,
  onBack,
  onJoin,
}: {
  code: string;
  setCode: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  creatingRoom: boolean;
  onBack: () => void;
  onJoin: () => void;
}) {
  return (
    <section className="center-screen wrap">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={16} /> Back home
      </button>
      <div className="form-card">
        <div className="form-icon">✦</div>
        <div className="eyebrow">
          {creatingRoom ? "START A PLAYER ROOM" : "STEP INTO THE ROOM"}
        </div>
        <h2>
          {creatingRoom ? "You’re playing" : "Who are you"}
          <br />
          <em>{creatingRoom ? "this time." : "tonight?"}</em>
        </h2>
        <label>
          Your name
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Something your friends will recognise"
          />
        </label>
        <label>
          Room code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        </label>
        <button
          className="primary-button full"
          disabled={!name.trim()}
          onClick={onJoin}
        >
          {creatingRoom ? "Create player room" : "Join the room"}{" "}
          <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}

function Lobby({
  code,
  players,
  chat,
  sendChat,
  connected,
  displayMode,
  hostMode,
  playingHost,
  narrationEnabled,
  narratorStatus,
  narratorProgress,
  onPrepareNarrator,
  onToggleNarration,
  graphicsQuality,
  onToggleGraphicsQuality,
  copied,
  onCopy,
  onBack,
  onStart,
}: {
  code: string;
  players: Avatar[];
  chat: RoomChat[];
  sendChat: (text: string) => Promise<void>;
  connected: boolean;
  displayMode: boolean;
  hostMode: boolean;
  playingHost: boolean;
  narrationEnabled: boolean;
  narratorStatus: import("./lib/use-narrator").NarratorStatus;
  narratorProgress: number;
  onPrepareNarrator: () => void;
  onToggleNarration: () => void;
  graphicsQuality: GraphicsQuality;
  onToggleGraphicsQuality: () => void;
  copied: boolean;
  onCopy: () => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const [message, setMessage] = useState("");
  async function submitChat(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    await sendChat(message);
    setMessage("");
  }
  return (
    <section className="lobby wrap" data-testid="lobby">
      <button className="back-link" onClick={onBack}>
        <ChevronLeft size={16} /> Leave room
      </button>
      <div className="lobby-top">
        <div>
          <div className="eyebrow">
            {displayMode
              ? "SHARED SCREEN MODE"
              : playingHost
                ? "EVERYONE PLAYS MODE"
                : "PALERMO CONTROLLER"}
          </div>
          <h2>
            {displayMode ? (
              <>
                Put us
                <br />
                <em>on the TV.</em>
              </>
            ) : playingHost ? (
              <>
                You&apos;re hosting
                <br />
                <em>and playing.</em>
              </>
            ) : (
              <>
                Waiting for the
                <br />
                <em>display.</em>
              </>
            )}
          </h2>
        </div>
        <div className="room-code">
          <span>ROOM CODE</span>
          <strong data-testid="room-code">{code}</strong>
          <button onClick={onCopy}>
            {copied ? (
              "Copied!"
            ) : (
              <>
                <Copy size={14} /> Copy join link
              </>
            )}
          </button>
        </div>
      </div>
      <div className="lobby-main">
        <div className="player-card">
          <div className="card-title">
            <span>
              <Users size={17} /> Players{" "}
              <b data-testid="player-count">{players.length}</b>
            </span>
            <span className="ready-label" data-testid="connection-status">
              <i /> {connected ? "ROOM OPEN" : "CONNECTING..."}
            </span>
          </div>
          <div className="player-list">
            {players.map((player, index) => (
              <div className="player-row" key={`${player.name}-${index}`}>
                <span className={`player-avatar ${player.color}`}>
                  {player.emoji}
                </span>
                <strong>{player.name}</strong>
                {player.status && (
                  <span className="you-tag">{player.status}</span>
                )}
                <span className="ready-dot" />{" "}
              </div>
            ))}
          </div>
          <div className="invite-hint">
            <span>✦</span>{" "}
            {displayMode
              ? "Share this code on the big screen. Everyone else joins from their phone."
              : playingHost
                ? "Share the code. Your laptop runs the game and joins as a private player."
              : "Keep this screen open. The big screen will guide the game."}
          </div>
        </div>
        <div className="settings-card">
          <div className="card-title">
            <span>{hostMode ? "Game settings" : "Your controller"}</span>
            <span className="host-tag">
              {displayMode
                ? "NARRATOR SCREEN"
                : playingHost
                  ? "HOST + PLAYER"
                  : "MOBILE PLAYER"}
            </span>
          </div>
          <div className="setting-row">
            <span>Game</span>
            <strong>
              Palermo <small>classic rules</small>
            </strong>
          </div>
          <div className="setting-row">
            <span>Narration</span>
            {hostMode ? (
              <div className="setting-control-stack">
                <button
                  className="setting-switch"
                  type="button"
                  role="switch"
                  aria-checked={narrationEnabled}
                  data-testid="narration-toggle"
                  onClick={onToggleNarration}
                >
                  {narrationEnabled ? (
                    <Volume2 size={15} />
                  ) : (
                    <VolumeX size={15} />
                  )}
                  {narrationEnabled ? "On" : "Off"}
                  <i />
                </button>
                {narrationEnabled && (
                  <button
                    className="voice-setup"
                    data-testid="prepare-narrator"
                    onClick={onPrepareNarrator}
                    disabled={
                      narratorStatus === "loading" || narratorStatus === "ready"
                    }
                  >
                    {narratorStatus === "loading"
                      ? `Loading voice ${narratorProgress}%`
                      : narratorStatus === "ready"
                        ? "Natural voice ready"
                        : narratorStatus === "fallback"
                          ? "Device voice ready · retry"
                          : "Load voice now"}
                  </button>
                )}
              </div>
            ) : (
              <strong>
                <Volume2 size={16} /> TV controlled
              </strong>
            )}
          </div>
          <div className="setting-row">
            <span>3D quality</span>
            {hostMode ? (
              <button
                className="quality-toggle"
                data-testid="graphics-quality"
                onClick={onToggleGraphicsQuality}
              >
                {graphicsQuality === "cinematic" ? "Cinematic" : "Performance"}
              </button>
            ) : (
              <strong>TV controlled</strong>
            )}
          </div>
          <div className="setting-row">
            <span>Rounds</span>
            <strong>Until the last secret</strong>
          </div>
          {hostMode ? (
            <button
              data-testid="start-game"
              className="primary-button full"
              onClick={onStart}
              disabled={players.length < 4}
            >
              <Play size={16} fill="currentColor" /> Start the game
            </button>
          ) : (
            <div className="controller-wait">
              <Radio size={18} /> Waiting for the display to start
            </div>
          )}
          <small className="min-players">
            {players.length < 4
              ? `Need ${4 - players.length} more players to start`
              : hostMode
                ? "Everyone's in. Let’s make some questionable choices."
                : "Look up at the TV when the game begins."}
          </small>
        </div>
      </div>
      <div className="chat-card">
        <div className="card-title">
          <span>Lobby chat</span>
          <span className="host-tag">SAY HELLO</span>
        </div>
        <div className="chat-messages">
          {chat.length ? (
            chat.map((item) => (
              <div className="chat-message" key={item.id}>
                <span>{item.emoji}</span>
                <strong>{item.name}</strong>
                <p>{item.text}</p>
              </div>
            ))
          ) : (
            <span className="chat-empty">
              Your group chat, but with better timing.
            </span>
          )}
        </div>
        <form className="chat-form" onSubmit={submitChat}>
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={180}
            placeholder="Type to the room..."
            aria-label="Lobby message"
          />
          <button className="primary-button" type="submit">
            Send
          </button>
        </form>
      </div>
    </section>
  );
}

function PlayerController({
  state,
  playerId,
  role,
  investigationResult,
  onAction,
  hosting,
  actionCount,
  requiredActionCount,
  onAdvance,
  onSpeak,
  connected,
}: {
  state: PalermoState;
  playerId: string;
  role: import("./lib/palermo").PalermoRole | null;
  investigationResult: import("./lib/use-room-sync").InvestigationResult | null;
  onAction: (action: import("./lib/use-room-sync").GameAction) => Promise<void>;
  hosting: boolean;
  actionCount: number;
  requiredActionCount: number;
  onAdvance: () => void;
  onSpeak: () => void;
  connected: boolean;
}) {
  const [selected, setSelected] = useState("");
  const [roleRevealed, setRoleRevealed] = useState(false);
  const [seconds, setSeconds] = useState(
    Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    setSelected("");
    setRoleRevealed(false);
  }, [state.phase, state.round]);
  useEffect(() => {
    const concealWhenHidden = () => {
      if (document.visibilityState === "hidden") setRoleRevealed(false);
    };
    document.addEventListener("visibilitychange", concealWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", concealWhenHidden);
  }, []);
  useEffect(() => {
    let delayedFeedback: number | undefined;
    if (state.phase === "role-reveal") playGameSound("role");
    else if (state.phase === "night") playGameSound("night");
    else if (state.phase === "night-result")
      delayedFeedback = window.setTimeout(() => {
        const protectedAttack =
          state.cinematic?.kind === "night" && state.cinematic.protected;
        playGameSound(protectedAttack ? "protect" : "impact");
        navigator.vibrate?.(
          protectedAttack ? [30, 45, 30] : [70, 35, 110],
        );
      }, Math.max(0, state.endsAt - PHASE_LENGTHS["night-result"] * 580 - Date.now()));
    else if (state.phase === "vote-result")
      delayedFeedback = window.setTimeout(() => {
        playGameSound("vote");
        navigator.vibrate?.([45, 35, 45]);
      }, Math.max(0, state.endsAt - PHASE_LENGTHS["vote-result"] * 580 - Date.now()));
    return () => {
      if (delayedFeedback) window.clearTimeout(delayedFeedback);
    };
  }, [state.cinematic, state.endsAt, state.phase, state.revision]);
  useEffect(() => {
    setSeconds(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)));
    const timer = window.setInterval(
      () =>
        setSeconds(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))),
      250,
    );
    return () => window.clearInterval(timer);
  }, [state.endsAt]);
  const alive = state.players.filter(
    (player) =>
      player.alive &&
      !(state.phase === "night" && role === "mafia" && player.id === playerId),
  );
  const isAlive =
    state.players.find((player) => player.id === playerId)?.alive ?? false;
  const canAct =
    isAlive && (state.phase === "night" || state.phase === "voting");
  const noSharedScreen = hosting || state.screenMode === "everyone";
  const selectedPlayer = state.players.find((player) => player.id === selected);
  const roleLabel = role
    ? role.charAt(0).toUpperCase() + role.slice(1)
    : "Your role";
  const roleCopy: Record<string, string> = {
    mafia:
      "You are part of the mafia. Work together quietly and remove the town.",
    detective:
      "Each night, investigate one player and learn whether they are mafia.",
    doctor: "Each night, protect one player from the mafia.",
    villager: "Read the room, trust your instincts, and find the mafia by day.",
  };
  async function choose(targetId: string) {
    setSelected(targetId);
    playGameSound("select");
    navigator.vibrate?.(24);
    try {
      if (state.phase === "night" && role && role !== "villager")
        await onAction({
          kind: role,
          targetId,
          round: state.round,
          phase: state.phase,
        });
      if (state.phase === "voting")
        await onAction({
          kind: "vote",
          targetId,
          round: state.round,
          phase: state.phase,
        });
    } catch {
      // The choice is persisted before broadcast and will be replayed when the
      // device reconnects. Keep the acknowledgement visible to the player.
    }
  }
  if (
    role === "detective" &&
    investigationResult?.round === state.round &&
    state.phase === "discussion"
  ) {
    state = {
      ...state,
      resultText: `${investigationResult.targetName} is ${investigationResult.isMafia ? "Mafia" : "not Mafia"}. Only you can see this investigation.`,
    };
  }
  return (
    <section
      className={`controller-screen game-controller ${state.phase.includes("night") || state.phase === "role-reveal" ? "night" : "day"}`}
      data-testid="player-controller"
      data-phase={state.phase}
    >
      <div className="controller-world" aria-hidden="true">
        <PalermoStage
          key={state.cinematic?.id ?? "ambient"}
          state={state}
          quality="performance"
        />
      </div>
      <div className="controller-vignette" />
      {(state.phase === "night-result" || state.phase === "vote-result") && (
        <div
          className={`controller-event-flash ${state.phase}`}
          key={`event-${state.revision}`}
        />
      )}
      <div className="controller-hud-bar">
        <span className="hud-brand">PALERMO</span>
        <span className="hud-round">ROUND {state.round}</span>
        <span className={`hud-connection ${connected ? "online" : "offline"}`}>
          <i /> {connected ? state.phase.replace("-", " ").toUpperCase() : "RECONNECTING"}
        </span>
      </div>
      <div className="controller-card controller-hud-panel">
        <div className="phase-symbol">
          {state.phase === "night"
            ? "☾"
            : state.phase === "voting"
              ? "⚖"
              : "☀"}
        </div>
        {!connected && (
          <div className="recovery-banner" role="status">
            Your game is safe. Choices are saved on this device and will send
            when the connection returns.
          </div>
        )}
        {state.phase === "role-reveal" ? (
          <button
            type="button"
            className={`role-card-game ${roleRevealed ? "revealed" : "concealed"} role-${role ?? "pending"}`}
            data-testid="role-reveal-toggle"
            aria-pressed={roleRevealed}
            aria-label={roleRevealed ? "Hide your role" : "Reveal your role"}
            onClick={() => {
              unlockGameAudio();
              playGameSound("select");
              navigator.vibrate?.(20);
              setRoleRevealed((current) => !current);
            }}
          >
            <span className="role-card-suit">♠</span>
            <span className="role-card-content">
              <small>YOUR ROLE</small>
              <strong data-testid="private-role">{roleLabel}</strong>
              <span>
                {role
                  ? roleCopy[role]
                  : "Your role is still being dealt."}
              </span>
            </span>
            <span className="role-card-reveal">
              {roleRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
              {roleRevealed ? "Hide role" : "Reveal role"}
            </span>
          </button>
        ) : state.phase === "won" ? (
          <>
            <h1>{state.winner === "town" ? "Town wins." : "Mafia wins."}</h1>
            <p>{state.resultText}</p>
          </>
        ) : (
          <>
            <h1>
              {state.phase === "night" ? (
                <>
                  Your turn,
                  <br />
                  <em>quietly.</em>
                </>
              ) : state.phase === "voting" ? (
                <>
                  Who do you
                  <br />
                  <em>trust?</em>
                </>
              ) : (
                <>
                  Look up at
                  <br />
                  <em>{noSharedScreen ? "the group." : "the TV."}</em>
                </>
              )}
            </h1>
            <p>
              {state.phase === "night" && role !== "villager"
                ? noSharedScreen
                  ? "Choose privately below. Your laptop will narrate when the night is over."
                  : "Choose your action below. The TV will tell you when the night is over."
                : state.phase === "voting"
                  ? "Tap one player to cast your vote. You can change it before time runs out."
                  : (state.resultText ??
                    (noSharedScreen
                      ? "Keep your role private, listen to the narration, and talk face to face."
                      : "The shared screen is guiding Palermo. Keep this phone nearby."))}
            </p>
            {canAct &&
              ((state.phase === "night" && role !== "villager") ||
                state.phase === "voting") && (
                <div className="controller-targets">
                  {alive.map((player) => (
                    <button
                      data-testid={`target-${player.id}`}
                      key={player.id}
                      className={
                        selected === player.id
                          ? "target-button selected"
                          : "target-button"
                      }
                      onClick={() => choose(player.id)}
                    >
                      <span className={`player-avatar small ${player.color}`}>
                        {player.emoji}
                      </span>
                      <strong>{player.name}</strong>
                      {selected === player.id && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            {selectedPlayer && canAct && (
              <div className="action-confirmation" role="status" data-testid="action-confirmation">
                <CheckCircle2 size={22} />
                <span>
                  <small>{connected ? "CHOICE SENT" : "SAVED ON THIS PHONE"}</small>
                  <strong>{selectedPlayer.name}</strong>
                  <em>Tap another player to change it.</em>
                </span>
              </div>
            )}
            <button
              type="button"
              className={`role-peek ${roleRevealed ? "revealed" : "concealed"} role-${role ?? "pending"}`}
              data-testid="role-reveal-toggle"
              aria-pressed={roleRevealed}
              aria-label={roleRevealed ? "Hide your role" : "Reveal your role"}
              onClick={() => {
                unlockGameAudio();
                playGameSound("select");
                navigator.vibrate?.(20);
                setRoleRevealed((current) => !current);
              }}
            >
              <span className="role-peek-icon">
                {roleRevealed ? <EyeOff size={20} /> : <Eye size={20} />}
              </span>
              <span className="role-peek-copy">
                <small>{roleRevealed ? "TAP TO CONCEAL" : "TAP TO PEEK"}</small>
                <strong data-testid="private-role">{roleLabel}</strong>
                {roleRevealed && role && <span>{roleCopy[role]}</span>}
              </span>
            </button>
            {state.phase === "night" && role === "villager" && (
              <div className="controller-status">
                ☾ You have no night action. Keep your role hidden and listen.
              </div>
            )}
          </>
        )}
        {hosting && state.phase !== "won" && (
          <div className="compact-host-controls" data-testid="host-controls">
            <div>
              <span>HOST CONTROLS</span>
              <strong>{seconds}s</strong>
              {requiredActionCount > 0 && (
                <small>
                  {actionCount}/{requiredActionCount} choices in
                </small>
              )}
            </div>
            <button type="button" className="text-button" onClick={onSpeak}>
              <Volume2 size={15} /> Repeat
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onAdvance}
              disabled={
                requiredActionCount > 0 &&
                actionCount < requiredActionCount &&
                seconds > 0
              }
            >
              {seconds > 0 ? "Skip timer" : "Continue"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function GameBoard({
  state,
  players,
  actionCount,
  requiredActionCount,
  narrationEnabled,
  narratorStatus,
  graphicsQuality,
  onToggleNarration,
  onToggleGraphicsQuality,
  onSpeak,
  onAdvance,
}: {
  state: PalermoState;
  players: (Avatar | RoomPlayer)[];
  actionCount: number;
  requiredActionCount: number;
  narrationEnabled: boolean;
  narratorStatus: import("./lib/use-narrator").NarratorStatus;
  graphicsQuality: GraphicsQuality;
  onToggleNarration: () => void;
  onToggleGraphicsQuality: () => void;
  onSpeak: () => void;
  onAdvance: () => void;
}) {
  const [seconds, setSeconds] = useState(
    Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)),
  );
  useEffect(() => {
    setSeconds(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000)));
    const timer = window.setInterval(
      () =>
        setSeconds(Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))),
      250,
    );
    return () => window.clearInterval(timer);
  }, [state.endsAt]);
  const isNight =
    state.phase === "night" ||
    state.phase === "night-result" ||
    state.phase === "role-reveal";
  const won = state.phase === "won";
  const narrating = narratorStatus === "speaking";
  const cinematic =
    state.phase === "night-result" || state.phase === "vote-result";
  const cinematicDuration = cinematic ? PHASE_LENGTHS[state.phase] : 1;
  const cinematicProgress = cinematic
    ? Math.max(0, Math.min(1, (cinematicDuration - seconds) / cinematicDuration))
    : 1;
  const cinematicRevealed = true;
  const waitingForActions =
    requiredActionCount > 0 && actionCount < requiredActionCount && seconds > 0;
  const townIsMoving =
    (state.phase === "night" && seconds > PHASE_LENGTHS.night - 8) ||
    (state.phase === "discussion" && seconds > PHASE_LENGTHS.discussion - 6);
  const phaseBlocked = waitingForActions || townIsMoving;
  const headline = won ? (
    state.winner === "town" ? (
      "The town wins."
    ) : (
      "The mafia wins."
    )
  ) : state.phase === "role-reveal" ? (
    <>
      Check your
      <br />
      <em>phone.</em>
    </>
  ) : state.phase === "night" ? (
    <>
      Phones stay
      <br />
      <em>hidden.</em>
    </>
  ) : state.phase === "night-result" ? (
    !cinematicRevealed ? (
      <>
        Something moves
        <br />
        <em>in the dark.</em>
      </>
    ) : state.cinematic?.kind === "night" && state.cinematic.protected ? (
      <>
        The attack was
        <br />
        <em>stopped.</em>
      </>
    ) : state.cinematic?.kind === "night" && state.cinematic.killedId ? (
      <>
        A light went
        <br />
        <em>out.</em>
      </>
    ) : (
      <>
        Palermo
        <br />
        <em>stirs.</em>
      </>
    )
  ) : state.phase === "discussion" ? (
    <>
      Talk it
      <br />
      <em>out.</em>
    </>
  ) : state.phase === "voting" ? (
    <>
      Make your
      <br />
      <em>choice.</em>
    </>
  ) : state.phase === "vote-result" ? (
    !cinematicRevealed ? (
      <>
        The verdict is
        <br />
        <em>in.</em>
      </>
    ) : state.cinematic?.kind === "vote" && state.cinematic.tied ? (
      <>
        The town is
        <br />
        <em>divided.</em>
      </>
    ) : (
      <>
        The square has
        <br />
        <em>spoken.</em>
      </>
    )
  ) : (
    <>{state.resultText ?? "The night is over."}</>
  );
  const label = won
    ? "GAME OVER"
    : state.phase === "role-reveal"
      ? "PRIVATE ROLES ARE READY"
      : state.phase === "night"
        ? "PRIVATE NIGHT ACTIONS"
        : state.phase === "night-result"
          ? "THE NIGHT UNFOLDS"
          : state.phase === "discussion"
            ? "DAY DISCUSSION"
            : state.phase === "voting"
              ? "PRIVATE VOTE IS OPEN"
              : state.phase === "vote-result"
                ? "THE VERDICT"
                : "THE RESULT";
  return (
    <section
      data-testid="game-display"
      data-phase={state.phase}
      className={`game-screen game-screen-3d ${isNight ? "night-phase" : "day-phase"} ${cinematic ? "is-cinematic" : ""}`}
    >
      <PalermoStage
        key={state.cinematic?.id ?? "ambient"}
        state={state}
        quality={graphicsQuality}
      />
      <div className="cinematic-shade" />
      <div className="game-status cinematic-status">
        <span className="live-pill">
          <span /> DISPLAY MODE
        </span>
        <span>ROUND {state.round}</span>
        <div className="display-controls">
          <button
            className="display-setting"
            data-testid="game-narration-toggle"
            onClick={onToggleNarration}
            aria-label={
              narrationEnabled ? "Turn narration off" : "Turn narration on"
            }
          >
            {narrationEnabled ? <Mic2 size={14} /> : <VolumeX size={14} />}
            {narrationEnabled
              ? narratorStatus === "loading"
                ? "VOICE LOADING"
                : narrating
                  ? "NARRATING"
                  : "NARRATION ON"
              : "NARRATION OFF"}
          </button>
          <button className="display-setting" onClick={onToggleGraphicsQuality}>
            3D · {graphicsQuality === "cinematic" ? "CINEMA" : "FAST"}
          </button>
        </div>
      </div>
      <div
        className={`game-center cinematic-copy ${cinematic ? "compact" : ""}`}
      >
        <div className="phase-symbol cinematic-symbol">
          {won ? "✦" : isNight ? "☾" : state.phase === "voting" ? "⚖" : "☀"}
        </div>
        <div className="eyebrow">{label}</div>
        <h1>{headline}</h1>
        <p>
          {cinematic && !cinematicRevealed
            ? state.phase === "night-result"
              ? "Watch the doors. Palermo has not yet revealed who was chosen."
              : "The town holds its breath while the final choice is revealed."
            : state.resultText ??
            (state.phase === "role-reveal"
              ? "Read your private role, then hide your screen."
              : state.phase === "night"
                ? "Use your phone quietly when your role has an action."
                : state.phase === "night-result"
                  ? "Watch the town. Private roles remain hidden."
                  : state.phase === "discussion"
                    ? "Phones down. Make your case and listen for the lie."
                    : state.phase === "voting"
                      ? "Vote privately on your phone. Nobody can see your choice."
                      : state.phase === "vote-result"
                        ? "The verdict is now public. Individual votes stay secret."
                        : "The room has spoken.")}
        </p>
        {!won && !cinematic && (
          <div className="display-timer" data-testid="phase-timer">
            {seconds}
            <small>seconds</small>
          </div>
        )}
        {cinematic && (
          <div
            className={`cinematic-progress ${cinematicRevealed ? "revealed" : "building"}`}
            data-testid="cinematic-progress"
            aria-label={cinematicRevealed ? "Outcome revealed" : "Cinematic playing"}
          >
            <i style={{ width: `${cinematicProgress * 100}%` }} />
          </div>
        )}
        {requiredActionCount > 0 && (
          <div className="action-progress" data-testid="action-count">
            {actionCount} / {requiredActionCount} choices received
          </div>
        )}
        {narrationEnabled && (
          <button className="narrate-button" onClick={onSpeak}>
            <Volume2 size={17} />{" "}
            {narrating
              ? "Narrating now"
              : narratorStatus === "loading"
                ? "Natural voice is loading"
                : "Replay narration"}
          </button>
        )}
      </div>
      <div className="game-footer">
        <div className="mini-players">
          {players.map((p, i) => (
            <span key={i} className={`player-avatar small ${p.color}`}>
              {p.emoji}
            </span>
          ))}
        </div>
        <span>
          {state.players.filter((player) => player.alive).length} alive ·{" "}
          {state.players.length} players
        </span>
        {!won && (
          <button
            className="phase-button"
            data-testid="phase-button"
            data-phase={state.phase}
            disabled={phaseBlocked}
            onClick={onAdvance}
          >
            {waitingForActions
              ? "Waiting for choices"
              : townIsMoving
                ? state.phase === "night"
                  ? "Town is going home"
                  : "Town is waking up"
                : seconds > 0
                  ? cinematic
                    ? "Skip cinematic"
                    : "Continue early"
                  : "Continue"}{" "}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </section>
  );
}
