"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";
import type { PalermoRole, PalermoState } from "./palermo";

export type RoomPlayer = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  status?: string;
};

type RoomEvent = { type: "start" } | { type: "phase"; phase: "night" | "day" };
export type GameAction = { kind: "mafia" | "doctor" | "detective" | "vote"; targetId: string; playerId?: string };
export type RoomChat = { id: string; name: string; emoji: string; text: string };

const profileOptions = [
  { emoji: "🦊", color: "orange" },
  { emoji: "🌻", color: "yellow" },
  { emoji: "🐸", color: "green" },
  { emoji: "🪩", color: "pink" },
  { emoji: "🧢", color: "blue" },
  { emoji: "🌙", color: "purple" },
  { emoji: "🐙", color: "coral" },
  { emoji: "🦋", color: "mint" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const [event, setEvent] = useState<RoomEvent | null>(null);
  const [chat, setChat] = useState<RoomChat[]>([]);
  const [gameState, setGameState] = useState<PalermoState | null>(null);
  const [myRole, setMyRole] = useState<PalermoRole | null>(null);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [playerId] = useState(() => {
    if (typeof window === "undefined") return "server";
    const key = "house-party-player-id";
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(key, created);
    return created;
  });
  const profile = useMemo(
    () => profileOptions[Math.abs([...name].reduce((sum, character) => sum + character.charCodeAt(0), 0)) % profileOptions.length],
    [name],
  );

  useEffect(() => {
    if (!enabled || !supabase || !code || (role === "player" && !name)) return;

    const channel = supabase.channel(`room:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: `${name || "display"}-${crypto.randomUUID()}` },
      },
    });
    channelRef.current = channel;

    const syncPresence = () => {
      const state = channel.presenceState<RoomPlayer>();
      const nextPlayers = Object.values(state)
        .flat()
        .filter((player, index, list) => list.findIndex((item) => item.name === player.name) === index);
      setPlayers(nextPlayers);
    };

    channel
      .on("presence", { event: "sync" }, syncPresence)
      .on("broadcast", { event: "game-start" }, () => setEvent({ type: "start" }))
      .on("broadcast", { event: "phase-change" }, ({ payload }) => {
        if (payload?.phase === "night" || payload?.phase === "day") {
          setEvent({ type: "phase", phase: payload.phase });
        }
      })
      .on("broadcast", { event: "chat-message" }, ({ payload }) => {
        if (payload?.id && payload?.name && payload?.text) {
          setChat((current) => [...current.slice(-39), payload as RoomChat]);
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && role === "player") {
          await channel.track({ id: playerId, name, ...profile });
        }
      });

    let privateChannel: RealtimeChannel | null = null;
    if (role === "player") {
      privateChannel = supabase.channel(`room:${code}:player:${playerId}`, { config: { broadcast: { self: true } } });
      privateChannel
        .on("broadcast", { event: "private-role" }, ({ payload }) => {
          if (payload?.role) setMyRole(payload.role as PalermoRole);
        })
        .subscribe();
    }

    const leaveRoom = () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
    window.addEventListener("pagehide", leaveRoom);

    return () => {
      channelRef.current = null;
      window.removeEventListener("pagehide", leaveRoom);
      leaveRoom();
      if (privateChannel) void supabase.removeChannel(privateChannel);
    };
  }, [code, enabled, name, playerId, profile, role]);

  const send = useMemo(
    () => async (nextEvent: RoomEvent) => {
      const channel = channelRef.current;
      if (!channel) return;
      const eventName = nextEvent.type === "start" ? "game-start" : "phase-change";
      await channel.send({
        type: "broadcast",
        event: eventName,
        payload: nextEvent.type === "phase" ? { phase: nextEvent.phase } : {},
      });
    },
    [],
  );

  const sendChat = useMemo(
    () => async (text: string) => {
      const channel = channelRef.current;
      if (!channel || !text.trim()) return;
      await channel.send({
        type: "broadcast",
        event: "chat-message",
        payload: { id: crypto.randomUUID(), name, emoji: profile.emoji, text: text.trim() },
      });
    },
    [name, profile],
  );

  const sendGameState = useMemo(
    () => async (state: PalermoState) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({ type: "broadcast", event: "game-state", payload: state });
    },
    [],
  );

  const sendAction = useMemo(
    () => async (action: GameAction) => {
      const channel = channelRef.current;
      if (!channel) return;
      await channel.send({ type: "broadcast", event: "game-action", payload: { ...action, playerId } });
    },
    [playerId],
  );

  const sendPrivateRole = useMemo(
    () => async (targetPlayerId: string, roleToSend: PalermoRole) => {
      if (!supabase) return;
      const target = supabase.channel(`room:${code}:player:${targetPlayerId}`, { config: { broadcast: { self: true } } });
      await new Promise<void>((resolve) => {
        target.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await target.send({ type: "broadcast", event: "private-role", payload: { role: roleToSend } });
            resolve();
          }
        });
      });
      void supabase.removeChannel(target);
    },
    [code],
  );

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel) return;
    const onState = ({ payload }: { payload: PalermoState }) => setGameState(payload);
    const onAction = ({ payload }: { payload: GameAction & { playerId: string } }) => {
      if (role === "display" && payload?.playerId) setActions((current) => [...current, payload]);
    };
    channel.on("broadcast", { event: "game-state" }, onState).on("broadcast", { event: "game-action" }, onAction);
    return () => undefined;
  }, [role, enabled]);

  const clearActions = useMemo(() => () => setActions([]), []);

  return { enabled: Boolean(supabase), playerId, players, event, chat, gameState, myRole, actions, send, sendChat, sendGameState, sendAction, sendPrivateRole, clearActions };
}
