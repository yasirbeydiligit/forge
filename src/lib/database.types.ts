export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_dismissals: {
        Row: {
          alert_key: string
          athlete_id: string
          dismissed_at: string
          dismissed_by: string | null
          fingerprint: string
          id: string
        }
        Insert: {
          alert_key: string
          athlete_id: string
          dismissed_at?: string
          dismissed_by?: string | null
          fingerprint: string
          id?: string
        }
        Update: {
          alert_key?: string
          athlete_id?: string
          dismissed_at?: string
          dismissed_by?: string | null
          fingerprint?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_dismissals_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_dismissals_dismissed_by_profiles_id_fk"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_assignments: {
        Row: {
          athlete_id: string | null
          created_at: string
          created_by: string | null
          id: string
          program_id: string
          scheduled_date: string
          workout_id: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          program_id: string
          scheduled_date: string
          workout_id: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          program_id?: string
          scheduled_date?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_assignments_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_assignments_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_assignments_program_id_programs_id_fk"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_assignments_workout_id_workouts_id_fk"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      cardio_sessions: {
        Row: {
          activity: Database["public"]["Enums"]["cardio_activity"]
          athlete_id: string
          calories: number | null
          created_at: string
          distance_km: number | null
          duration_min: number
          id: string
          note: string | null
          session_date: string
          source: string
        }
        Insert: {
          activity: Database["public"]["Enums"]["cardio_activity"]
          athlete_id: string
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          duration_min: number
          id?: string
          note?: string | null
          session_date: string
          source?: string
        }
        Update: {
          activity?: Database["public"]["Enums"]["cardio_activity"]
          athlete_id?: string
          calories?: number | null
          created_at?: string
          distance_km?: number | null
          duration_min?: number
          id?: string
          note?: string | null
          session_date?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "cardio_sessions_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          adherence: number | null
          athlete_id: string
          created_at: string
          digestion: number | null
          energy: number | null
          hunger: number | null
          id: string
          metric_date: string
          notes: string | null
          resting_hr: number | null
          sleep_hours: number | null
          steps: number | null
          water_ml: number | null
          weight: number | null
        }
        Insert: {
          adherence?: number | null
          athlete_id: string
          created_at?: string
          digestion?: number | null
          energy?: number | null
          hunger?: number | null
          id?: string
          metric_date: string
          notes?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          steps?: number | null
          water_ml?: number | null
          weight?: number | null
        }
        Update: {
          adherence?: number | null
          athlete_id?: string
          created_at?: string
          digestion?: number | null
          energy?: number | null
          hunger?: number | null
          id?: string
          metric_date?: string
          notes?: string | null
          resting_hr?: number | null
          sleep_hours?: number | null
          steps?: number | null
          water_ml?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_chunks: {
        Row: {
          char_end: number | null
          char_start: number | null
          chunk_index: number
          content: string
          document_id: string
          embedding: string | null
          id: string
          page_number: number | null
          section_title: string | null
          token_count: number | null
        }
        Insert: {
          char_end?: number | null
          char_start?: number | null
          chunk_index: number
          content: string
          document_id: string
          embedding?: string | null
          id?: string
          page_number?: number | null
          section_title?: string | null
          token_count?: number | null
        }
        Update: {
          char_end?: number | null
          char_start?: number | null
          chunk_index?: number
          content?: string
          document_id?: string
          embedding?: string | null
          id?: string
          page_number?: number | null
          section_title?: string | null
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_library_documents_id_fk"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "library_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          athlete_id: string
          enrolled_at: string
          id: string
          program_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
        }
        Insert: {
          athlete_id: string
          enrolled_at?: string
          id?: string
          program_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Update: {
          athlete_id?: string
          enrolled_at?: string
          id?: string
          program_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_programs_id_fk"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_alternatives: {
        Row: {
          alternative_id: string
          created_at: string
          created_by: string | null
          exercise_id: string
          id: string
          note: string | null
        }
        Insert: {
          alternative_id: string
          created_at?: string
          created_by?: string | null
          exercise_id: string
          id?: string
          note?: string | null
        }
        Update: {
          alternative_id?: string
          created_at?: string
          created_by?: string | null
          exercise_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_alternatives_alternative_id_exercises_id_fk"
            columns: ["alternative_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_alternatives_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_alternatives_exercise_id_exercises_id_fk"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_muscle_targets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          muscle_function_id: string
          role: Database["public"]["Enums"]["exercise_muscle_role"]
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          muscle_function_id: string
          role: Database["public"]["Enums"]["exercise_muscle_role"]
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          muscle_function_id?: string
          role?: Database["public"]["Enums"]["exercise_muscle_role"]
        }
        Relationships: [
          {
            foreignKeyName: "exercise_muscle_targets_exercise_id_exercises_id_fk"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_muscle_targets_muscle_function_id_muscle_functions_id_"
            columns: ["muscle_function_id"]
            isOneToOne: false
            referencedRelation: "muscle_functions"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment_type: Database["public"]["Enums"]["equipment_type"] | null
          id: string
          is_system: boolean
          movement_pattern:
            | Database["public"]["Enums"]["movement_pattern"]
            | null
          name: string
          region: string | null
          slug: string | null
          video_url: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_type?: Database["public"]["Enums"]["equipment_type"] | null
          id?: string
          is_system?: boolean
          movement_pattern?:
            | Database["public"]["Enums"]["movement_pattern"]
            | null
          name: string
          region?: string | null
          slug?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_type?: Database["public"]["Enums"]["equipment_type"] | null
          id?: string
          is_system?: boolean
          movement_pattern?:
            | Database["public"]["Enums"]["movement_pattern"]
            | null
          name?: string
          region?: string | null
          slug?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_comments_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_comments_post_id_feed_posts_id_fk"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_likes_post_id_feed_posts_id_fk"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "feed_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_likes_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feed_posts: {
        Row: {
          answered: boolean
          answered_at: string | null
          answered_by: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          image_url: string | null
          is_question: boolean
        }
        Insert: {
          answered?: boolean
          answered_at?: string | null
          answered_by?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_question?: boolean
        }
        Update: {
          answered?: boolean
          answered_at?: string | null
          answered_by?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_question?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_answered_by_profiles_id_fk"
            columns: ["answered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_author_id_profiles_id_fk"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_rules: {
        Row: {
          comparator: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          key: string
          metric: string
          note_template: string
          pinned_chunk_id: string | null
          retrieval_query: string | null
          scope: string | null
          threshold: number | null
        }
        Insert: {
          comparator: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          key: string
          metric: string
          note_template: string
          pinned_chunk_id?: string | null
          retrieval_query?: string | null
          scope?: string | null
          threshold?: number | null
        }
        Update: {
          comparator?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          key?: string
          metric?: string
          note_template?: string
          pinned_chunk_id?: string | null
          retrieval_query?: string | null
          scope?: string | null
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "insight_rules_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insight_rules_pinned_chunk_id_document_chunks_id_fk"
            columns: ["pinned_chunk_id"]
            isOneToOne: false
            referencedRelation: "document_chunks"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number
          note: string | null
          token: string
          used_at: string | null
          used_by: string | null
          uses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          note?: string | null
          token: string
          used_at?: string | null
          used_by?: string | null
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          note?: string | null
          token?: string
          used_at?: string | null
          used_by?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invites_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_used_by_profiles_id_fk"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_documents: {
        Row: {
          authors: string | null
          content_hash: string | null
          created_at: string
          doi: string | null
          error: string | null
          id: string
          license: string | null
          page_count: number | null
          source_type: Database["public"]["Enums"]["library_source_type"]
          source_url: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_path: string | null
          title: string
          uploaded_by: string | null
          year: number | null
        }
        Insert: {
          authors?: string | null
          content_hash?: string | null
          created_at?: string
          doi?: string | null
          error?: string | null
          id?: string
          license?: string | null
          page_count?: number | null
          source_type: Database["public"]["Enums"]["library_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          title: string
          uploaded_by?: string | null
          year?: number | null
        }
        Update: {
          authors?: string | null
          content_hash?: string | null
          created_at?: string
          doi?: string | null
          error?: string | null
          id?: string
          license?: string | null
          page_count?: number | null
          source_type?: Database["public"]["Enums"]["library_source_type"]
          source_url?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_path?: string | null
          title?: string
          uploaded_by?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "library_documents_uploaded_by_profiles_id_fk"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      library_messages: {
        Row: {
          citations: Json | null
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
        }
        Insert: {
          citations?: Json | null
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
        }
        Update: {
          citations?: Json | null
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_messages_thread_id_library_threads_id_fk"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "library_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      library_threads: {
        Row: {
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_threads_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      log_sessions: {
        Row: {
          assignment_id: string | null
          athlete_id: string
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          notes: string | null
          session_date: string
          workout_id: string | null
        }
        Insert: {
          assignment_id?: string | null
          athlete_id: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date: string
          workout_id?: string | null
        }
        Update: {
          assignment_id?: string | null
          athlete_id?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          session_date?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_sessions_assignment_id_calendar_assignments_id_fk"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "calendar_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sessions_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sessions_workout_id_workouts_id_fk"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      log_sets: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          performed_at: string | null
          reps: number | null
          rir: number | null
          session_id: string
          set_number: number
          weight: number | null
          workout_exercise_id: string | null
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          reps?: number | null
          rir?: number | null
          session_id: string
          set_number: number
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          performed_at?: string | null
          reps?: number | null
          rir?: number | null
          session_id?: string
          set_number?: number
          weight?: number | null
          workout_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_sets_exercise_id_exercises_id_fk"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sets_session_id_log_sessions_id_fk"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "log_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_sets_workout_exercise_id_workout_exercises_id_fk"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_templates: {
        Row: {
          athlete_id: string
          carbs: number | null
          created_at: string
          description: string | null
          fat: number | null
          id: string
          kcal: number | null
          name: string
          protein: number | null
        }
        Insert: {
          athlete_id: string
          carbs?: number | null
          created_at?: string
          description?: string | null
          fat?: number | null
          id?: string
          kcal?: number | null
          name: string
          protein?: number | null
        }
        Update: {
          athlete_id?: string
          carbs?: number | null
          created_at?: string
          description?: string | null
          fat?: number | null
          id?: string
          kcal?: number | null
          name?: string
          protein?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_templates_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          athlete_id: string
          carbs: number | null
          created_at: string
          description: string | null
          eaten_at: string | null
          fat: number | null
          id: string
          kcal: number | null
          meal_date: string
          name: string
          protein: number | null
        }
        Insert: {
          athlete_id: string
          carbs?: number | null
          created_at?: string
          description?: string | null
          eaten_at?: string | null
          fat?: number | null
          id?: string
          kcal?: number | null
          meal_date: string
          name: string
          protein?: number | null
        }
        Update: {
          athlete_id?: string
          carbs?: number | null
          created_at?: string
          description?: string | null
          eaten_at?: string | null
          fat?: number | null
          id?: string
          kcal?: number | null
          meal_date?: string
          name?: string
          protein?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meals_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscle_functions: {
        Row: {
          created_at: string
          id: string
          muscle_id: string
          name_technical: string | null
          name_tr: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          muscle_id: string
          name_technical?: string | null
          name_tr: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          muscle_id?: string
          name_technical?: string | null
          name_tr?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "muscle_functions_muscle_id_muscles_id_fk"
            columns: ["muscle_id"]
            isOneToOne: false
            referencedRelation: "muscles"
            referencedColumns: ["id"]
          },
        ]
      }
      muscles: {
        Row: {
          created_at: string
          id: string
          name_latin: string | null
          name_tr: string
          region: Database["public"]["Enums"]["muscle_region"]
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_latin?: string | null
          name_tr: string
          region: Database["public"]["Enums"]["muscle_region"]
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name_latin?: string | null
          name_tr?: string
          region?: Database["public"]["Enums"]["muscle_region"]
          slug?: string
        }
        Relationships: []
      }
      nutrition_targets: {
        Row: {
          athlete_id: string
          carbs: number | null
          fat: number | null
          id: string
          kcal: number | null
          protein: number | null
          updated_at: string
          water_ml: number | null
        }
        Insert: {
          athlete_id: string
          carbs?: number | null
          fat?: number | null
          id?: string
          kcal?: number | null
          protein?: number | null
          updated_at?: string
          water_ml?: number | null
        }
        Update: {
          athlete_id?: string
          carbs?: number | null
          fat?: number | null
          id?: string
          kcal?: number | null
          protein?: number | null
          updated_at?: string
          water_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_targets_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      physique_photos: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          note: string | null
          photo_date: string
          storage_path: string
          weight_kg: number | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          note?: string | null
          photo_date: string
          storage_path: string
          weight_kg?: number | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          note?: string | null
          photo_date?: string
          storage_path?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "physique_photos_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_details: {
        Row: {
          birth_date: string | null
          goal: Database["public"]["Enums"]["training_goal"] | null
          height_cm: number | null
          sex: Database["public"]["Enums"]["user_sex"] | null
          unit: Database["public"]["Enums"]["weight_unit"]
          updated_at: string
          user_id: string
          weekly_target_days: number | null
        }
        Insert: {
          birth_date?: string | null
          goal?: Database["public"]["Enums"]["training_goal"] | null
          height_cm?: number | null
          sex?: Database["public"]["Enums"]["user_sex"] | null
          unit?: Database["public"]["Enums"]["weight_unit"]
          updated_at?: string
          user_id: string
          weekly_target_days?: number | null
        }
        Update: {
          birth_date?: string | null
          goal?: Database["public"]["Enums"]["training_goal"] | null
          height_cm?: number | null
          sex?: Database["public"]["Enums"]["user_sex"] | null
          unit?: Database["public"]["Enums"]["weight_unit"]
          updated_at?: string
          user_id?: string
          weekly_target_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_details_user_id_profiles_id_fk"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          username?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          name: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_assignments: {
        Row: {
          assigned_by: string | null
          athlete_id: string
          created_at: string
          id: string
          protocol_id: string
        }
        Insert: {
          assigned_by?: string | null
          athlete_id: string
          created_at?: string
          id?: string
          protocol_id: string
        }
        Update: {
          assigned_by?: string | null
          athlete_id?: string
          created_at?: string
          id?: string
          protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_assignments_assigned_by_profiles_id_fk"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_assignments_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_assignments_protocol_id_protocol_templates_id_fk"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_completions: {
        Row: {
          athlete_id: string
          completed_at: string
          completion_date: string
          id: string
          protocol_id: string
        }
        Insert: {
          athlete_id: string
          completed_at?: string
          completion_date: string
          id?: string
          protocol_id: string
        }
        Update: {
          athlete_id?: string
          completed_at?: string
          completion_date?: string
          id?: string
          protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_completions_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocol_completions_protocol_id_protocol_templates_id_fk"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "protocol_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      protocol_templates: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          order_index: number
          timing: Database["public"]["Enums"]["protocol_timing"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          order_index?: number
          timing: Database["public"]["Enums"]["protocol_timing"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          order_index?: number
          timing?: Database["public"]["Enums"]["protocol_timing"]
        }
        Relationships: [
          {
            foreignKeyName: "protocol_templates_created_by_profiles_id_fk"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tracker_settings: {
        Row: {
          athlete_id: string
          enabled: Json
          goals: Json
          updated_at: string
        }
        Insert: {
          athlete_id: string
          enabled: Json
          goals?: Json
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          enabled?: Json
          goals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracker_settings_athlete_id_profiles_id_fk"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          notes: string | null
          order_index: number
          rest_seconds: number | null
          target_reps_max: number | null
          target_reps_min: number | null
          target_rir: number | null
          target_sets: number | null
          target_weight: number | null
          workout_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          notes?: string | null
          order_index?: number
          rest_seconds?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rir?: number | null
          target_sets?: number | null
          target_weight?: number | null
          workout_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          notes?: string | null
          order_index?: number
          rest_seconds?: number | null
          target_reps_max?: number | null
          target_reps_min?: number | null
          target_rir?: number | null
          target_sets?: number | null
          target_weight?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_exercises_id_fk"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_workouts_id_fk"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          order_index: number
          program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          program_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_programs_id_fk"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_coach: { Args: never; Returns: boolean }
      is_enrolled: { Args: { p_program: string }; Returns: boolean }
      match_chunks: {
        Args: {
          match_count?: number
          query_embedding: string
          query_text: string
        }
        Returns: {
          char_end: number
          char_start: number
          chunk_id: string
          chunk_index: number
          content: string
          document_authors: string
          document_id: string
          document_source_url: string
          document_title: string
          document_year: number
          page_number: number
          score: number
          section_title: string
        }[]
      }
      suggest_exercise_alternatives: {
        Args: { p_exercise: string }
        Returns: {
          equipment_type: Database["public"]["Enums"]["equipment_type"]
          exercise_id: string
          movement_pattern: Database["public"]["Enums"]["movement_pattern"]
          name: string
          shared_primary: number
          shared_secondary: number
        }[]
      }
    }
    Enums: {
      cardio_activity: "walk" | "run" | "swim" | "bike" | "elliptical" | "other"
      document_status: "pending" | "processing" | "ready" | "failed"
      enrollment_status: "active" | "paused" | "completed"
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "kettlebell"
        | "band"
        | "smith"
        | "ez_bar"
        | "trap_bar"
        | "other"
      exercise_muscle_role: "primary" | "secondary"
      library_source_type: "paper" | "book" | "handout"
      movement_pattern:
        | "push_horizontal"
        | "push_vertical"
        | "pull_horizontal"
        | "pull_vertical"
        | "squat"
        | "hinge"
        | "lunge"
        | "isolation"
        | "carry"
        | "core"
        | "rotation"
      muscle_region: "upper" | "lower" | "core"
      protocol_timing:
        | "morning"
        | "pre_workout"
        | "intra_workout"
        | "post_workout"
        | "night"
      training_goal: "muscle_gain" | "strength" | "fat_loss" | "maintenance"
      user_role: "coach" | "athlete"
      user_sex: "male" | "female"
      weight_unit: "kg" | "lb"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      cardio_activity: ["walk", "run", "swim", "bike", "elliptical", "other"],
      document_status: ["pending", "processing", "ready", "failed"],
      enrollment_status: ["active", "paused", "completed"],
      equipment_type: [
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
      ],
      exercise_muscle_role: ["primary", "secondary"],
      library_source_type: ["paper", "book", "handout"],
      movement_pattern: [
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
      ],
      muscle_region: ["upper", "lower", "core"],
      protocol_timing: [
        "morning",
        "pre_workout",
        "intra_workout",
        "post_workout",
        "night",
      ],
      training_goal: ["muscle_gain", "strength", "fat_loss", "maintenance"],
      user_role: ["coach", "athlete"],
      user_sex: ["male", "female"],
      weight_unit: ["kg", "lb"],
    },
  },
} as const
