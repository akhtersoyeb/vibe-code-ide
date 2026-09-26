CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'tool');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('free', 'pro');--> statement-breakpoint
CREATE TYPE "public"."snapshot_creator" AS ENUM('ai', 'user', 'system');--> statement-breakpoint
CREATE TABLE "blobs" (
	"hash" text PRIMARY KEY NOT NULL,
	"content" text,
	"object_key" text,
	"size" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" jsonb NOT NULL,
	"snapshot_id" uuid,
	"input_tokens" integer,
	"output_tokens" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"template" text DEFAULT 'vite-react' NOT NULL,
	"head_snapshot_id" uuid,
	"deployed_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"parent_id" uuid,
	"manifest" jsonb NOT NULL,
	"created_by" "snapshot_creator" NOT NULL,
	"message_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"delta_credits" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"plan" "plan_type" DEFAULT 'free' NOT NULL,
	"credits_balance" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_head_snapshot_id_snapshots_id_fk" FOREIGN KEY ("head_snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_parent_id_snapshots_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_ledger" ADD CONSTRAINT "usage_ledger_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_project_id_idx" ON "messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_owner_id_idx" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "snapshots_project_id_idx" ON "snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "usage_ledger_user_id_idx" ON "usage_ledger" USING btree ("user_id");