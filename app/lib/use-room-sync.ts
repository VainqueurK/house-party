"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { PalermoPhase, PalermoRole, PalermoState } from "./palermo";

export type RoomPlayer = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status?: string;
};
export type GameAction = {
  kind: "mafia" | "doctor" | "detective" | "vote";
  targetId: string;
  round: number;
  phase: PalermoPhase;
  playerId?: string;
};
export type RoomChat = {
  id: string;
  name: string;
  emoji: string;
  text: string;
};
export type InvestigationResult = {
  round: number;
  targetName: string;
  isMafia: boolean;
};

const profiles = [
  { emoji: "🦊", color: "orange" },
  { emoji: "🌻", color: "yellow" },
  { emoji: "🐸", color: "green" },
  { emoji: "🪩", color: "pink" },
  { emoji: "🧢", color: "blue" },
  { emoji: "🌙", color: "purple" },
  { emoji: "🐙", color: "coral" },
  { emoji: "🦋", color: "mint" },
  { emoji: "🦁", color: "orange" },
  { emoji: "🍒", color: "pink" },
  { emoji: "🐝", color: "yellow" },
  { emoji: "🎲", color: "blue" },
  { emoji: "🧿", color: "purple" },
  { emoji: "🐯", color: "orange" },
  { emoji: "🦄", color: "pink" },
  { emoji: "🌵", color: "green" },
  { emoji: "🍋", color: "yellow" },
  { emoji: "🎸", color: "coral" },
  { emoji: "🛼", color: "mint" },
  { emoji: "🪐", color: "purple" },
  { emoji: "🐼", color: "blue" },
  { emoji: "🍉", color: "green" },
  { emoji: "🦖", color: "mint" },
  { emoji: "🎭", color: "coral" },
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;

function storageKey(kind: string, room: string) {
  return `house-party:${kind}:${room.toUpperCase()}`;
}

function getOrCreateDeviceId() {
  const stored = localStorage.getItem("house-party:player-id");
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith("house-party-device="))
    ?.split("=")[1];
  const id = stored || cookie || crypto.randomUUID();
  localStorage.setItem("house-party:player-id", id);
  document.cookie = `house-party-device=${encodeURIComponent(id)}; Max-Age=31536000; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  return id;
}

export function useRoomSync({
  code,
  name,
  enabled,
  role,
}: {
  code: string;
  name: string;
  enabled: boolean;
  role: "player" | "display" | "host-player";
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [chat, setChat] = useState<RoomChat[]>([]);
  const [gameState, setGameState] = useState<PalermoState | null>(null);
  const [myRole, setMyRole] = useState<PalermoRole | null>(null);
  const [roleIntel, setRoleIntel] = useState<string[]>([]);
  const [investigationResult, setInvestigationResult] =
    useState<InvestigationResult | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [syncRequests, setSyncRequests] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [hostConnected, setHostConnected] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [playerId] = useState(() => {
    if (typeof window === "undefined") return "server";
    return getOrCreateDeviceId();
  });
  const profile = useMemo(() => {
    const source = `${name.trim().toLowerCase()}:${playerId}`;
    const hash = [...source].reduce(
      (sum, char, index) => sum + char.charCodeAt(0) * (index + 1),
      0,
    );
    return profiles[hash % profiles.length];
  }, [name, playerId]);

  useEffect(() => {
    if (!code || role === "display") return;
    const savedRole = localStorage.getItem(
      storageKey("role", code),
    ) as PalermoRole | null;
    const savedState = localStorage.getItem(storageKey("state", code));
    const savedRoleIntel = localStorage.getItem(storageKey("role-intel", code));
    const savedInvestigation = localStorage.getItem(
      storageKey("investigation", code),
    );
    setMyRole(savedRole);
    if (savedRoleIntel) {
      try {
        setRoleIntel(JSON.parse(savedRoleIntel) as string[]);
      } catch {
        localStorage.removeItem(storageKey("role-intel", code));
      }
    }
    if (savedInvestigation) {
      try {
        setInvestigationResult(
          JSON.parse(savedInvestigation) as InvestigationResult,
        );
      } catch {
        localStorage.removeItem(storageKey("investigation", code));
      }
    }
    if (savedState) {
      try {
        setGameState(JSON.parse(savedState) as PalermoState);
      } catch {
        localStorage.removeItem(storageKey("state", code));
      }
    }
  }, [code, role]);

  useEffect(() => {
    const isHost = role === "display" || role === "host-player";
    const isPlayer = role === "player" || role === "host-player";
    if (!enabled || !supabase || !code || (isPlayer && !name)) return;
    setRoomClosed(false);
    let mainReady = false;
    let privateReady = !isPlayer;
    let closed = false;
    let requestedRoleRevision = 0;
    let presenceTracked = false;
    let reconnectTimer: number | undefined;
    const scheduleReconnect = () => {
      if (closed || reconnectTimer) return;
      reconnectTimer = window.setTimeout(
        () => setReconnectAttempt((attempt) => attempt + 1),
        1_500 + Math.floor(Math.random() * 1_000),
      );
    };
    const roomCode = code.toUpperCase();
    const channel = supabase.channel(`room:${roomCode}`, {
      config: {
        broadcast: { self: true },
        presence: {
          key: role === "display" ? `display-${playerId}` : playerId,
        },
      },
    });
    channelRef.current = channel;

    const requestSync = async () => {
      if (!isPlayer || !mainReady || !privateReady || closed) return;
      await channel.send({
        type: "broadcast",
        event: "sync-request",
        payload: { playerId, nonce: crypto.randomUUID() },
      });
    };

    const trackPlayerWhenReady = async () => {
      if (
        !isPlayer ||
        !mainReady ||
        !privateReady ||
        presenceTracked ||
        closed
      )
        return;
      presenceTracked = true;
      await channel.track({
        id: playerId,
        name,
        ...profile,
        deviceRole: role === "host-player" ? "host-player" : "player",
      });
      void requestSync();
    };

    const replayPendingAction = () => {
      if (!isPlayer || !mainReady || closed) return;
      const saved = localStorage.getItem(storageKey("action", roomCode));
      if (!saved) return;
      try {
        const action = JSON.parse(saved) as GameAction;
        void channel.send({
          type: "broadcast",
          event: "game-action",
          payload: { ...action, playerId },
        });
      } catch {
        localStorage.removeItem(storageKey("action", roomCode));
      }
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<
          RoomPlayer & { deviceRole?: string }
        >();
        const next = Object.values(state).flat();
        setHostConnected(
          next.some(
            (entry) =>
              entry.deviceRole === "display" || entry.deviceRole === "host-player",
          ),
        );
        const playerPresences = next.filter(
          (entry) => entry.deviceRole !== "display",
        );
        const deduplicated = playerPresences.filter(
            (entry, index) =>
              playerPresences.findIndex((item) => item.id === entry.id) === index,
          ).sort((a, b) => a.id.localeCompare(b.id));
        const usedEmojis = new Set<string>();
        setPlayers(
          deduplicated.map((entry) => {
            let assigned = profiles.find((item) => item.emoji === entry.emoji) ?? profiles[0];
            if (usedEmojis.has(assigned.emoji)) {
              const start = [...entry.id].reduce(
                (sum, character) => sum + character.charCodeAt(0),
                0,
              );
              for (let offset = 0; offset < profiles.length; offset += 1) {
                const candidate = profiles[(start + offset) % profiles.length];
                if (!usedEmojis.has(candidate.emoji)) {
                  assigned = candidate;
                  break;
                }
              }
            }
            usedEmojis.add(assigned.emoji);
            return { ...entry, ...assigned };
          }),
        );
      })
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        if (payload?.id && payload?.name && payload?.text)
          setChat((current) => [...current.slice(-39), payload as RoomChat]);
      })
      .on("broadcast", { event: "private-role" }, ({ payload }) => {
        if (!isPlayer || payload?.targetId !== playerId || !payload?.role)
          return;
        setMyRole(payload.role as PalermoRole);
        const intel = Array.isArray(payload.teammates) ? payload.teammates as string[] : [];
        setRoleIntel(intel);
        localStorage.setItem(
          storageKey("role", roomCode),
          payload.role as string,
        );
        localStorage.setItem(storageKey("role-intel", roomCode), JSON.stringify(intel));
      })
      .on("broadcast", { event: "investigation-result" }, ({ payload }) => {
        if (
          !isPlayer ||
          payload?.targetId !== playerId ||
          typeof payload?.round !== "number" ||
          !payload?.targetName
        )
          return;
        const result = payload as InvestigationResult;
        setInvestigationResult(result);
        localStorage.setItem(
          storageKey("investigation", roomCode),
          JSON.stringify(result),
        );
      })
      .on("broadcast", { event: "game-state" }, ({ payload }) => {
        const state = payload as PalermoState;
        if (!state?.phase) return;
        setGameState((current) => {
          if ((current?.revision ?? 0) > (state.revision ?? 0)) return current;
          if (isPlayer)
            localStorage.setItem(
              storageKey("state", roomCode),
              JSON.stringify(state),
            );
          return state;
        });
        if (
          isPlayer &&
          state.phase === "role-reveal" &&
          state.revision > requestedRoleRevision
        ) {
          requestedRoleRevision = state.revision;
          window.setTimeout(() => void requestSync(), 200);
        }
      })
      .on("broadcast", { event: "game-action" }, ({ payload }) => {
        if (isHost && payload?.playerId)
          setActions((current) => {
            const action = payload as GameAction;
            return [
              ...current.filter(
                (item) =>
                  item.playerId !== action.playerId ||
                  item.kind !== action.kind,
              ),
              action,
            ];
          });
      })
      .on("broadcast", { event: "action-sync-request" }, () => {
        if (!isPlayer) return;
        const saved = localStorage.getItem(storageKey("action", roomCode));
        if (!saved) return;
        try {
          const action = JSON.parse(saved) as GameAction;
          void channel.send({
            type: "broadcast",
            event: "game-action",
            payload: { ...action, playerId },
          });
        } catch {
          localStorage.removeItem(storageKey("action", roomCode));
        }
      })
      .on("broadcast", { event: "sync-request" }, ({ payload }) => {
        if (isHost && payload?.playerId)
          setSyncRequests((current) => [
            ...current.slice(-19),
            payload.playerId as string,
          ]);
      })
      .on("broadcast", { event: "room-closed" }, () => {
        if (isPlayer && !isHost) {
          localStorage.removeItem(storageKey("state", roomCode));
          localStorage.removeItem(storageKey("role", roomCode));
          localStorage.removeItem(storageKey("role-intel", roomCode));
          localStorage.removeItem(storageKey("action", roomCode));
          localStorage.removeItem(storageKey("investigation", roomCode));
          setGameState(null);
          setMyRole(null);
          setRoleIntel([]);
          setInvestigationResult(null);
          setRoomClosed(true);
        }
      })
      .subscribe(async (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status !== "SUBSCRIBED") {
          if (
            status === "TIMED_OUT" ||
            status === "CHANNEL_ERROR" ||
            status === "CLOSED"
          )
            scheduleReconnect();
          return;
        }
        mainReady = true;
        if (isPlayer) await trackPlayerWhenReady();
        else
          await channel.track({
            id: `display-${playerId}`,
            name: "Display",
            emoji: "📺",
            color: "purple",
            deviceRole: "display",
          });
        if (isHost)
          void channel.send({
            type: "broadcast",
            event: "action-sync-request",
            payload: {},
          });
        replayPendingAction();
        void requestSync();
      });

    let privateChannel: RealtimeChannel | null = null;
    if (isPlayer) {
      privateChannel = supabase.channel(`room:${roomCode}:player:${playerId}`, {
        config: { broadcast: { self: true } },
      });
      privateChannel
        .on("broadcast", { event: "private-role" }, ({ payload }) => {
          if (!payload?.role) return;
          setMyRole(payload.role as PalermoRole);
          const intel = Array.isArray(payload.teammates) ? payload.teammates as string[] : [];
          setRoleIntel(intel);
          localStorage.setItem(
            storageKey("role", roomCode),
            payload.role as string,
          );
          localStorage.setItem(storageKey("role-intel", roomCode), JSON.stringify(intel));
        })
        .on("broadcast", { event: "investigation-result" }, ({ payload }) => {
          if (typeof payload?.round !== "number" || !payload?.targetName)
            return;
          const result = payload as InvestigationResult;
          setInvestigationResult(result);
          localStorage.setItem(
            storageKey("investigation", roomCode),
            JSON.stringify(result),
          );
        })
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            privateReady = true;
            void trackPlayerWhenReady();
            void requestSync();
          } else if (
            status === "TIMED_OUT" ||
            status === "CHANNEL_ERROR" ||
            status === "CLOSED"
          )
            scheduleReconnect();
        });
    }

    const leave = () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
    const recover = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      void requestSync();
      replayPendingAction();
    };
    window.addEventListener("pagehide", leave);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      closed = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      channelRef.current = null;
      setConnected(false);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
      leave();
      if (privateChannel) void supabase.removeChannel(privateChannel);
    };
  }, [code, enabled, name, playerId, profile, reconnectAttempt, role]);

  const broadcast = useCallback(async (event: string, payload: object) => {
    await channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);
  const sendChat = useCallback(
    (text: string) =>
      broadcast("chat-message", {
        id: crypto.randomUUID(),
        name,
        emoji: profile.emoji,
        text: text.trim(),
      }),
    [broadcast, name, profile],
  );
  const sendGameState = useCallback(
    (state: PalermoState) => broadcast("game-state", state),
    [broadcast],
  );
  const sendAction = useCallback(
    (action: GameAction) => {
      localStorage.setItem(storageKey("action", code), JSON.stringify(action));
      return broadcast("game-action", { ...action, playerId });
    },
    [broadcast, code, playerId],
  );
  const closeRoom = useCallback(async () => {
    await Promise.race([
      broadcast("room-closed", {}),
      new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
    ]);
  }, [broadcast]);
  const clearLocalRoom = useCallback(() => {
    for (const kind of ["state", "role", "role-intel", "action", "investigation"])
      localStorage.removeItem(storageKey(kind, code));
    setGameState(null);
    setMyRole(null);
    setRoleIntel([]);
    setInvestigationResult(null);
  }, [code]);

  const sendPrivateRole = useCallback(
    (targetId: string, roleToSend: PalermoRole, teammates: string[] = []) =>
      broadcast("private-role", { targetId, role: roleToSend, teammates }),
    [broadcast],
  );

  const sendPrivateInvestigation = useCallback(
    (targetId: string, result: InvestigationResult) =>
      broadcast("investigation-result", { targetId, ...result }),
    [broadcast],
  );

  return {
    enabled: Boolean(supabase),
    connected,
    hostConnected,
    roomClosed,
    playerId,
    players,
    chat,
    gameState,
    myRole,
    roleIntel,
    investigationResult,
    actions,
    syncRequests,
    sendChat,
    sendGameState,
    sendAction,
    sendPrivateRole,
    sendPrivateInvestigation,
    closeRoom,
    clearLocalRoom,
    clearActions: () => setActions([]),
    removePlayerActions: (id: string) =>
      setActions((current) => current.filter((action) => action.playerId !== id)),
    clearSyncRequests: () => setSyncRequests([]),
  };
}
