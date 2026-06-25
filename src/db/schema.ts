/**
 * Drizzle schema — the single source of truth for the database structure.
 *
 * Architecture note: application data access happens through the Supabase
 * client (which carries the end-user's JWT) so that Row Level Security is the
 * authoritative access-control layer. Drizzle is used to define the schema and
 * generate SQL migrations. RLS policies, triggers and storage buckets live in a
 * companion custom SQL migration (see drizzle/ output).
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/** auth.users lives in the Supabase `auth` schema; we only reference its uuid. */
const authUserId = (name: string) => uuid(name);

/**
 * pgvector column type. drizzle-kit has no native `vector` type, so we declare a
 * customType whose dataType() emits the correct DDL (`vector(1024)`). The vector
 * extension itself, plus the HNSW / GIN indexes, live in a companion SQL migration.
 *
 * DDL-only: there is no toDriver/fromDriver because embeddings are written via the
 * service-role Supabase client (not Drizzle ORM round-trips), so the column never
 * needs JS<->driver value mapping — only its column type emitted into migrations.
 */
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1024)";
  },
});

export const userRole = pgEnum("user_role", ["coach", "athlete"]);
export const enrollmentStatus = pgEnum("enrollment_status", [
  "active",
  "paused",
  "completed",
]);
export const librarySourceType = pgEnum("library_source_type", [
  "paper",
  "book",
  "handout",
]);
export const documentStatus = pgEnum("document_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);

/**
 * Exercise taxonomy enums — the backbone of alternative matching and reporting.
 * Canonical machine values live here (type-safe, stable, used as the matching
 * key); Turkish display labels are a code-level map (see src/lib/taxonomy.ts).
 */
export const movementPattern = pgEnum("movement_pattern", [
  "push_horizontal",
  "push_vertical",
  "pull_horizontal",
  "pull_vertical",
  "squat",
  "hinge",
  "lunge",
  "isolation",
  "carry",
  "core",
  "rotation",
]);
export const equipmentType = pgEnum("equipment_type", [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "smith",
  "ez_bar",
  "trap_bar",
  "other",
]);
export const muscleRegion = pgEnum("muscle_region", ["upper", "lower", "core"]);
export const exerciseMuscleRole = pgEnum("exercise_muscle_role", [
  "primary",
  "secondary",
]);

/* -------------------------------------------------------------------------- */
/*  Identity                                                                  */
/* -------------------------------------------------------------------------- */

export const profiles = pgTable("profiles", {
  // Mirrors auth.users.id (FK added in custom migration to auth.users).
  id: uuid("id").primaryKey(),
  role: userRole("role").notNull().default("athlete"),
  fullName: text("full_name").notNull(),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    token: text("token").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    usedBy: uuid("used_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("invites_token_key").on(t.token)],
);

/* -------------------------------------------------------------------------- */
/*  Exercise library & programs                                               */
/* -------------------------------------------------------------------------- */

export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    // Stable human-readable key for system exercises; the CSV import upserts on
    // it so re-imports update in place instead of duplicating. Nullable: ad-hoc
    // user exercises (later phase) may have none.
    slug: text("slug"),
    // Legacy free-text grouping label, kept for existing UI; the taxonomy below
    // (movement_pattern + muscle targets) is the real classification.
    category: text("category"),
    // Optional finer sub-region label (e.g. "Üst Göğüs", "Arka Omuz"), free text.
    region: text("region"),
    description: text("description"),
    videoUrl: text("video_url"),
    movementPattern: movementPattern("movement_pattern"),
    equipmentType: equipmentType("equipment_type"),
    // Forge-provided (visible to everyone) vs user/coach-defined (owner-only).
    isSystem: boolean("is_system").notNull().default(false),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("exercises_name_idx").on(t.name),
    index("exercises_pattern_idx").on(t.movementPattern),
    unique("exercises_slug_key").on(t.slug),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Exercise taxonomy: muscles, functions, targets, alternatives              */
/* -------------------------------------------------------------------------- */

/**
 * A muscle. Carries both a Turkish display name and the Latin/technical name.
 * `slug` is the stable key the CSV import and muscle_functions reference.
 */
export const muscles = pgTable(
  "muscles",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: text("slug").notNull(),
    nameTr: text("name_tr").notNull(),
    nameLatin: text("name_latin"),
    region: muscleRegion("region").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("muscles_slug_key").on(t.slug)],
);

/**
 * A distinct FUNCTION of a muscle (one muscle can have several). This is what
 * makes "Lat shoulder-extension" vs "Lat shoulder-adduction" separable, so a
 * Pullover and a Lat Pulldown both hit the lat but via different functions.
 * Globally-unique `slug` so the CSV references a target by function slug alone
 * (the muscle is derivable through the FK).
 */
export const muscleFunctions = pgTable(
  "muscle_functions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    muscleId: uuid("muscle_id")
      .notNull()
      .references(() => muscles.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    nameTr: text("name_tr").notNull(),
    nameTechnical: text("name_technical"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("muscle_functions_slug_key").on(t.slug),
    index("muscle_functions_muscle_idx").on(t.muscleId),
  ],
);

/**
 * Links an exercise to a (muscle + function) pair with a role. Reporting tracks
 * volume per muscle_function_id, so swapping to an alternative that shares the
 * same primary target keeps the muscle/function history continuous.
 */
export const exerciseMuscleTargets = pgTable(
  "exercise_muscle_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    muscleFunctionId: uuid("muscle_function_id")
      .notNull()
      .references(() => muscleFunctions.id, { onDelete: "restrict" }),
    role: exerciseMuscleRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("exercise_muscle_targets_unique").on(
      t.exerciseId,
      t.muscleFunctionId,
    ),
    index("exercise_muscle_targets_exercise_idx").on(t.exerciseId),
    index("exercise_muscle_targets_function_idx").on(t.muscleFunctionId),
  ],
);

/**
 * Manually-curated alternative pairing (coach says X ≈ Y). Stored as a single
 * row; lookups treat it as SYMMETRIC (match on either side). Automatic
 * suggestions (same movement_pattern + shared primary target) come from the
 * public.suggest_exercise_alternatives() SQL function, not this table.
 */
export const exerciseAlternatives = pgTable(
  "exercise_alternatives",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    alternativeId: uuid("alternative_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("exercise_alternatives_unique").on(t.exerciseId, t.alternativeId),
    check(
      "exercise_alternatives_distinct",
      sql`${t.exerciseId} <> ${t.alternativeId}`,
    ),
    index("exercise_alternatives_exercise_idx").on(t.exerciseId),
  ],
);

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("programs_created_by_idx").on(t.createdBy)],
);

export const workouts = pgTable(
  "workouts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workouts_program_idx").on(t.programId, t.orderIndex)],
);

export const workoutExercises = pgTable(
  "workout_exercises",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    orderIndex: integer("order_index").notNull().default(0),
    targetSets: integer("target_sets"),
    targetRepsMin: integer("target_reps_min"),
    targetRepsMax: integer("target_reps_max"),
    targetWeight: numeric("target_weight", { precision: 6, scale: 2 }),
    // RIR (Reps in Reserve), 0–10, 0.5 steps; always optional. Replaces RPE.
    targetRir: numeric("target_rir", { precision: 3, scale: 1 }),
    restSeconds: integer("rest_seconds"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workout_exercises_workout_idx").on(t.workoutId, t.orderIndex),
    check(
      "workout_exercises_target_rir_range",
      sql`${t.targetRir} IS NULL OR (${t.targetRir} >= 0 AND ${t.targetRir} <= 10)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Scheduling & enrollment                                                   */
/* -------------------------------------------------------------------------- */

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    status: enrollmentStatus("status").notNull().default("active"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("enrollments_program_athlete_key").on(t.programId, t.athleteId),
    index("enrollments_athlete_idx").on(t.athleteId),
  ],
);

export const calendarAssignments = pgTable(
  "calendar_assignments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id")
      .notNull()
      .references(() => workouts.id, { onDelete: "cascade" }),
    scheduledDate: date("scheduled_date").notNull(),
    // null => applies to every athlete enrolled in the program.
    // set  => a personal assignment for a single athlete.
    athleteId: uuid("athlete_id").references(() => profiles.id, {
      onDelete: "cascade",
    }),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("calendar_program_date_idx").on(t.programId, t.scheduledDate),
    index("calendar_athlete_date_idx").on(t.athleteId, t.scheduledDate),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Logbook                                                                   */
/* -------------------------------------------------------------------------- */

export const logSessions = pgTable(
  "log_sessions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    workoutId: uuid("workout_id").references(() => workouts.id, {
      onDelete: "set null",
    }),
    assignmentId: uuid("assignment_id").references(
      () => calendarAssignments.id,
      { onDelete: "set null" },
    ),
    sessionDate: date("session_date").notNull(),
    notes: text("notes"),
    completed: boolean("completed").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("log_sessions_athlete_date_idx").on(t.athleteId, t.sessionDate),
    unique("log_sessions_athlete_assignment_key").on(
      t.athleteId,
      t.assignmentId,
    ),
  ],
);

export const logSets = pgTable(
  "log_sets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => logSessions.id, { onDelete: "cascade" }),
    workoutExerciseId: uuid("workout_exercise_id").references(
      () => workoutExercises.id,
      { onDelete: "set null" },
    ),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "restrict" }),
    setNumber: integer("set_number").notNull(),
    weight: numeric("weight", { precision: 6, scale: 2 }),
    reps: integer("reps"),
    // RIR (Reps in Reserve), 0–10, 0.5 steps; always optional. Replaces RPE.
    rir: numeric("rir", { precision: 3, scale: 1 }),
    notes: text("notes"),
    // Client-stamped time the set was completed (for accurate rest/time-distribution
    // reports). Survives offline queueing; legacy rows fall back to created_at.
    performedAt: timestamp("performed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("log_sets_session_idx").on(t.sessionId),
    index("log_sets_exercise_idx").on(t.exerciseId),
    check(
      "log_sets_rir_range",
      sql`${t.rir} IS NULL OR (${t.rir} >= 0 AND ${t.rir} <= 10)`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Community feed                                                            */
/* -------------------------------------------------------------------------- */

export const feedPosts = pgTable(
  "feed_posts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    isQuestion: boolean("is_question").notNull().default(true),
    answered: boolean("answered").notNull().default(false),
    answeredBy: uuid("answered_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feed_posts_created_idx").on(t.createdAt)],
);

export const feedComments = pgTable(
  "feed_comments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .notNull()
      .references(() => feedPosts.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("feed_comments_post_idx").on(t.postId, t.createdAt)],
);

export const feedLikes = pgTable(
  "feed_likes",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    postId: uuid("post_id")
      .notNull()
      .references(() => feedPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("feed_likes_post_user_key").on(t.postId, t.userId)],
);

/* -------------------------------------------------------------------------- */
/*  Daily wellness tracker                                                    */
/* -------------------------------------------------------------------------- */

export const dailyMetrics = pgTable(
  "daily_metrics",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    metricDate: date("metric_date").notNull(),
    weight: numeric("weight", { precision: 5, scale: 2 }),
    sleepHours: numeric("sleep_hours", { precision: 3, scale: 1 }),
    restingHr: integer("resting_hr"),
    energy: integer("energy"),
    hunger: integer("hunger"),
    adherence: integer("adherence"),
    waterMl: integer("water_ml"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("daily_metrics_athlete_date_key").on(t.athleteId, t.metricDate),
    index("daily_metrics_athlete_date_idx").on(t.athleteId, t.metricDate),
  ],
);

/* -------------------------------------------------------------------------- */
/*  Nutrition                                                                 */
/* -------------------------------------------------------------------------- */

export const nutritionTargets = pgTable(
  "nutrition_targets",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kcal: integer("kcal"),
    protein: integer("protein"),
    carbs: integer("carbs"),
    fat: integer("fat"),
    waterMl: integer("water_ml"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("nutrition_targets_athlete_key").on(t.athleteId)],
);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    mealDate: date("meal_date").notNull(),
    eatenAt: time("eaten_at"),
    name: text("name").notNull(),
    description: text("description"),
    kcal: integer("kcal"),
    protein: integer("protein"),
    carbs: integer("carbs"),
    fat: integer("fat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("meals_athlete_date_idx").on(t.athleteId, t.mealDate)],
);

/* -------------------------------------------------------------------------- */
/*  Research library (RAG)                                                     */
/* -------------------------------------------------------------------------- */

export const libraryDocuments = pgTable(
  "library_documents",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    authors: text("authors"),
    sourceType: librarySourceType("source_type").notNull(),
    sourceUrl: text("source_url"),
    doi: text("doi"),
    year: integer("year"),
    license: text("license"),
    storagePath: text("storage_path"),
    pageCount: integer("page_count"),
    status: documentStatus("status").notNull().default("pending"),
    error: text("error"),
    // Set only once ingestion reaches `ready`; pending rows leave it NULL, and
    // Postgres treats NULLs as distinct, so the unique constraint never matches
    // (dedup/upsert on content_hash won't collide with pending rows).
    contentHash: text("content_hash"),
    uploadedBy: uuid("uploaded_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("library_documents_content_hash_key").on(t.contentHash),
    unique("library_documents_doi_key").on(t.doi),
    index("library_documents_status_idx").on(t.status),
  ],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    documentId: uuid("document_id")
      .notNull()
      .references(() => libraryDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    pageNumber: integer("page_number"),
    charStart: integer("char_start"),
    charEnd: integer("char_end"),
    sectionTitle: text("section_title"),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    embedding: vector("embedding"),
  },
  (t) => [index("document_chunks_document_idx").on(t.documentId)],
);

export const libraryThreads = pgTable(
  "library_threads",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("library_threads_user_idx").on(t.userId)],
);

export const libraryMessages = pgTable(
  "library_messages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => libraryThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("library_messages_thread_idx").on(t.threadId)],
);

export const insightRules = pgTable(
  "insight_rules",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    metric: text("metric").notNull(),
    comparator: text("comparator").notNull(),
    threshold: numeric("threshold"),
    scope: text("scope"),
    retrievalQuery: text("retrieval_query"),
    pinnedChunkId: uuid("pinned_chunk_id").references(() => documentChunks.id, {
      onDelete: "set null",
    }),
    noteTemplate: text("note_template").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("insight_rules_key_key").on(t.key),
    index("insight_rules_pinned_chunk_idx").on(t.pinnedChunkId),
  ],
);

void authUserId; // referenced for documentation of the auth.users linkage
