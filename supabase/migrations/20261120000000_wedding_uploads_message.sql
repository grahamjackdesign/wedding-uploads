-- Optional guest message attached to an upload.
alter table public.wedding_uploads
  add column if not exists message text;
