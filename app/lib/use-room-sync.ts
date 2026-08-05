"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, type RealtimeChannel } from "@supabase/supabase-js";

export type RoomPlayer = {
  name: string;
  emoji: string;
  color: string;
  status?: string;
};

type RoomEvent = { type: "start" } | { type: "phase"; phase: "night" | "day" };
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
          await channel.track({ name, ...profile });
        }
      });

    const leaveRoom = () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
    window.addEventListener("pagehide", leaveRoom);

    return () => {
      channelRef.current = null;
      window.removeEventListener("pagehide", leaveRoom);
      leaveRoom();
    };
  }, [code, enabled, name, profile, role]);

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

  return { enabled: Boolean(supabase), players, event, chat, send, sendChat };
}
