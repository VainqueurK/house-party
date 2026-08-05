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
];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = url && key ? createClient(url, key) : null;

function storageKey(kind: string, room: string) {
  return `house-party:${kind}:${room.toUpperCase()}`;
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
  role: "player" | "display";
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [chat, setChat] = useState<RoomChat[]>([]);
  const [gameState, setGameState] = useState<PalermoState | null>(null);
  const [myRole, setMyRole] = useState<PalermoRole | null>(null);
  const [investigationResult, setInvestigationResult] =
    useState<InvestigationResult | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [syncRequests, setSyncRequests] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [roomClosed, setRoomClosed] = useState(false);
  const [playerId] = useState(() => {
    if (typeof window === "undefined") return "server";
    const existing = localStorage.getItem("house-party:player-id");
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem("house-party:player-id", created);
    return created;
  });
  const profile = useMemo(() => {
    const source = name.trim().toLowerCase() || playerId;
    const hash = [...source].reduce(
      (sum, char, index) => sum + char.charCodeAt(0) * (index + 1),
      0,
    );
    return profiles[hash % profiles.length];
  }, [name, playerId]);

  useEffect(() => {
    if (!code || role !== "player") return;
    const savedRole = localStorage.getItem(
      storageKey("role", code),
    ) as PalermoRole | null;
    const savedState = localStorage.getItem(storageKey("state", code));
    const savedInvestigation = localStorage.getItem(
      storageKey("investigation", code),
    );
    setMyRole(savedRole);
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
    if (!enabled || !supabase || !code || (role === "player" && !name)) return;
    setRoomClosed(false);
    let mainReady = false;
    let privateReady = role === "display";
    let closed = false;
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
      if (role !== "player" || !mainReady || !privateReady || closed) return;
      await channel.send({
        type: "broadcast",
        event: "sync-request",
        payload: { playerId, nonce: crypto.randomUUID() },
      });
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<
          RoomPlayer & { deviceRole?: string }
        >();
        const next = Object.values(state)
          .flat()
          .filter((entry) => entry.deviceRole !== "display");
        setPlayers(
          next.filter(
            (entry, index) =>
              next.findIndex((item) => item.id === entry.id) === index,
          ),
        );
      })
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        if (payload?.id && payload?.name && payload?.text)
          setChat((current) => [...current.slice(-39), payload as RoomChat]);
      })
      .on("broadcast", { event: "game-state" }, ({ payload }) => {
        const state = payload as PalermoState;
        if (!state?.phase) return;
        setGameState((current) => {
          if ((current?.revision ?? 0) > (state.revision ?? 0)) return current;
          if (role === "player")
            localStorage.setItem(
              storageKey("state", roomCode),
              JSON.stringify(state),
            );
          return state;
        });
      })
      .on("broadcast", { event: "game-action" }, ({ payload }) => {
        if (role === "display" && payload?.playerId)
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
        if (role !== "player") return;
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
        if (role === "display" && payload?.playerId)
          setSyncRequests((current) => [
            ...current.slice(-19),
            payload.playerId as string,
          ]);
      })
      .on("broadcast", { event: "room-closed" }, () => {
        if (role === "player") {
          localStorage.removeItem(storageKey("state", roomCode));
          localStorage.removeItem(storageKey("role", roomCode));
          localStorage.removeItem(storageKey("action", roomCode));
          localStorage.removeItem(storageKey("investigation", roomCode));
          setRoomClosed(true);
        }
      })
      .subscribe(async (status) => {
        setConnected(status === "SUBSCRIBED");
        if (status !== "SUBSCRIBED") return;
        mainReady = true;
        if (role === "player")
          await channel.track({ id: playerId, name, ...profile });
        else
          await channel.track({
            id: `display-${playerId}`,
            name: "Display",
            emoji: "📺",
            color: "purple",
            deviceRole: "display",
          });
        if (role === "display")
          void channel.send({
            type: "broadcast",
            event: "action-sync-request",
            payload: {},
          });
        void requestSync();
      });

    let privateChannel: RealtimeChannel | null = null;
    if (role === "player") {
      privateChannel = supabase.channel(`room:${roomCode}:player:${playerId}`, {
        config: { broadcast: { self: true } },
      });
      privateChannel
        .on("broadcast", { event: "private-role" }, ({ payload }) => {
          if (!payload?.role) return;
          setMyRole(payload.role as PalermoRole);
          localStorage.setItem(
            storageKey("role", roomCode),
            payload.role as string,
          );
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
            void requestSync();
          }
        });
    }

    const leave = () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
    window.addEventListener("pagehide", leave);
    return () => {
      closed = true;
      channelRef.current = null;
      setConnected(false);
      window.removeEventListener("pagehide", leave);
      leave();
      if (privateChannel) void supabase.removeChannel(privateChannel);
    };
  }, [code, enabled, name, playerId, profile, role]);

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

  const sendPrivateRole = useCallback(
    async (targetId: string, roleToSend: PalermoRole) => {
      if (!supabase) return;
      const target = supabase.channel(
        `room:${code.toUpperCase()}:player:${targetId}`,
      );
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 5000);
        target.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await target.send({
              type: "broadcast",
              event: "private-role",
              payload: { role: roleToSend },
            });
            window.clearTimeout(timeout);
            resolve();
          }
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
      void supabase.removeChannel(target);
    },
    [code],
  );

  const sendPrivateInvestigation = useCallback(
    async (targetId: string, result: InvestigationResult) => {
      if (!supabase) return;
      const target = supabase.channel(
        `room:${code.toUpperCase()}:player:${targetId}`,
      );
      await new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, 5000);
        target.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await target.send({
              type: "broadcast",
              event: "investigation-result",
              payload: result,
            });
            window.clearTimeout(timeout);
            resolve();
          }
          if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            window.clearTimeout(timeout);
            resolve();
          }
        });
      });
      void supabase.removeChannel(target);
    },
    [code],
  );

  return {
    enabled: Boolean(supabase),
    connected,
    roomClosed,
    playerId,
    players,
    chat,
    gameState,
    myRole,
    investigationResult,
    actions,
    syncRequests,
    sendChat,
    sendGameState,
    sendAction,
    sendPrivateRole,
    sendPrivateInvestigation,
    closeRoom,
    clearActions: () => setActions([]),
    clearSyncRequests: () => setSyncRequests([]),
  };
}
