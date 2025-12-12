CREATE TABLE "authors" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"personal_name" text,
	"birth_date" text,
	"death_date" text,
	"bio" text,
	"alternate_names" text[],
	"photos" integer[],
	"raw_data" jsonb,
	"last_imported" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editions" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"work_keys" text[],
	"author_keys" text[],
	"isbn_10" text[],
	"isbn_13" text[],
	"publishers" text[],
	"publish_date" text,
	"number_of_pages" integer,
	"covers" integer[],
	"languages" text[],
	"physical_format" text,
	"edition_name" text,
	"raw_data" jsonb,
	"last_imported" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"error" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "works" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"subjects" text[],
	"author_keys" text[],
	"first_publish_date" text,
	"covers" integer[],
	"raw_data" jsonb,
	"last_imported" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "authors_name_idx" ON "authors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "authors_name_gin_idx" ON "authors" USING gin (to_tsvector('english', "name"));--> statement-breakpoint
CREATE INDEX "editions_title_idx" ON "editions" USING btree ("title");--> statement-breakpoint
CREATE INDEX "editions_title_gin_idx" ON "editions" USING gin (to_tsvector('english', "title"));--> statement-breakpoint
CREATE INDEX "editions_isbn10_idx" ON "editions" USING gin ("isbn_10");--> statement-breakpoint
CREATE INDEX "editions_isbn13_idx" ON "editions" USING gin ("isbn_13");--> statement-breakpoint
CREATE INDEX "editions_work_keys_idx" ON "editions" USING gin ("work_keys");--> statement-breakpoint
CREATE INDEX "editions_author_keys_idx" ON "editions" USING gin ("author_keys");--> statement-breakpoint
CREATE INDEX "import_jobs_type_idx" ON "import_jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "import_jobs_status_idx" ON "import_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_jobs_started_at_idx" ON "import_jobs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "works_title_idx" ON "works" USING btree ("title");--> statement-breakpoint
CREATE INDEX "works_title_gin_idx" ON "works" USING gin (to_tsvector('english', "title"));--> statement-breakpoint
CREATE INDEX "works_author_keys_idx" ON "works" USING gin ("author_keys");