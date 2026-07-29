-- Least-privilege roles for the ask agent database.
--
-- Three roles: owner (DATABASE_ADMIN_URL, DDL only, via this file and db/schema.sql), ask_ingest
-- (DATABASE_INGEST_URL, full CRUD on corpus_meta/documents/chunks), ask_app (DATABASE_URL,
-- SELECT on corpus tables, INSERT-only -- never UPDATE/DELETE -- on documents/chunks, full CRUD
-- on the identity/traffic tables).
--
-- ask_app never gets UPDATE/DELETE on the corpus: if a prompt injection ever reached a database
-- write, its blast radius must stop at inserting a gap answer (source = 'asked'), never rewriting
-- or deleting what the agent already knows. Apply-order tradeoffs, the convergent-not-idempotent
-- behaviour, and the Neon privilege baseline this relies on: docs/ask-agent/12-delivery.md.
--
-- Do not apply this file with plain `psql -f`. It reads both role passwords from session-scoped
-- GUCs (`ask.ingest_password`, `ask.app_password`) that only scripts/db-roles.ts sets, because
-- `alter role ... password` takes its value as a literal grammar token, not a bindable parameter.
-- Full mechanism: docs/ask-agent/12-delivery.md.

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

-- Rotated on every run, from the GUCs scripts/db-roles.ts sets beforehand -- how a password
-- rotation ships.
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

-- current_database() is not knowable statically: it differs per Neon branch.
do $$
begin
  execute format('grant connect on database %I to ask_ingest, ask_app', current_database());
end
$$;

grant usage on schema public to ask_ingest, ask_app;

-- Neither role ever creates an object; explicit, rather than relying on the Postgres-version
-- default (PUBLIC gets CREATE on public in PG14 and earlier, USAGE only from PG15 on).
revoke create on schema public from ask_ingest, ask_app;

-- No grant needed for gen_random_uuid() or the vector type: PUBLIC already has EXECUTE/USAGE on
-- every function and type by Postgres's own default, and nothing here revokes it.

-- ---------------------------------------------------------------------------
-- Default privileges: the baseline that makes a table usable the instant it is created
-- ---------------------------------------------------------------------------
--
-- Scoped to a schema and creating role, not a table list, so it can't express the asymmetry the
-- header needs; the per-table loop below applies the exact matrix once tables exist.

alter default privileges in schema public
  grant select, insert, update, delete on tables to ask_ingest;

alter default privileges in schema public
  grant select, insert on tables to ask_app;

-- ---------------------------------------------------------------------------
-- Per-table convergence: the exact grant matrix, for whatever tables exist right now
-- ---------------------------------------------------------------------------
--
-- Skips a table that does not exist yet (`continue when to_regclass(...) is null`). For each
-- that exists: revokes everything either role holds, then grants exactly the header's matrix.
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
