import { expect, test } from "@playwright/test";
import { resolveNight, resolveVote, roleDeck, winnerFor, type PalermoPlayer, type PalermoRoles } from "../app/lib/palermo";

const players: PalermoPlayer[] = [
  { id: "m", name: "Mara", emoji: "🦊", color: "orange", alive: true },
  { id: "d", name: "Dev", emoji: "🌻", color: "yellow", alive: true },
  { id: "v1", name: "Val", emoji: "🐸", color: "green", alive: true },
  { id: "v2", name: "Vic", emoji: "🪩", color: "pink", alive: true },
];
const roles: PalermoRoles = { m: "mafia", d: "doctor", v1: "villager", v2: "detective" };

test("role decks scale and preserve core special roles", () => {
  expect(roleDeck(4).filter((role) => role === "mafia")).toHaveLength(1);
  expect(roleDeck(5)).toContain("doctor");
  expect(roleDeck(7).filter((role) => role === "mafia")).toHaveLength(2);
});

test("doctor saves, votes tie safely, and both win conditions resolve", () => {
  const saved = resolveNight(players, roles, { mafiaTarget: "v1", doctorTarget: "v1" });
  expect(saved.killedId).toBeUndefined();
  expect(saved.players.every((player) => player.alive)).toBe(true);

  const tied = resolveVote(players, { m: "v1", d: "v2", v1: "v2", v2: "v1" });
  expect(tied.tied).toBe(true);
  expect(tied.eliminatedId).toBeUndefined();

  expect(winnerFor(players.map((player) => ({ ...player, alive: player.id !== "m" })), roles)).toBe("town");
  expect(winnerFor(players.map((player) => ({ ...player, alive: player.id === "m" || player.id === "d" })), roles)).toBe("mafia");
});
