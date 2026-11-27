-- Caribbean Literacy Observatory: relational schema for when the JSON files outgrow
-- the repository (PostgreSQL 14+, e.g. Supabase). Mirrors data/*.json field for field.

create table countries (
  iso3 char(3) primary key, name text not null, in_wdi boolean not null default true,
  lat numeric(6,3), lon numeric(6,3));

create table sources (
  id text primary key, name text not null, publisher text not null, url text not null check (url like 'https://%'),
  api text, access text, licence text not null, licence_status text not null check (licence_status in ('verified','to-verify')),
  coverage text, audit text check (audit in ('ingested','next','pending','excluded')), notes text);

create table indicators (
  code text primary key, short text not null, name text not null, domain text not null, unit text not null,
  kind text not null check (kind in ('direct','proxy','derived-by-source')), audited boolean not null default false, definition text);

-- Preserved original files (directive 5): every retrieval stores the untouched response.
create table raw_retrievals (
  id bigserial primary key, source_id text references sources(id), request_url text not null,
  retrieved_at timestamptz not null default now(), sha256 text not null, body bytea not null);

create table observations (
  id text primary key, country char(3) not null references countries(iso3), indicator text not null references indicators(code),
  ref_year int not null check (ref_year between 1900 and 2100), value double precision not null,
  source_id text not null references sources(id), original_producer text, source_url text not null check (source_url like 'https://%'),
  licence text not null, retrieved date not null, retrieval_id bigint references raw_retrievals(id),
  is_estimate boolean,                                  -- null = not stated by source
  obs_status text, transformations jsonb not null default '[]',   -- directive 7: any Observatory calculation is listed here
  source_check text not null, scholarly_review text not null default 'pending' check (scholarly_review in ('pending','approved','queried')),
  flags jsonb not null default '[]', notes text,
  unique (country, indicator, ref_year, source_id));

-- Version history (directive 16): every change to a value is kept.
create table observation_versions (
  observation_id text references observations(id), changed_at timestamptz not null default now(),
  old_value double precision, new_value double precision, reason text not null);

create table research_records (
  id text primary key, title text not null, country text not null, domain text not null, level text not null,
  year int not null, methodology text not null, framework text, findings text, indicators text, limitations text,
  citation text not null, url text check (url is null or url like 'https://%'),
  review_status text not null default 'draft' check (review_status in ('draft','in_review','approved','rejected')),
  checked_on date,
  check (review_status <> 'approved' or checked_on is not null));

create table policy_documents (
  id text primary key, title text not null, country text not null, year int, type text,
  url text not null check (url like 'https://%'), summary text,
  review_status text not null default 'draft' check (review_status in ('draft','in_review','approved','rejected')), checked_on date, publisher text);

create table publications (
  id text primary key, series text not null, number text, title text not null,
  status text not null check (status in ('planned','draft','published')), date text, authors text[], summary text, url text);

create table corrections (
  id bigserial primary key, logged_on date not null default current_date, type text not null,
  summary text not null, record_ids text[]);

-- Only approved scholarship is public.
create view public_research as select * from research_records where review_status = 'approved';
create view public_policy as select * from policy_documents where review_status = 'approved';
