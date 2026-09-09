create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('clubhouse-places-retention', '17 * * * *', $job$
  delete from public.places_coordinate_cache where expires_at <= now();
  delete from public.places_search_sessions where created_at < now()-interval '48 hours';
  delete from public.places_request_reservations where created_at < now()-interval '48 hours';
$job$);
