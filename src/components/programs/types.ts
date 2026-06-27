import type { EquipmentType, MovementPattern } from "@/lib/taxonomy";

/** Shared form-action result shape used across the program builder dialogs. */
export type FormState = { ok?: boolean; error?: string };
export type FormAction = (
  prev: FormState,
  formData: FormData,
) => Promise<FormState>;
export type VoidAction = (formData: FormData) => Promise<void>;

/** One automatic alternative (same movement pattern + shared primary target). */
export type AlternativeSuggestion = {
  exerciseId: string;
  name: string;
  movementPattern: MovementPattern | null;
  equipmentType: EquipmentType | null;
  sharedPrimary: number;
  sharedSecondary: number;
};

/**
 * The server actions the shared program-detail view needs. Coach and athlete
 * pages each supply their own role-scoped implementations (different auth,
 * is_published default and revalidate/redirect paths); RLS authorises both.
 */
export type ProgramDetailActions = {
  updateProgram: FormAction;
  deleteProgram: VoidAction;
  createWorkout: FormAction;
  updateWorkout: FormAction;
  deleteWorkout: VoidAction;
  addWorkoutExercise: FormAction;
  updateWorkoutExercise: FormAction;
  deleteWorkoutExercise: VoidAction;
  moveWorkoutExercise: VoidAction;
  suggestAlternatives: (exerciseId: string) => Promise<AlternativeSuggestion[]>;
};
