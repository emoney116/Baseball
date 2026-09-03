import type { Player } from "../types.ts";
import { denseJerseyNumber, densePlayerIdentityLabel, formatDensePlayerName } from "../lib/densePlayerIdentity.ts";

export function DensePlayerIdentity({
  player,
  showJersey = true,
  className = "",
}: {
  player: Pick<Player, "name" | "jerseyNumber">;
  showJersey?: boolean;
  className?: string;
}) {
  const label = densePlayerIdentityLabel(player);
  const jerseyNumber = denseJerseyNumber(player);
  return (
    <span className={`dense-player-identity ${className}`.trim()} title={label} aria-label={label}>
      <span className="dense-player-identity__visual" aria-hidden="true">
        {showJersey && jerseyNumber && <span className="dense-player-identity__jersey">#{jerseyNumber}</span>}
        <span className="dense-player-identity__name">{formatDensePlayerName(player.name)}</span>
      </span>
    </span>
  );
}
