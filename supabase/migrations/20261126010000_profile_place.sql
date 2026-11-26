alter table profiles
  add column if not exists place jsonb not null default '{"country":null,"province":null}';
