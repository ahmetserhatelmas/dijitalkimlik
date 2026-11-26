-- Suret likeness-licensing schema.
-- Photos live in object storage. This database stores paths, hashes, and agreements.

do $$
begin
  create extension if not exists pgcrypto;
exception
  when others then
    -- PostgreSQL 13+ provides gen_random_uuid() without pgcrypto.
    -- Embedded test databases may not ship the extension files.
    null;
end $$;

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    execute $fn$
      create function auth.uid() returns uuid
      language sql stable
      as $body$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $body$
    $fn$;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role bypassrls;
  end if;
end $$;

create type user_role as enum ('face_owner', 'producer', 'agency_member', 'admin');
create type asset_status as enum ('pending_review', 'authorized', 'rejected', 'suspended', 'removed');
create type removal_status as enum ('active', 'removed');
create type rule_status as enum ('draft', 'published', 'archived');
create type request_status as enum ('pending_review', 'blocked', 'approved', 'rejected', 'cancelled');
create type license_status as enum (
  'draft', 'pending_consent', 'approved', 'signed', 'payment_pending', 'recording', 'active',
  'rejected', 'cancelled', 'expired', 'refund_pending', 'refunded', 'disputed', 'recording_failed', 'suspended'
);
create type payment_status as enum (
  'initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'refund_pending', 'refunded', 'not_required'
);
create type chain_status as enum ('pending', 'submitted', 'confirmed', 'failed');
create type verification_status as enum ('unverified', 'pending', 'verified', 'rejected');
create type agreement_party as enum ('licensor', 'licensee');
create type report_status as enum ('submitted', 'in_review', 'confirmed', 'dismissed');
create type dispute_status as enum ('open', 'in_review', 'resolved', 'closed');
create type representation_status as enum ('pending', 'active', 'revoked');

create table profiles (
  id uuid primary key,
  email text not null unique,
  display_name text not null,
  bio text not null default '',
  location text,
  company_name text,
  verification_status verification_status not null default 'unverified',
  email_verified boolean not null default false,
  privacy jsonb not null default '{"discoverable":false,"showPreviewToProducers":false,"showLegalName":false}',
  deletion_requested_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table user_roles (
  user_id uuid not null references profiles(id) on delete cascade,
  role user_role not null,
  primary key (user_id, role)
);

create table dev_credentials (
  user_id uuid primary key references profiles(id) on delete cascade,
  password_hash text not null
);

create table agencies (
  id uuid primary key,
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table agency_memberships (
  agency_id uuid not null references agencies(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  member_role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);

create table representation_authorizations (
  id uuid primary key,
  agency_id uuid not null references agencies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  scopes text[] not null default '{}',
  status representation_status not null default 'active',
  evidence_note text not null,
  granted_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index representation_active_uidx
  on representation_authorizations (agency_id, profile_id)
  where status = 'active';

create table face_assets (
  id uuid primary key,
  profile_id uuid not null references profiles(id),
  uploader_id uuid not null references profiles(id),
  storage_path text not null unique,
  preview_path text,
  file_type text not null,
  file_size bigint not null check (file_size > 0),
  sha256 text not null,
  perceptual_hash text,
  duplicate_flags jsonb not null default '[]',
  authorization_evidence_id uuid,
  moderation_status asset_status not null default 'pending_review',
  removal_status removal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index face_assets_profile_idx on face_assets (profile_id);
create index face_assets_sha256_idx on face_assets (sha256);
create index face_assets_phash_idx on face_assets (perceptual_hash);
create index face_assets_status_idx on face_assets (moderation_status);

create table asset_versions (
  id uuid primary key,
  asset_id uuid not null references face_assets(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  file_type text not null,
  file_size bigint not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table authorization_attestations (
  id uuid primary key,
  asset_id uuid not null references face_assets(id) on delete cascade,
  statement text not null,
  attested_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

alter table face_assets
  add constraint face_assets_attestation_fk
  foreign key (authorization_evidence_id) references authorization_attestations(id);

create table asset_access_logs (
  id uuid primary key,
  asset_id uuid not null references face_assets(id) on delete cascade,
  actor_id uuid not null references profiles(id),
  action text not null,
  created_at timestamptz not null default now()
);

create index asset_access_logs_asset_idx on asset_access_logs (asset_id, created_at desc);

create table licensing_rule_sets (
  id uuid primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  asset_id uuid references face_assets(id) on delete cascade,
  name text not null,
  status rule_status not null default 'draft',
  current_version_id uuid,
  current_version_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index licensing_rule_sets_profile_idx on licensing_rule_sets (profile_id, status);

create table licensing_rule_versions (
  id uuid primary key,
  rule_set_id uuid not null references licensing_rule_sets(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  rules jsonb not null,
  status rule_status not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (rule_set_id, version_number)
);

alter table licensing_rule_sets
  add constraint licensing_rule_sets_current_version_fk
  foreign key (current_version_id) references licensing_rule_versions(id);

create table projects (
  id uuid primary key,
  owner_id uuid not null references profiles(id),
  name text not null,
  description text not null,
  company_name text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_owner_idx on projects (owner_id);

create table project_members (
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  member_role text not null default 'producer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table license_requests (
  id uuid primary key,
  producer_id uuid not null references profiles(id),
  project_id uuid not null references projects(id),
  asset_id uuid not null references face_assets(id),
  rule_version_id uuid references licensing_rule_versions(id),
  intended_use text not null,
  usage jsonb not null,
  compatibility jsonb not null,
  status request_status not null,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index license_requests_producer_idx on license_requests (producer_id, created_at desc);
create index license_requests_asset_idx on license_requests (asset_id, status);

create table license_agreements (
  id uuid primary key,
  license_id uuid not null unique,
  request_id uuid not null unique references license_requests(id),
  status license_status not null,
  document jsonb not null,
  document_hash text not null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency in ('TRY', 'USD', 'EUR')),
  payment_required boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  activated_at timestamptz
);

create index license_agreements_status_idx on license_agreements (status);

create table agreement_rule_snapshots (
  id uuid primary key,
  agreement_id uuid not null unique references license_agreements(id) on delete cascade,
  rule_set_id uuid not null references licensing_rule_sets(id),
  rule_version_id uuid not null references licensing_rule_versions(id),
  version_number integer not null,
  rules jsonb not null,
  created_at timestamptz not null default now()
);

create table consent_records (
  id uuid primary key,
  agreement_id uuid not null references license_agreements(id) on delete cascade,
  party agreement_party not null,
  user_id uuid not null references profiles(id),
  statement text not null,
  agreement_hash text not null,
  created_at timestamptz not null default now(),
  unique (agreement_id, party)
);

create table electronic_signatures (
  id uuid primary key,
  agreement_id uuid not null references license_agreements(id) on delete cascade,
  party agreement_party not null,
  signer_user_id uuid not null references profiles(id),
  typed_name text not null,
  method text not null,
  disclaimer text not null,
  agreement_hash text not null,
  ip_address text,
  user_agent text,
  signed_at timestamptz not null default now(),
  unique (agreement_id, party)
);

create table payments (
  id uuid primary key,
  agreement_id uuid not null references license_agreements(id),
  provider text not null check (provider in ('sandbox', 'iyzico')),
  provider_ref text not null,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null,
  status payment_status not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_ref),
  unique (agreement_id, idempotency_key)
);

create index payments_agreement_idx on payments (agreement_id);

create table fake_wallets (
  profile_id uuid primary key references profiles(id),
  balance_minor integer not null check (balance_minor >= 0)
);

create table webhook_events (
  event_id text primary key,
  provider text not null,
  payload_hash text not null,
  received_at timestamptz not null default now()
);

create table blockchain_records (
  id uuid primary key,
  license_id uuid not null unique,
  chain_id integer,
  contract_address text,
  tx_hash text,
  agreement_hash text not null,
  rule_snapshot_hash text not null,
  asset_reference text not null,
  project_reference text not null,
  status chain_status not null,
  error text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  constraint blockchain_confirmed_has_tx check (status <> 'confirmed' or tx_hash is not null)
);

create table notifications (
  id uuid primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on notifications (user_id, created_at desc);

create table misuse_reports (
  id uuid primary key,
  reporter_id uuid not null references profiles(id),
  license_id uuid,
  asset_id uuid references face_assets(id),
  suspected_project text not null,
  url text,
  observed_at timestamptz not null,
  description text not null,
  status report_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index misuse_reports_reporter_idx on misuse_reports (reporter_id, created_at desc);

create table misuse_evidence (
  id uuid primary key,
  report_id uuid not null references misuse_reports(id) on delete cascade,
  storage_path text not null,
  sha256 text not null,
  file_type text not null,
  file_size bigint not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table dispute_cases (
  id uuid primary key,
  report_id uuid references misuse_reports(id),
  agreement_id uuid references license_agreements(id),
  status dispute_status not null default 'open',
  summary text not null,
  opened_by uuid not null references profiles(id),
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key,
  sequence bigint generated always as identity unique,
  actor_id uuid,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}',
  prev_hash text not null,
  entry_hash text not null unique,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

create table platform_settings (
  id integer primary key default 1 check (id = 1),
  settings jsonb not null
);

create table deletion_requests (
  id uuid primary key,
  user_id uuid not null references profiles(id),
  status text not null check (status in ('requested', 'completed', 'rejected')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  note text not null default ''
);

create or replace function public.reject_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'This record is immutable';
end $$;

create or replace function public.protect_agreement_document()
returns trigger
language plpgsql
as $$
begin
  if new.document is distinct from old.document
     or new.document_hash is distinct from old.document_hash
     or new.license_id is distinct from old.license_id
     or new.request_id is distinct from old.request_id
     or new.amount_minor is distinct from old.amount_minor
     or new.currency is distinct from old.currency then
    raise exception 'Accepted agreement content is immutable';
  end if;
  return new;
end $$;

create trigger agreement_rule_snapshots_immutable
  before update or delete on agreement_rule_snapshots
  for each row execute function public.reject_mutation();

create trigger consent_records_immutable
  before update or delete on consent_records
  for each row execute function public.reject_mutation();

create trigger electronic_signatures_immutable
  before update or delete on electronic_signatures
  for each row execute function public.reject_mutation();

create trigger audit_logs_immutable
  before update or delete on audit_logs
  for each row execute function public.reject_mutation();

create trigger licensing_rule_versions_immutable
  before update or delete on licensing_rule_versions
  for each row execute function public.reject_mutation();

create trigger license_agreements_content_immutable
  before update on license_agreements
  for each row execute function public.protect_agreement_document();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table dev_credentials enable row level security;
alter table agencies enable row level security;
alter table agency_memberships enable row level security;
alter table representation_authorizations enable row level security;
alter table face_assets enable row level security;
alter table asset_versions enable row level security;
alter table authorization_attestations enable row level security;
alter table asset_access_logs enable row level security;
alter table licensing_rule_sets enable row level security;
alter table licensing_rule_versions enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table license_requests enable row level security;
alter table license_agreements enable row level security;
alter table agreement_rule_snapshots enable row level security;
alter table consent_records enable row level security;
alter table electronic_signatures enable row level security;
alter table payments enable row level security;
alter table webhook_events enable row level security;
alter table blockchain_records enable row level security;
alter table notifications enable row level security;
alter table misuse_reports enable row level security;
alter table misuse_evidence enable row level security;
alter table dispute_cases enable row level security;
alter table audit_logs enable row level security;
alter table platform_settings enable row level security;
alter table deletion_requests enable row level security;

create policy profiles_select_own on profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy user_roles_select_own on user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy dev_credentials_deny on dev_credentials
  for all to authenticated
  using (false);

create policy face_assets_owner on face_assets
  for all to authenticated
  using (profile_id = auth.uid() or uploader_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or uploader_id = auth.uid() or public.is_admin());

create policy representations_read on representation_authorizations
  for select to authenticated
  using (profile_id = auth.uid() or granted_by = auth.uid() or public.is_admin());

create policy rule_sets_owner on licensing_rule_sets
  for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid());

create policy rule_versions_select on licensing_rule_versions
  for select to authenticated
  using (
    public.is_admin() or exists (
      select 1 from licensing_rule_sets s
      where s.id = rule_set_id and s.profile_id = auth.uid()
    )
  );

create policy projects_member on projects
  for select to authenticated
  using (
    owner_id = auth.uid() or public.is_admin() or exists (
      select 1 from project_members m where m.project_id = projects.id and m.user_id = auth.uid()
    )
  );

create policy project_members_select on project_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy agreements_parties on license_agreements
  for select to authenticated
  using (
    public.is_admin()
    or document->>'licensorProfileId' = auth.uid()::text
    or document->>'licenseeProfileId' = auth.uid()::text
  );

create policy snapshots_parties on agreement_rule_snapshots
  for select to authenticated
  using (
    exists (
      select 1 from license_agreements a
      where a.id = agreement_id
        and (
          public.is_admin()
          or a.document->>'licensorProfileId' = auth.uid()::text
          or a.document->>'licenseeProfileId' = auth.uid()::text
        )
    )
  );

create policy notifications_own on notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy reports_own on misuse_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

create policy audit_admin on audit_logs
  for select to authenticated
  using (public.is_admin());

create policy payments_admin on payments
  for select to authenticated
  using (public.is_admin());
