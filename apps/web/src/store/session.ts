// The current actor (member id) attributed to ops. Set once at startup.
let actorId: string | null = null;
let teamId: string | null = null;

export function setSession(s: { actorId: string | null; teamId: string | null }) {
  actorId = s.actorId;
  teamId = s.teamId;
}
export const getActorId = () => actorId;
export const getTeamId = () => teamId;
