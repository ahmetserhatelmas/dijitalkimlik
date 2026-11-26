alter table profiles
  add column if not exists appearance jsonb not null default '{"gender":null,"ageRange":null,"heightRange":null,"hairColor":null,"eyeColor":null}';
