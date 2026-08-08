export type PalermoRole = "mafia" | "detective" | "doctor" | "villager";
export type PalermoPhase =
  | "role-reveal"
  | "night"
  | "night-result"
  | "discussion"
  | "voting"
  | "vote-result"
  | "won";

export type PalermoCinematic =
  | {
      id: string;
      kind: "night";
      attackedId?: string;
      killedId?: string;
      protected: boolean;
    }
  | { id: string; kind: "vote"; eliminatedId?: string; tied: boolean };

export type PalermoPlayer = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  alive: boolean;
  disconnectedAt?: number;
  departedAt?: number;
};

export type PalermoState = {
  revision: number;
  phase: PalermoPhase;
  round: number;
  endsAt: number;
  phaseDuration?: number;
  players: PalermoPlayer[];
  screenMode?: "shared" | "everyone";
  eliminatedId?: string;
  resultText?: string;
  winner?: "mafia" | "town";
  cinematic?: PalermoCinematic;
  createdAt?: number;
  lastActivityAt?: number;
  endedReason?: "host-ended" | "not-enough-players";
  notice?: { id: string; message: string };
};

export type PalermoRoles = Record<string, PalermoRole>;
export type PalermoActions = {
  mafiaTarget?: string;
  doctorTarget?: string;
  detectiveTarget?: string;
};

export const PLAYER_ABSENCE_GRACE_MS = 90_000;
export const ROOM_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function isActivePlayer(player: PalermoPlayer) {
  return player.alive && !player.departedAt;
}

export function pluralityTarget(targets: string[]) {
  const ranking = Object.entries(
    targets.reduce<Record<string, number>>((counts, target) => {
      counts[target] = (counts[target] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort(([, a], [, b]) => b - a);
  return ranking[0] && ranking[0][1] !== ranking[1]?.[1]
    ? ranking[0][0]
    : undefined;
}

export function resolvePlayerDeparture(
  players: PalermoPlayer[],
  roles: PalermoRoles,
  playerId: string,
) {
  const departing = players.find((player) => player.id === playerId);
  if (!departing || departing.departedAt)
    return { players, roles, reassignedPlayerId: undefined, winner: winnerFor(players, roles) };

  const nextPlayers = players.map((player) =>
    player.id === playerId
      ? { ...player, alive: false, departedAt: Date.now(), disconnectedAt: undefined }
      : player,
  );
  const nextRoles = { ...roles };
  const departedRole = roles[playerId];
  const remainingMafia = nextPlayers.filter(
    (player) => isActivePlayer(player) && nextRoles[player.id] === "mafia",
  ).length;
  const roleNeedsReplacement =
    departedRole === "doctor" ||
    departedRole === "detective" ||
    (departedRole === "mafia" && remainingMafia === 0);
  const replacement = roleNeedsReplacement
    ? nextPlayers.find(
        (player) => isActivePlayer(player) && nextRoles[player.id] === "villager",
      )
    : undefined;
  if (replacement && departedRole) nextRoles[replacement.id] = departedRole;
  delete nextRoles[playerId];
  return {
    players: nextPlayers,
    roles: nextRoles,
    reassignedPlayerId: replacement?.id,
    winner: winnerFor(nextPlayers, nextRoles),
  };
}

export function roleDeck(playerCount: number): PalermoRole[] {
  const mafia =
    playerCount >= 19
      ? 5
      : playerCount >= 15
        ? 4
        : playerCount >= 11
          ? 3
          : playerCount >= 7
            ? 2
            : 1;
  const deck: PalermoRole[] = Array.from({ length: mafia }, () => "mafia");
  if (playerCount >= 4) deck.push("detective");
  if (playerCount >= 5) deck.push("doctor");
  while (deck.length < playerCount) deck.push("villager");
  return deck;
}

export function assignRoles(players: PalermoPlayer[]): PalermoRoles {
  const shuffled = [...roleDeck(players.length)].sort(
    () => Math.random() - 0.5,
  );
  return Object.fromEntries(
    players.map((player, index) => [player.id, shuffled[index]]),
  );
}

export function resolveNight(
  players: PalermoPlayer[],
  roles: PalermoRoles,
  actions: PalermoActions,
) {
  const alive = new Set(
    players.filter(isActivePlayer).map((player) => player.id),
  );
  const mafiaTarget =
    actions.mafiaTarget && alive.has(actions.mafiaTarget)
      ? actions.mafiaTarget
      : undefined;
  const saved =
    actions.doctorTarget && alive.has(actions.doctorTarget)
      ? actions.doctorTarget
      : undefined;
  const killedId =
    mafiaTarget && mafiaTarget !== saved ? mafiaTarget : undefined;
  const nextPlayers = players.map((player) => ({
    ...player,
    alive: player.alive && player.id !== killedId,
  }));
  return { players: nextPlayers, killedId };
}

export function resolveVote(
  players: PalermoPlayer[],
  votes: Record<string, string>,
) {
  const active = new Set(players.filter(isActivePlayer).map((player) => player.id));
  const validVotes = Object.entries(votes)
    .filter(([voter, target]) => active.has(voter) && active.has(target))
    .map(([, target]) => target);
  const counts = validVotes.reduce<Record<string, number>>(
    (result, target) => {
      result[target] = (result[target] ?? 0) + 1;
      return result;
    },
    {},
  );
  const ranked = Object.entries(counts).sort(([, a], [, b]) => b - a);
  const top = ranked[0];
  const tied = top && ranked[1] && ranked[1][1] === top[1];
  const eliminatedId = top && !tied ? top[0] : undefined;
  return {
    players: players.map((player) => ({
      ...player,
      alive: player.alive && player.id !== eliminatedId,
    })),
    eliminatedId,
    tied: Boolean(tied),
  };
}

export function winnerFor(
  players: PalermoPlayer[],
  roles: PalermoRoles,
): "mafia" | "town" | undefined {
  const alive = players.filter(isActivePlayer);
  const mafia = alive.filter((player) => roles[player.id] === "mafia").length;
  if (mafia === 0) return "town";
  if (mafia >= alive.length - mafia) return "mafia";
  return undefined;
}

export const PHASE_LENGTHS: Record<PalermoPhase, number> = {
  "role-reveal": 25,
  night: 35,
  "night-result": 14,
  discussion: 60,
  voting: 30,
  "vote-result": 12,
  won: 0,
};

export function phaseDurationFor(phase: PalermoPhase, playerCount: number) {
  if (phase === "role-reveal") return Math.min(40, 25 + Math.max(0, playerCount - 8));
  if (phase === "night") return Math.min(55, 35 + Math.max(0, playerCount - 8) * 2);
  if (phase === "discussion") return Math.min(150, 60 + Math.max(0, playerCount - 6) * 8);
  if (phase === "voting") return Math.min(55, 30 + Math.max(0, playerCount - 8) * 2);
  return PHASE_LENGTHS[phase];
}
