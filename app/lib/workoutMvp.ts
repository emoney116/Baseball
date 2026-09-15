type Candidate = { player: { id: string; name: string }; resultCount: number; exerciseCount: number; prs: number; completion: number };

// Reward documented progress first, then participation; never compare pounds to seconds.
export function workoutMvp<T extends Candidate>(rows: T[]): T | undefined {
  return rows.filter(row => row.resultCount > 0).sort((a,b) =>
    b.prs-a.prs || Math.min(100,b.completion)-Math.min(100,a.completion) || b.exerciseCount-a.exerciseCount || a.player.name.localeCompare(b.player.name) || a.player.id.localeCompare(b.player.id)
  )[0];
}
