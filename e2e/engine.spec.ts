import { expect, test } from "@playwright/test";
import { phaseDurationFor, pluralityTarget, resolveNight, resolvePlayerDeparture, resolveVote, roleDeck, winnerFor, type PalermoPlayer, type PalermoRoles } from "../app/lib/palermo";

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
  expect(roleDeck(15).filter((role) => role === "mafia")).toHaveLength(4);
  expect(roleDeck(20)).toHaveLength(20);
  expect(roleDeck(20).filter((role) => role === "mafia")).toHaveLength(5);
  expect(phaseDurationFor("discussion", 20)).toBe(150);
  expect(phaseDurationFor("voting", 20)).toBe(54);
});

test("large Mafia teams require a clear plurality target", () => {
  expect(pluralityTarget(["a", "a", "b", "c"])).toBe("a");
  expect(pluralityTarget(["a", "a", "b", "b"])).toBeUndefined();
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

test("departed villagers are retired without changing hidden roles", () => {
  const result = resolvePlayerDeparture(players, roles, "v1");
  expect(result.players.find((player) => player.id === "v1")).toMatchObject({
    alive: false,
  });
  expect(result.players.find((player) => player.id === "v1")?.departedAt).toBeTruthy();
  expect(result.roles.v1).toBeUndefined();
  expect(result.reassignedPlayerId).toBeUndefined();
});

test("a missing key role is privately reassigned to an active villager", () => {
  const result = resolvePlayerDeparture(players, roles, "d");
  expect(result.reassignedPlayerId).toBe("v1");
  expect(result.roles.v1).toBe("doctor");
  expect(result.roles.d).toBeUndefined();
});

test("the last mafia seat is preserved when a villager can inherit it", () => {
  const result = resolvePlayerDeparture(players, roles, "m");
  expect(result.reassignedPlayerId).toBe("v1");
  expect(result.roles.v1).toBe("mafia");
  expect(result.winner).toBeUndefined();
});

test("departed players cannot be targeted or counted toward victory", () => {
  const departed = players.map((player) =>
    player.id === "v1" ? { ...player, departedAt: Date.now() } : player,
  );
  const night = resolveNight(departed, roles, { mafiaTarget: "v1" });
  expect(night.killedId).toBeUndefined();
  expect(winnerFor(departed, roles)).toBeUndefined();
  const vote = resolveVote(departed, {
    m: "v1",
    d: "v1",
    v1: "m",
    v2: "m",
  });
  expect(vote.eliminatedId).toBe("m");
  expect(vote.tied).toBe(false);
});
