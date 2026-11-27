-- LOCAL TEST DATA ONLY — applied by `supabase db reset` on your machine.
-- Never run this against the production project. Test accounts are created
-- by `npm run test:e2e` (server/test/e2e.test.js), not here.
insert into public.sites (site_key, name) values
  ('test-site-a', 'Test Site A'),
  ('test-site-b', 'Test Site B');
