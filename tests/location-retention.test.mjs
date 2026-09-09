import test from "node:test";
import assert from "node:assert/strict";
import { fullPlayerDatabase } from "./helpers/fullPlayerDatabase.mjs";

test("hourly retention job deletes expired provider coordinates but preserves fresh cache", async () => {
  const db = await fullPlayerDatabase();
  try {
    await db.exec(`insert into public.places_coordinate_cache(place_id,latitude,longitude,expires_at) values
      ('expired',35,-80,now()-interval '1 hour'),('fresh',35,-80,now()+interval '1 day');`);
    const { rows } = await db.query("select schedule,command from cron.job where jobname='clubhouse-places-retention'");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].schedule, "17 * * * *");
    await db.exec(rows[0].command);
    assert.deepEqual((await db.query("select place_id from public.places_coordinate_cache")).rows, [{ place_id: "fresh" }]);
  } finally { await db.close(); }
});
