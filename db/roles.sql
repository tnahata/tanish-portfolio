-- Least-privilege roles for the ask agent database.
--
-- Three roles, three connection strings:
--   owner       (Neon's existing role, DATABASE_ADMIN_URL) -- DDL. Runs this file and, separately,
--               db/schema.sql. Never used by the running app or by `npm run ingest`.
--   ask_ingest  (DATABASE_INGEST_URL) -- full CRUD on the corpus tables (corpus_meta, documents,
--               chunks) only. Used by `npm run ingest`.
--   ask_app     (DATABASE_URL) -- SELECT on the corpus tables, INSERT only (no UPDATE, no DELETE)
--               on documents and chunks, full CRUD on the identity and traffic tables. Used by
--               the running application.
--
-- Why ask_app cannot UPDATE or DELETE a corpus row: the corpus defines what the agent is allowed
-- to know. If a path from prompt injection to a database write ever existed, its blast radius has
-- to stop at "insert an asked-sourced row"; it must never reach "rewrite or delete what the agent
-- already knows", because that would be corpus poisoning, not just a bad write. ask_app still
-- needs INSERT on documents and chunks because publishing a gap answer happens at runtime and
-- writes a row with source = 'asked', embedded inline with no deploy (see
-- docs/ask-agent/09-gap-queue.md). INSERT-only keeps that path open while keeping every
-- file-sourced row ingest maintains immutable to the runtime.
--
-- Why ask_ingest has no access at all to the identity and traffic tables: ingest reconciles
-- corpus content read from disk against the corpus tables (see docs/ask-agent/02-ingest.md). It
-- has no legitimate reason to read or write a users row, a session, or a turn, so it is not given
-- the surface that would make it a target if it were ever compromised.
--
-- ---------------------------------------------------------------------------
-- Apply order: this file runs BEFORE db/schema.sql creates any table
-- ---------------------------------------------------------------------------
--
-- `npm run db:roles` (this file) is meant to run first, against a database that may not have a
-- single table in it yet, and `npm run db:setup` (db/schema.sql) runs after. That ordering is why
-- this file leans on `alter default privileges` for a broad baseline (see "Default privileges"
-- below) rather than only explicit per-table grants: there is nothing yet to name in `grant ...
-- on <table>` on a first run. A per-table loop further down applies the exact, asymmetric grant
-- matrix above on top of that baseline, but only for tables that already exist at the moment this
-- file runs, using `to_regclass` to check each one first and skipping any that do not exist yet
-- rather than erroring on a missing relation.
--
-- Both apply orders work, and re-running either command is always safe:
--   roles, then schema: this file's default-privilege baseline is what makes ask_ingest and
--     ask_app already able to touch the corpus tables the instant db/schema.sql creates them.
--     Nothing in the per-table loop below runs on that first pass (every table is still missing),
--     so the running app or ingest already has *a* working grant, just not yet the exact one
--     (ask_app in particular over-grants INSERT on corpus_meta until the second pass below).
--     Run `npm run db:roles` again afterward, now that the tables exist, to apply the exact
--     per-table matrix and close that gap.
--   schema, then roles: every table already exists the one time this file runs, so the per-table
--     loop applies the exact matrix directly; there is no second pass to remember.
-- `scripts/db-roles.ts` detects which case it is in (by checking whether the corpus tables exist)
-- and prints which one happened, including a reminder to re-run itself when it was the first case.
--
-- Convergent, not merely idempotent: re-running this file produces the grant state written below,
-- discarding whatever either role held before on an *existing* table, rather than layering new
-- grants on top of old ones. This is also what makes it safe to run against a database where
-- ask_ingest / ask_app already exist with grants already applied by hand (for example, created
-- directly in the Neon SQL editor before this file existed): whatever they held on an existing
-- table is revoked and rebuilt from this file alone. A table created after this file's default
-- privileges were set is covered by that baseline until the next run reaches it, per the ordering
-- note above.
--
-- Do not apply this file with plain `psql -f`. It reads the two role passwords from session-scoped
-- GUCs (`ask.ingest_password`, `ask.app_password`) that only scripts/db-roles.ts sets, via a
-- parameterized `select set_config($1, $2, false)` call issued before this file runs. That
-- indirection exists because `create role` / `alter role ... password` takes the password as a
-- literal grammar token (an `Sconst`), not as an expression, so unlike a `select ... where col =
-- $1`, there is no `$1` placeholder position to bind it into safely: the driver cannot parameterize
-- it the normal way. Routing the value through `set_config` first keeps it out of the SQL text
-- this file's caller ever builds (it travels as an ordinary function argument, which *is* a normal
-- bindable parameter position for `select set_config(...)`), and keeps it out of this file
-- entirely, which is what makes it safe to commit. The `do` block below then reads it back with
-- `current_setting` and uses `format(..., %L)` to quote it before `execute` splices it into a
-- dynamic `alter role` statement, rather than ever concatenating the raw value into SQL text.
--
-- Verified against Neon's documentation (neon.com/docs/manage/roles,
-- neon.com/docs/manage/database-access), 2026-07-28: roles created by plain SQL (as this file
-- does) receive only basic public-schema privileges and no `neon_superuser` membership, unlike
-- roles created through the Neon console/API/CLI, which are auto-granted `neon_superuser`. That is
-- exactly the least-privilege starting point this file wants: nothing beyond what is granted
-- below. Neon also confirms `neon_superuser` cannot itself be used to log in and cannot be altered,
-- which is consistent with this file never touching it. `neon_superuser` (held by the owner role
-- this file runs as) already carries `grant all` on public-schema tables and sequences, so the
-- owner role needs no extra setup here to be able to run the grants below.

-- ---------------------------------------------------------------------------
-- Role creation (idempotent)
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ask_ingest') then
    create role ask_ingest with login nosuperuser nocreatedb nocreaterole noreplication;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'ask_app') then
    create role ask_app with login nosuperuser nocreatedb nocreaterole noreplication;
  end if;
end
$$;

-- Passwords are (re)set on every run, from the session GUCs scripts/db-roles.ts populates just
-- before running this file. Re-running this file therefore rotates both passwords to whatever
-- that run generated or read from ASK_INGEST_PASSWORD / ASK_APP_PASSWORD; that is intentional,
-- and is how a password rotation ships.
do $$
declare
  ingest_password text := current_setting('ask.ingest_password', true);
  app_password    text := current_setting('ask.app_password', true);
begin
  if ingest_password is null or ingest_password = '' then
    raise exception 'ask.ingest_password is not set for this session. Do not run db/roles.sql directly; apply it via npm run db:roles (scripts/db-roles.ts), which sets this before running this file.';
  end if;

  if app_password is null or app_password = '' then
    raise exception 'ask.app_password is not set for this session. Do not run db/roles.sql directly; apply it via npm run db:roles (scripts/db-roles.ts), which sets this before running this file.';
  end if;

  execute format('alter role ask_ingest with password %L', ingest_password);
  execute format('alter role ask_app with password %L', app_password);
end
$$;

-- ---------------------------------------------------------------------------
-- Database and schema access
-- ---------------------------------------------------------------------------

-- The database name is not knowable statically here: it differs between a Neon project's default
-- branch database and any other branch a developer or CI points DATABASE_ADMIN_URL at. This is
-- the one identifier in this file that has to be built dynamically rather than written as a
-- literal, so it goes through format(..., %I) rather than being spliced in by hand.
do $$
begin
  execute format('grant connect on database %I to ask_ingest, ask_app', current_database());
end
$$;

grant usage on schema public to ask_ingest, ask_app;

-- Neither role ever creates an object; only the owner role runs DDL (this file, db/schema.sql).
-- Explicit, rather than relying on the Postgres-version-dependent default (PUBLIC gets CREATE on
-- `public` in PG14 and earlier, USAGE only from PG15 on): this revoke is what actually enforces
-- "no object creation", not an assumption about which Postgres version Neon runs.
revoke create on schema public from ask_ingest, ask_app;

-- No grant is needed for gen_random_uuid() or the vector type. PostgreSQL grants EXECUTE on
-- every function/procedure and USAGE on every language and data type (including domains) to
-- PUBLIC by default, unless an owner explicitly revokes it (postgresql.org/docs/current/ddl-priv.html,
-- "Default Privileges"). gen_random_uuid() has been a pg_catalog builtin since Postgres 13, and the
-- vector type that `create extension vector` installs (db/schema.sql) is no exception to that
-- default. Neither db/schema.sql nor this file revokes anything from PUBLIC, so ask_ingest and
-- ask_app already have what they need to call gen_random_uuid() and store a vector(1024) value.

-- ---------------------------------------------------------------------------
-- Default privileges: the baseline that makes a table usable the instant it is created
-- ---------------------------------------------------------------------------
--
-- `alter default privileges` is scoped to a schema and a creating role, not to a named list of
-- tables, so it cannot express the one asymmetry this design needs: ask_app gets SELECT
-- everywhere, but INSERT (never UPDATE, never DELETE) only on documents and chunks, and no
-- INSERT at all on corpus_meta. What it *can* do is guarantee that db/schema.sql's `create table`
-- statements come up already grantable to both roles, with no gap between "table exists" and
-- "table has grants", which matters specifically because this file is designed to run before
-- those tables exist.
--
-- The baseline below is deliberately the widest each role legitimately needs anywhere in this
-- schema: full CRUD as ask_ingest's default (matching its actual corpus_meta/documents/chunks
-- grant below exactly, so on a roles-then-schema run there is nothing left to tighten there), and
-- SELECT+INSERT as ask_app's default (the safe, no-update-no-delete shape; ask_app's identity and
-- traffic tables need more than this default gives, and gain it only from the explicit per-table
-- loop below, once those tables exist).
--
-- This is a real, accepted gap, not an oversight: until the per-table loop below runs against an
-- existing table, ask_app's default grants it INSERT on corpus_meta too (which should be
-- SELECT-only) and only SELECT+INSERT on the identity/traffic tables (which should be full CRUD).
-- ask_ingest's default is a smaller risk in the same direction: it would also apply in full to any
-- future table this schema grows that is not corpus-shaped, until db/roles.sql's per-table list is
-- extended to include it and re-run. Both gaps close the moment `npm run db:setup` has created the
-- tables and `npm run db:roles` runs again; see "Apply order" above for exactly when that second
-- run is required, and scripts/db-roles.ts, which detects and states in its own output which case
-- a given run is in.
alter default privileges in schema public
  grant select, insert, update, delete on tables to ask_ingest;

alter default privileges in schema public
  grant select, insert on tables to ask_app;

-- ---------------------------------------------------------------------------
-- Per-table convergence: the exact grant matrix, for whatever tables exist right now
-- ---------------------------------------------------------------------------
--
-- Runs once per known table name, skipping any that do not exist yet (`to_regclass` returns null
-- for those; `continue when` moves on without erroring on a missing relation, which a bare `grant
-- ... on <table>` would not do). For every table that does exist, this first revokes everything
-- either role holds on it (closing over both this file's own default-privilege baseline above and
-- anything granted by an earlier run or by hand) and then grants exactly the matrix documented at
-- the top of this file. `format(..., %I)` quotes each table name before it is spliced into
-- dynamic SQL; the names themselves are the fixed literal array below, not external input, but
-- the same quoting discipline applies regardless of where an identifier used in `execute` comes
-- from.
do $$
declare
  known_table text;
  known_tables constant text[] := array[
    'corpus_meta', 'documents', 'chunks',
    'users', 'sessions', 'turns', 'gap_questions', 'login_nonces', 'rate_counters',
    'spend_reservations'
  ];
begin
  foreach known_table in array known_tables loop
    continue when to_regclass(format('public.%I', known_table)) is null;

    execute format('revoke all privileges on %I from ask_ingest, ask_app', known_table);

    if known_table in ('corpus_meta', 'documents', 'chunks') then
      execute format('grant select, insert, update, delete on %I to ask_ingest', known_table);
      if known_table = 'corpus_meta' then
        execute format('grant select on %I to ask_app', known_table);
      else
        execute format('grant select, insert on %I to ask_app', known_table);
      end if;
    else
      execute format('grant select, insert, update, delete on %I to ask_app', known_table);
    end if;
  end loop;
end
$$;
