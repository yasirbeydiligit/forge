CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."library_source_type" AS ENUM('paper', 'book', 'handout');--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"page_number" integer,
	"char_start" integer,
	"char_end" integer,
	"section_title" text,
	"content" text NOT NULL,
	"token_count" integer,
	"embedding" vector(1024)
);
--> statement-breakpoint
CREATE TABLE "insight_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"metric" text NOT NULL,
	"comparator" text NOT NULL,
	"threshold" numeric,
	"scope" text,
	"retrieval_query" text,
	"pinned_chunk_id" uuid,
	"note_template" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "insight_rules_key_key" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "library_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"authors" text,
	"source_type" "library_source_type" NOT NULL,
	"source_url" text,
	"doi" text,
	"year" integer,
	"license" text,
	"storage_path" text,
	"page_count" integer,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"error" text,
	"content_hash" text,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_documents_content_hash_key" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "library_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_library_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."library_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_rules" ADD CONSTRAINT "insight_rules_pinned_chunk_id_document_chunks_id_fk" FOREIGN KEY ("pinned_chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_rules" ADD CONSTRAINT "insight_rules_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_documents" ADD CONSTRAINT "library_documents_uploaded_by_profiles_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_messages" ADD CONSTRAINT "library_messages_thread_id_library_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."library_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_threads" ADD CONSTRAINT "library_threads_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_chunks_document_idx" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "library_documents_status_idx" ON "library_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "library_messages_thread_idx" ON "library_messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "library_threads_user_idx" ON "library_threads" USING btree ("user_id");