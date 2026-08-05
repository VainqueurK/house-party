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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export function useRoomSync({
  code,
  name,
  enabled,
}: {
  code: string;
  name: string;
  enabled: boolean;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [players, setPlayers] = useState<RoomPlayer[]>([]);
  const [event, setEvent] = useState<RoomEvent | null>(null);

  useEffect(() => {
    if (!enabled || !supabase || !code || !name) return;

    const channel = supabase.channel(`room:${code}`, {
      config: {
        broadcast: { self: true },
        presence: { key: `${name}-${crypto.randomUUID()}` },
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
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ name, emoji: "🦊", color: "orange" });
        }
      });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [code, enabled, name]);

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

  return { enabled: Boolean(supabase), players, event, send };
}
