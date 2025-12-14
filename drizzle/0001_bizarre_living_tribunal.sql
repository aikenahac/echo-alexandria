CREATE TABLE "reindex_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"authors_indexed" integer DEFAULT 0,
	"editions_indexed" integer DEFAULT 0,
	"total_authors" integer DEFAULT 0,
	"total_editions" integer DEFAULT 0,
	"current_phase" text,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "reindex_jobs_status_idx" ON "reindex_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reindex_jobs_started_at_idx" ON "reindex_jobs" USING btree ("started_at");