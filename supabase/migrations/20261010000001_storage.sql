-- Supabase Storage policies. The application test runner skips this file when the
-- storage schema is not installed. Apply it on a Supabase project after creating
-- the private buckets face-originals, face-previews, and evidence.

insert into storage.buckets (id, name, public)
values
  ('face-originals', 'face-originals', false),
  ('face-previews', 'face-previews', false),
  ('evidence', 'evidence', false)
on conflict (id) do update set public = false;

create policy face_originals_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'face-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy face_originals_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'face-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy face_originals_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'face-originals'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy evidence_no_public on storage.objects
  for select to authenticated
  using (bucket_id = 'evidence' and false);
