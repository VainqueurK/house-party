export type PalermoRole = "mafia" | "detective" | "doctor" | "villager";
export type PalermoPhase = "role-reveal" | "night" | "discussion" | "voting" | "result" | "won";

export type PalermoPlayer = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  alive: boolean;
};

export type PalermoState = {
  revision: number;
  phase: PalermoPhase;
  round: number;
  endsAt: number;
  players: PalermoPlayer[];
  eliminatedId?: string;
  resultText?: string;
  winner?: "mafia" | "town";
};

export type PalermoRoles = Record<string, PalermoRole>;
export type PalermoActions = { mafiaTarget?: string; doctorTarget?: string; detectiveTarget?: string };

export function roleDeck(playerCount: number): PalermoRole[] {
  const mafia = playerCount >= 7 ? 2 : 1;
  const deck: PalermoRole[] = Array.from({ length: mafia }, () => "mafia");
  if (playerCount >= 4) deck.push("detective");
  if (playerCount >= 5) deck.push("doctor");
  while (deck.length < playerCount) deck.push("villager");
  return deck;
}

export function assignRoles(players: PalermoPlayer[]): PalermoRoles {
  const shuffled = [...roleDeck(players.length)].sort(() => Math.random() - 0.5);
  return Object.fromEntries(players.map((player, index) => [player.id, shuffled[index]]));
}

export function resolveNight(players: PalermoPlayer[], roles: PalermoRoles, actions: PalermoActions) {
  const alive = new Set(players.filter((player) => player.alive).map((player) => player.id));
  const mafiaTarget = actions.mafiaTarget && alive.has(actions.mafiaTarget) ? actions.mafiaTarget : undefined;
  const saved = actions.doctorTarget && alive.has(actions.doctorTarget) ? actions.doctorTarget : undefined;
  const killedId = mafiaTarget && mafiaTarget !== saved ? mafiaTarget : undefined;
  const nextPlayers = players.map((player) => ({ ...player, alive: player.alive && player.id !== killedId }));
  return { players: nextPlayers, killedId };
}

export function resolveVote(players: PalermoPlayer[], votes: Record<string, string>) {
  const counts = Object.values(votes).reduce<Record<string, number>>((result, target) => {
    result[target] = (result[target] ?? 0) + 1;
    return result;
  }, {});
  const ranked = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const top = ranked[0];
  const tied = top && ranked[1] && ranked[1][1] === top[1];
  const eliminatedId = top && !tied ? top[0] : undefined;
  return {
    players: players.map((player) => ({ ...player, alive: player.alive && player.id !== eliminatedId })),
    eliminatedId,
    tied: Boolean(tied),
  };
}

export function winnerFor(players: PalermoPlayer[], roles: PalermoRoles): "mafia" | "town" | undefined {
  const alive = players.filter((player) => player.alive);
  const mafia = alive.filter((player) => roles[player.id] === "mafia").length;
  if (mafia === 0) return "town";
  if (mafia >= alive.length - mafia) return "mafia";
  return undefined;
}

export const PHASE_LENGTHS: Record<PalermoPhase, number> = {
  "role-reveal": 25,
  night: 35,
  discussion: 60,
  voting: 30,
  result: 8,
  won: 0,
};
