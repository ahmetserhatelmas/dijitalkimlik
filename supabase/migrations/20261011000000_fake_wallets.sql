create table if not exists fake_wallets (
  profile_id uuid primary key references profiles(id),
  balance_minor integer not null check (balance_minor >= 0)
);
