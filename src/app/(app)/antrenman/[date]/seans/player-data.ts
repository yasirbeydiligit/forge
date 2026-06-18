/**
 * Serializable data the server page hands to the client <SessionPlayer />.
 * Display-oriented (names, targets, history) plus the already-logged sets used
 * to resume an in-progress session.
 */
import type { AthleteInsight } from "@/lib/rag/insights-server";
import type { ServerSet } from "@/lib/session/reducer";
import type { ExerciseTarget } from "@/lib/session/types";

export type PlayerStats = {
  bestEst1RM: number | null;
  allTimePr: number | null;
  allTimePrDate: string | null;
  prevSessionWeights: number[];
  volume4w: number;
  avgRpe4w: number | null;
  recentSessions: { date: string; scheme: string }[];
  trendPoints: number[];
  trendDelta: number | null;
};

export type PlayerExercise = {
  workoutExerciseId: string;
  exerciseId: string;
  name: string;
  category: string | null;
  notes: string | null;
  target: ExerciseTarget;
  stats: PlayerStats;
  /** Sets already logged on the server (resume). */
  serverSets: ServerSet[];
};

export type PlayerData = {
  date: string;
  assignmentId: string;
  workoutId: string;
  workoutName: string;
  /** created_at of an existing session, as ms epoch; null if not yet started. */
  startedAtMs: number | null;
  completed: boolean;
  /** Existing session note (resume / edit on the summary). */
  initialNote: string;
  exercises: PlayerExercise[];
  /** Contextual research notes shown on the finish summary. */
  insights: AthleteInsight[];
};
