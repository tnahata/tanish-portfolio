import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * db/roles.sql cannot be executed without a real Postgres, and the brief for this work
 * explicitly rules out running any DDL against a database, ephemeral or otherwise, as part of
 * verification. These are text-level sanity checks instead: they read the file as a string and
 * assert specific statements are present or absent, and that its list of known tables has not
 * drifted from db/schema.sql's actual tables.
 *
 * Be clear about what this does and does not prove. It proves the file's literal shape matches
 * the intended design today, and will fail loudly if a future edit changes that shape (for
 * example, an edit that accidentally adds UPDATE to ask_app's default-privilege baseline). It
 * does not prove the SQL is syntactically valid or behaves as written when Postgres actually
 * parses and runs it; that was instead checked by hand, construct by construct (the `do` blocks,
 * `foreach ... in array`, `continue when`, `format()` with %I/%L), against the PostgreSQL manual.
 * See this task's final report for exactly what was verified and cited.
 */

const rolesSql = fs.readFileSync(path.join(process.cwd(), 'db/roles.sql'), 'utf-8');
const schemaSql = fs.readFileSync(path.join(process.cwd(), 'db/schema.sql'), 'utf-8');

function defaultPrivilegeGrant(role: 'ask_ingest' | 'ask_app'): string {
  const match = rolesSql.match(
    new RegExp(`alter default privileges in schema public\\s+grant ([^;]+) on tables to ${role};`)
  );
  expect(match, `expected an "alter default privileges ... to ${role}" statement`).not.toBeNull();
  return match![1].toLowerCase();
}

describe('db/roles.sql: structural sanity (text-level, not executed against Postgres)', () => {
  it("ask_app's default-privilege baseline never includes UPDATE or DELETE", () => {
    const granted = defaultPrivilegeGrant('ask_app');
    expect(granted).not.toMatch(/update/);
    expect(granted).not.toMatch(/delete/);
    expect(granted).toMatch(/select/);
    expect(granted).toMatch(/insert/);
  });

  it("ask_ingest's default-privilege baseline is full CRUD", () => {
    const granted = defaultPrivilegeGrant('ask_ingest');
    for (const privilege of ['select', 'insert', 'update', 'delete']) {
      expect(granted).toMatch(new RegExp(privilege));
    }
  });

  it('never uses ALTER DEFAULT PRIVILEGES FOR ROLE with a hardcoded role name', () => {
    // Omitting FOR ROLE defaults to the role that runs the file (the owner, since this always
    // runs over DATABASE_ADMIN_URL), per the PostgreSQL manual. A hardcoded FOR ROLE would
    // silently stop matching if a different Neon project's owner role had a different name.
    expect(rolesSql).not.toMatch(/alter default privileges\s+for role/i);
  });

  it('revokes CREATE on the public schema from both roles', () => {
    expect(rolesSql).toMatch(/revoke create on schema public from ask_ingest, ask_app;/);
  });

  it('revokes everything on a table before re-granting it, inside the per-table convergence loop', () => {
    expect(rolesSql).toMatch(/revoke all privileges on %I from ask_ingest, ask_app/);
  });

  it('skips a table that does not exist yet rather than erroring on it', () => {
    expect(rolesSql).toMatch(/continue when to_regclass\(format\('public\.%I', known_table\)\) is null;/);
  });

  it("gives ask_ingest full CRUD and ask_app SELECT-only on corpus_meta, SELECT+INSERT on documents/chunks, in the per-table matrix", () => {
    expect(rolesSql).toMatch(/grant select, insert, update, delete on %I to ask_ingest/);
    expect(rolesSql).toMatch(/grant select on %I to ask_app/);
    expect(rolesSql).toMatch(/grant select, insert on %I to ask_app/);
  });

  it('gives ask_app full CRUD on every non-corpus table in the per-table matrix', () => {
    expect(rolesSql).toMatch(/grant select, insert, update, delete on %I to ask_app/);
  });

  it("known_tables lists exactly the tables db/schema.sql creates, no more and no fewer", () => {
    const schemaTableNames = Array.from(
      schemaSql.matchAll(/create table if not exists (\w+)/g),
      (match) => match[1]
    );
    expect(schemaTableNames.length).toBe(10);

    const knownTablesMatch = rolesSql.match(/known_tables constant text\[\] := array\[([\s\S]*?)\];/);
    expect(knownTablesMatch, 'expected a known_tables array literal in db/roles.sql').not.toBeNull();
    const knownTableNames = Array.from(knownTablesMatch![1].matchAll(/'(\w+)'/g), (match) => match[1]);

    expect(new Set(knownTableNames)).toEqual(new Set(schemaTableNames));
    expect(knownTableNames.length).toBe(schemaTableNames.length);
  });

  it('never grants anything to PUBLIC (only ever to ask_ingest and/or ask_app by name)', () => {
    expect(rolesSql).not.toMatch(/to public\b/i);
  });
});
