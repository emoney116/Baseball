import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { ensureTeamCreatorMembership } from '../app/lib/teamCreationMembership.ts';

test('team creation works with the real season-scoped membership indexes', async t => {
  const pg = new PGlite();
  const migration = readFileSync(new URL('../supabase/migrations/20260810000000_multi_team_memberships.sql', import.meta.url), 'utf8');
  await pg.exec(`create table profile_team_memberships (
    id uuid primary key default gen_random_uuid(), profile_id text not null,
    team_id text not null, season_id text, role text, title text, active boolean
  );`);
  for (const name of ['profile_team_memberships_profile_team_season_key', 'profile_team_memberships_profile_team_no_season_key']) {
    const index = migration.match(new RegExp(`create unique index if not exists ${name}[^;]+;`, 'i'));
    assert.ok(index, `Missing canonical index ${name}`);
    await pg.exec(index[0]);
  }
  const requests = [];
  let failCode = null;
  const db = createClient('https://fixture.invalid', 'fixture-key', {
    auth: { persistSession: false }, global: { fetch: async (url, init) => {
      const parsed = new URL(url);
      requests.push({ method: init.method, url: parsed });
      assert.equal(parsed.pathname, '/rest/v1/profile_team_memberships');
      assert.equal(parsed.searchParams.has('on_conflict'), false);
      if (failCode) return Response.json({ code: failCode, message: 'Injected database failure' }, { status: 400 });
      const body = JSON.parse(init.body);
      try {
        if (init.method === 'POST') {
          await pg.query(`insert into profile_team_memberships(profile_id,team_id,season_id,role,title,active) values($1,$2,$3,$4,$5,$6)`,
            [body.profile_id, body.team_id, body.season_id, body.role, body.title, body.active]);
          return new Response(null, { status: 201 });
        }
        assert.equal(init.method, 'PATCH');
        const scope = ['profile_id','team_id','season_id'].map(key => {
          const filter = parsed.searchParams.get(key);
          assert.ok(filter?.startsWith('eq.'));
          return filter.slice(3);
        });
        const { rows } = await pg.query(`update profile_team_memberships set role=$1,title=$2,active=$3
          where profile_id=$4 and team_id=$5 and season_id=$6 returning id`, [body.role,body.title,body.active,...scope]);
        return Response.json(rows);
      } catch (error) {
        return Response.json({ code: error.code, message: error.message }, { status: 409 });
      }
    } },
  });
  try {
    await t.test('reproduces original ON CONFLICT failure', async () => {
      await assert.rejects(pg.query(`insert into profile_team_memberships(profile_id,team_id,season_id)
        values('coach','mixed-team','fall') on conflict(profile_id,team_id,season_id) do nothing`), { code: '42P10' });
    });
    await t.test('creates ordinary team admin membership', async () => {
      assert.equal((await ensureTeamCreatorMembership(db,'coach','mixed-team','fall')).error, null);
      const { rows } = await pg.query(`select role,title,active from profile_team_memberships`);
      assert.deepEqual(rows, [{ role:'ADMIN',title:'Admin',active:true }]);
    });
    await t.test('retry and concurrent submissions keep one membership', async () => {
      const results = await Promise.all(Array.from({length:3}, () => ensureTeamCreatorMembership(db,'coach','mixed-team','fall')));
      assert.ok(results.every(result => result.error === null));
      assert.equal((await pg.query('select * from profile_team_memberships')).rows.length, 1);
    });
    await t.test('retry reactivates only the exact profile/team/season', async () => {
      await pg.exec(`update profile_team_memberships set active=false;
        insert into profile_team_memberships(profile_id,team_id,season_id,role,active) values
        ('other','mixed-team','fall','COACH',false), ('coach','other-team','fall','COACH',false),
        ('coach','mixed-team','spring','COACH',false), ('coach','mixed-team',null,'COACH',false);`);
      assert.equal((await ensureTeamCreatorMembership(db,'coach','mixed-team','fall')).error, null);
      const { rows } = await pg.query('select * from profile_team_memberships where active=true');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].season_id, 'fall');
      assert.equal((await pg.query("select * from profile_team_memberships where role='COACH' and active=false")).rows.length,4);
    });
    await t.test('non-duplicate errors are not hidden or retried', async () => {
      failCode = '42501';
      const start = requests.length;
      assert.equal((await ensureTeamCreatorMembership(db,'coach','mixed-team','fall')).error.code,'42501');
      assert.equal(requests.length,start+1);
      failCode = null;
    });
    await t.test('unrelated duplicate violation is not reported as success', async () => {
      await pg.exec(`create unique index fixture_unique_title on profile_team_memberships(title) where title='Admin';`);
      assert.equal((await ensureTeamCreatorMembership(db,'new-coach','new-team','new-season')).error.code,'23505');
    });
  } finally { await pg.close(); }
});

test('team creation retains Other level and authorization before membership creation', () => {
  const route = readFileSync(new URL('../app/api/teams/create/route.ts', import.meta.url),'utf8');
  assert.match(route,/const teamLevel = body.teamLevel\?\.trim\(\) \|\| null/);
  assert.match(route,/level: teamLevel/);
  assert.match(route,/auth\.getUser\(\)/);
  assert.ok(route.indexOf('Only organization admins can create teams there.') < route.indexOf('await ensureTeamCreatorMembership('));
  assert.doesNotMatch(route,/onConflict: "profile_id,team_id,season_id"/);
});
