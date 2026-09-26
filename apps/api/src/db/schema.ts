import {
  pgTable,
  pgEnum,
  text,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const planType = pgEnum("plan_type", ["free", "pro"]);
export const snapshotCreator = pgEnum("snapshot_creator", ["ai", "user", "system"]);
export const messageRole = pgEnum("message_role", ["user", "assistant", "tool"]);

// --- users -----------------------------------------------------------
// id is the Clerk user id (e.g. "user_2abc..."), kept as-is rather than
// re-generated, so every other table can reference it directly.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  plan: planType("plan").notNull().default("free"),
  creditsBalance: integer("credits_balance").notNull().default(20),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// --- projects ----------------------------------------------------------
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    template: text("template").notNull().default("vite-react"),
    // forward reference: snapshots is declared further down this file
    headSnapshotId: uuid("head_snapshot_id").references(
      (): AnyPgColumn => snapshots.id
    ),
    deployedUrl: text("deployed_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("projects_owner_id_idx").on(table.ownerId),
  })
);

// --- blobs ---------------------------------------------------------------
// content-addressed storage: hash is the sha256 of the file's bytes.
// small files are stored inline; large files live in R2 under blobs/<hash>.
export const blobs = pgTable("blobs", {
  hash: text("hash").primaryKey(),
  content: text("content"), // inline content, for files under ~100KB
  objectKey: text("object_key"), // R2 key, for larger files
  size: integer("size").notNull(),
});

// --- snapshots -----------------------------------------------------------
export const snapshots = pgTable(
  "snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    // self-reference: snapshot history forms a chain
    parentId: uuid("parent_id").references((): AnyPgColumn => snapshots.id),
    // path -> blob hash
    manifest: jsonb("manifest").$type<Record<string, string>>().notNull(),
    createdBy: snapshotCreator("created_by").notNull(),
    // forward reference: messages is declared further down this file
    messageId: uuid("message_id").references((): AnyPgColumn => messages.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("snapshots_project_id_idx").on(table.projectId),
  })
);

// --- messages --------------------------------------------------------------
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: jsonb("content").notNull(),
    snapshotId: uuid("snapshot_id").references(() => snapshots.id),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("messages_project_id_idx").on(table.projectId),
  })
);

// --- usage_ledger -----------------------------------------------------------
// append-only; credits_balance on `users` is a running total maintained
// alongside these rows.
export const usageLedger = pgTable(
  "usage_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    deltaCredits: integer("delta_credits").notNull(), // negative for debits
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("usage_ledger_user_id_idx").on(table.userId),
  })
);