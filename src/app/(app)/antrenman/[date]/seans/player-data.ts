/**
 * Serializable data the server page hands to the client <SessionPlayer />.
 * Display-oriented (names, targets, history) plus the already-logged sets used
 * to resume an in-progress session.
 */
import type { PRSet } from "@/lib/pr/evaluate-pr";
import type { AthleteInsight } from "@/lib/rag/insights-server";
import type { ServerSet } from "@/lib/session/reducer";
import type { ExerciseTarget } from "@/lib/session/types";

export type PlayerStats = {
  /** Heaviest weight ever lifted (observed, not a formula). */
  allTimePr: number | null;
  allTimePrDate: string | null;
  prevSessionWeights: number[];
  prevSessionSets: { weight: number; reps: number | null }[];
  /** Set-count volume over the trailing 28 days. */
  volumeSets4w: number;
  avgRir4w: number | null;
  /** PR frontier for the live evaluatePR check. */
  prHistory: PRSet[];
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
