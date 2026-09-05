import test from "node:test";
import assert from "node:assert/strict";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";
test("complete application migration history applies in dependency order with Player Beta RLS", async () => {
  const db = await fullPlayerDatabase();
  try {
    assert.ok(
      (
        await db.query(
          "select to_regclass('public.player_invitations') table_name",
        )
      ).rows[0].table_name,
    );
    const policies = await db.query(
      "select count(*)::int n from pg_policies where policyname='player_beta_staff_boundary'",
    );
    assert.ok(policies.rows[0].n >= 20);
  } finally {
    await db.close();
  }
});
