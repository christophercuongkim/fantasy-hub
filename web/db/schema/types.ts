// Shapes for jsonb columns. See data dictionary for the authoritative descriptions.

// leagues.scoring_json — the single most important object in the system. Every
// projection is computed against this stat-category -> point-value map.
export type ScoringJson = {
  stat_modifiers: Record<string, number>;
  fractional_points: boolean;
  negative_points: boolean;
};

// leagues.roster_positions_json — e.g. {"QB":1,"RB":2,"WR":2,"TE":1,"W/R/T":1,"K":1,"DEF":1,"BN":6}
export type RosterPositions = Record<string, number>;

// id_crosswalk_log.candidates_json — top-N alternatives for the review UI.
export type CrosswalkCandidate = {
  player_id: string;
  name: string;
  score: number;
  note?: string;
};
