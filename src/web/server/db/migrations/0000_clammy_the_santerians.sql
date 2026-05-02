CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "display_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reachable" boolean NOT NULL,
	"status" jsonb
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"submitter_name" text,
	"framebuffer" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"base_weight" integer DEFAULT 1 NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_shown_at" timestamp with time zone,
	"show_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "framebuffer_size" CHECK (octet_length("entries"."framebuffer") = 163200)
);
--> statement-breakpoint
CREATE TABLE "entry_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"guest_mode" boolean DEFAULT false NOT NULL,
	"submitter_name" text,
	"allowed_elements" jsonb DEFAULT '["image_upload"]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"base_weight" integer DEFAULT 1 NOT NULL,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generator_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plugin_name" text NOT NULL,
	"renderer" text NOT NULL,
	"instance_name" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cron_expr" text NOT NULL,
	"entry_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generator_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" uuid NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded" boolean NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "push_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded" boolean NOT NULL,
	"firmware_status" text,
	"panel_uptime_after" integer,
	"error" text,
	"trigger" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_state" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"currently_displayed_entry_id" uuid,
	"lock_entry_id" uuid,
	"flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_online" boolean DEFAULT false NOT NULL,
	"display_online_since" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "generator_instances" ADD CONSTRAINT "generator_instances_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generator_runs" ADD CONSTRAINT "generator_runs_instance_id_generator_instances_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."generator_instances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_log" ADD CONSTRAINT "push_log_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;