-- Music with Friends initial Postgres/Supabase schema.
-- OAuth tokens are intentionally absent. Store credentials in a server-side
-- secret manager keyed by provider_connections.id.

create extension if not exists pgcrypto with schema extensions;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  display_name text not null,
  avatar_url text,
  time_zone text not null default 'UTC',
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_users_handle_format check (
    handle = lower(handle)
    and handle ~ '^[a-z0-9_]{3,30}$'
  ),
  constraint app_users_display_name_length check (
    char_length(display_name) between 1 and 80
  ),
  constraint app_users_time_zone_length check (
    char_length(time_zone) between 1 and 100
  ),
  constraint app_users_visibility check (
    visibility in ('private', 'friends', 'groups', 'public')
  )
);

create unique index app_users_handle_unique
  on public.app_users (lower(handle));

create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  provider text not null,
  provider_account_id text,
  provider_display_name text,
  status text not null default 'connected',
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  last_synced_at timestamptz,
  sync_cursor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_connections_provider check (
    provider in (
      'spotify',
      'listenbrainz',
      'apple_music',
      'youtube_music',
      'manual_import'
    )
  ),
  constraint provider_connections_status check (
    status in ('connected', 'reauthorization_required', 'revoked', 'error')
  ),
  constraint provider_connections_disconnected_at check (
    (status = 'revoked' and disconnected_at is not null)
    or (status <> 'revoked' and disconnected_at is null)
  ),
  constraint provider_connections_user_provider_unique unique (user_id, provider),
  constraint provider_connections_id_user_unique unique (id, user_id)
);

comment on table public.provider_connections is
  'Non-secret provider metadata. OAuth credentials live in a server-side secret store keyed by id.';

create index provider_connections_user_status_idx
  on public.provider_connections (user_id, status);

create unique index provider_connections_provider_account_unique
  on public.provider_connections (provider, provider_account_id)
  where provider_account_id is not null;

create trigger provider_connections_set_updated_at
before update on public.provider_connections
for each row execute function public.set_updated_at();

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  provider_connection_id uuid,
  purpose text not null,
  document_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint consent_records_connection_owner_fk
    foreign key (provider_connection_id, user_id)
    references public.provider_connections (id, user_id)
    on delete cascade,
  constraint consent_records_purpose check (
    purpose in ('ingestion', 'social_sharing', 'public_profile')
  ),
  constraint consent_records_document_version_length check (
    char_length(document_version) between 1 and 100
  ),
  constraint consent_records_revocation_order check (
    revoked_at is null or revoked_at >= granted_at
  ),
  constraint consent_records_id_user_unique unique (id, user_id)
);

create index consent_records_user_purpose_idx
  on public.consent_records (user_id, purpose, granted_at desc);

create unique index consent_records_active_connection_purpose_unique
  on public.consent_records (provider_connection_id, purpose)
  where provider_connection_id is not null and revoked_at is null;

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.app_users (id) on delete cascade,
  addressee_id uuid not null references public.app_users (id) on delete cascade,
  status text not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status check (
    status in ('pending', 'accepted', 'rejected', 'blocked')
  ),
  constraint friendships_response_time check (
    (status = 'pending' and responded_at is null)
    or (status <> 'pending' and responded_at is not null)
  )
);

-- One relationship row per unordered pair. Requests cannot be duplicated in
-- the opposite direction.
create unique index friendships_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index friendships_requester_status_idx
  on public.friendships (requester_id, status);

create index friendships_addressee_status_idx
  on public.friendships (addressee_id, status);

create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function public.set_updated_at();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.app_users (id) on delete restrict,
  slug text not null,
  name text not null,
  description text not null default '',
  visibility text not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint groups_slug_format check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 3 and 80
  ),
  constraint groups_name_length check (char_length(name) between 1 and 100),
  constraint groups_description_length check (char_length(description) <= 500),
  constraint groups_visibility check (visibility in ('private', 'public'))
);

create unique index groups_slug_unique on public.groups (lower(slug));
create index groups_owner_idx on public.groups (owner_id);

create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  role text not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id),
  constraint group_members_role check (role in ('owner', 'admin', 'member')),
  constraint group_members_status check (status in ('active', 'left', 'removed'))
);

create index group_members_user_group_idx
  on public.group_members (user_id, group_id);

create index group_members_admin_idx
  on public.group_members (group_id, role)
  where role in ('owner', 'admin');

create function public.add_group_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger groups_add_owner_membership
after insert on public.groups
for each row execute function public.add_group_owner_membership();

create table public.listening_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users (id) on delete cascade,
  provider_connection_id uuid,
  provider text not null,
  dedupe_key text not null,
  evidence_kind text not null,
  analytics_eligible boolean not null default false,
  consent_record_id uuid,
  played_at timestamptz,
  observed_at timestamptz not null default now(),
  actual_duration_ms integer,
  catalog_duration_ms integer,
  track_provider_id text,
  track_isrc text,
  track_title text not null,
  artist_name text not null,
  album_name text,
  context_kind text,
  context_provider_id text,
  context_name text,
  context_quality text,
  external_url text,
  created_at timestamptz not null default now(),
  constraint listening_events_connection_owner_fk
    foreign key (provider_connection_id, user_id)
    references public.provider_connections (id, user_id)
    on delete cascade,
  constraint listening_events_consent_owner_fk
    foreign key (consent_record_id, user_id)
    references public.consent_records (id, user_id)
    on delete cascade,
  constraint listening_events_provider check (
    provider in (
      'spotify',
      'listenbrainz',
      'apple_music',
      'youtube_music',
      'manual_import',
      'demo'
    )
  ),
  constraint listening_events_evidence_kind check (
    evidence_kind in (
      'timestamped_listen',
      'recent_snapshot',
      'user_import',
      'synthetic'
    )
  ),
  constraint listening_events_context_kind check (
    context_kind is null
    or context_kind in ('playlist', 'album', 'artist', 'unknown')
  ),
  constraint listening_events_context_quality check (
    context_quality is null
    or context_quality in ('verified', 'inferred', 'unknown')
  ),
  constraint listening_events_actual_duration check (
    actual_duration_ms is null or actual_duration_ms >= 0
  ),
  constraint listening_events_catalog_duration check (
    catalog_duration_ms is null or catalog_duration_ms >= 0
  ),
  constraint listening_events_timed_evidence check (
    evidence_kind = 'recent_snapshot' or played_at is not null
  ),
  constraint listening_events_analytics_requires_time check (
    not analytics_eligible or played_at is not null
  ),
  constraint listening_events_analytics_provider_allowlist check (
    not analytics_eligible or provider in ('listenbrainz', 'demo')
  ),
  constraint listening_events_analytics_requires_consent check (
    not analytics_eligible or provider = 'demo' or consent_record_id is not null
  ),
  constraint listening_events_user_provider_dedupe unique (
    user_id,
    provider,
    dedupe_key
  )
);

comment on column public.listening_events.actual_duration_ms is
  'Observed listening duration only. Never substitute catalog_duration_ms.';

comment on column public.listening_events.analytics_eligible is
  'Set only after provider-policy and consent checks; snapshots are display evidence, not inferred plays.';

create index listening_events_user_played_at_idx
  on public.listening_events (user_id, played_at desc, id desc)
  where played_at is not null;

create index listening_events_connection_observed_idx
  on public.listening_events (provider_connection_id, observed_at desc)
  where provider_connection_id is not null;

create index listening_events_aggregate_source_idx
  on public.listening_events (user_id, provider, played_at)
  where analytics_eligible;

create index listening_events_track_isrc_idx
  on public.listening_events (track_isrc)
  where track_isrc is not null;

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  provider_connection_id uuid not null,
  job_kind text not null,
  idempotency_key text not null,
  status text not null default 'queued',
  attempt_count integer not null default 0,
  max_attempts integer not null default 8,
  available_at timestamptz not null default now(),
  lease_owner text,
  lease_expires_at timestamptz,
  cursor_before jsonb not null default '{}'::jsonb,
  cursor_after jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_jobs_connection_owner_fk
    foreign key (provider_connection_id, user_id)
    references public.provider_connections (id, user_id)
    on delete cascade,
  constraint sync_jobs_kind check (
    job_kind in ('initial_import', 'incremental_sync', 'reconcile', 'disconnect_cleanup')
  ),
  constraint sync_jobs_status check (
    status in ('queued', 'running', 'succeeded', 'retry_wait', 'dead', 'cancelled')
  ),
  constraint sync_jobs_attempts check (
    attempt_count >= 0 and max_attempts > 0 and attempt_count <= max_attempts
  ),
  constraint sync_jobs_lease_pair check (
    (lease_owner is null and lease_expires_at is null)
    or (lease_owner is not null and lease_expires_at is not null)
  ),
  constraint sync_jobs_connection_idempotency_unique unique (
    provider_connection_id,
    idempotency_key
  )
);

create index sync_jobs_due_idx
  on public.sync_jobs (available_at, created_at)
  where status in ('queued', 'retry_wait');

create index sync_jobs_expired_lease_idx
  on public.sync_jobs (lease_expires_at)
  where status = 'running';

create index sync_jobs_user_created_idx
  on public.sync_jobs (user_id, created_at desc);

create trigger sync_jobs_set_updated_at
before update on public.sync_jobs
for each row execute function public.set_updated_at();

create table public.outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  dedupe_key text not null unique,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  claimed_by text,
  claimed_at timestamptz,
  processed_at timestamptz,
  last_error text,
  constraint outbox_events_attempts check (attempt_count >= 0),
  constraint outbox_events_claim_pair check (
    (claimed_by is null and claimed_at is null)
    or (claimed_by is not null and claimed_at is not null)
  )
);

comment on table public.outbox_events is
  'Written in the same transaction as source changes; consumers deduplicate by stable event id/dedupe_key.';

create index outbox_events_due_idx
  on public.outbox_events (available_at, occurred_at)
  where processed_at is null;

create index outbox_events_aggregate_idx
  on public.outbox_events (aggregate_type, aggregate_id, occurred_at);

create table public.listening_aggregates (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.app_users (id) on delete cascade,
  source text not null default 'all',
  range_start timestamptz not null,
  range_end timestamptz not null,
  grain text not null,
  dimension_type text not null,
  dimension_key text not null,
  dimension_name text,
  play_count integer not null default 0,
  unique_track_count integer not null default 0,
  actual_listen_ms bigint not null default 0,
  duration_quality text not null default 'unavailable',
  evidence_count integer not null default 0,
  source_watermark timestamptz,
  computed_at timestamptz not null default now(),
  constraint listening_aggregates_source check (
    source in (
      'all',
      'listenbrainz',
      'manual_import',
      'demo'
    )
  ),
  constraint listening_aggregates_range check (range_end > range_start),
  constraint listening_aggregates_grain check (
    grain in ('day', 'week', 'month', 'year', 'all_time')
  ),
  constraint listening_aggregates_dimension check (
    dimension_type in ('summary', 'track', 'artist', 'playlist')
  ),
  constraint listening_aggregates_counts check (
    play_count >= 0
    and unique_track_count >= 0
    and actual_listen_ms >= 0
    and evidence_count >= 0
  ),
  constraint listening_aggregates_duration_quality check (
    duration_quality in ('exact', 'partial', 'unavailable')
  ),
  constraint listening_aggregates_projection_unique unique (
    user_id,
    source,
    range_start,
    range_end,
    grain,
    dimension_type,
    dimension_key
  )
);

comment on table public.listening_aggregates is
  'Replayable read model built only from policy-approved analytics_eligible evidence.';

create index listening_aggregates_dashboard_idx
  on public.listening_aggregates (
    user_id,
    grain,
    range_start desc,
    range_end desc,
    dimension_type,
    play_count desc
  );

create index listening_aggregates_stale_idx
  on public.listening_aggregates (computed_at, source_watermark);

-- SECURITY DEFINER helpers avoid recursive RLS checks. They expose booleans,
-- not rows, and bind the viewer to auth.uid().
create function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create function public.is_group_admin(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
      and membership.role in ('owner', 'admin')
      and membership.status = 'active'
  );
$$;

create function public.can_view_app_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users subject
    where subject.id = target_user_id
      and (
        subject.id = auth.uid()
        or subject.visibility = 'public'
        or (
          subject.visibility = 'friends'
          and auth.uid() is not null
          and exists (
            select 1
            from public.friendships friendship
            where friendship.status = 'accepted'
              and (
                (friendship.requester_id = subject.id and friendship.addressee_id = auth.uid())
                or (friendship.addressee_id = subject.id and friendship.requester_id = auth.uid())
              )
          )
        )
        or (
          subject.visibility = 'groups'
          and auth.uid() is not null
          and exists (
            select 1
            from public.group_members subject_membership
            join public.group_members viewer_membership
              on viewer_membership.group_id = subject_membership.group_id
            where subject_membership.user_id = subject.id
              and viewer_membership.user_id = auth.uid()
              and subject_membership.status = 'active'
              and viewer_membership.status = 'active'
          )
        )
      )
  );
$$;

revoke all on function public.is_group_member(uuid) from public;
revoke all on function public.is_group_admin(uuid) from public;
revoke all on function public.can_view_app_user(uuid) from public;
grant execute on function public.is_group_member(uuid) to anon, authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;
grant execute on function public.can_view_app_user(uuid) to anon, authenticated;

alter table public.app_users enable row level security;
alter table public.provider_connections enable row level security;
alter table public.consent_records enable row level security;
alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.listening_events enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.outbox_events enable row level security;
alter table public.listening_aggregates enable row level security;

create policy app_users_select_visible
on public.app_users for select
using (public.can_view_app_user(id));

create policy app_users_insert_self
on public.app_users for insert
to authenticated
with check (id = (select auth.uid()));

create policy app_users_update_self
on public.app_users for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy provider_connections_select_self
on public.provider_connections for select
to authenticated
using (user_id = (select auth.uid()));

create policy consent_records_select_self
on public.consent_records for select
to authenticated
using (user_id = (select auth.uid()));

create policy friendships_select_participant
on public.friendships for select
to authenticated
using (
  requester_id = (select auth.uid())
  or addressee_id = (select auth.uid())
);

create policy groups_select_visible
on public.groups for select
using (
  visibility = 'public'
  or public.is_group_member(id)
);

create policy group_members_select_fellow_members
on public.group_members for select
to authenticated
using (public.is_group_member(group_id));

-- Raw evidence is more sensitive than the dashboard read model. Clients can
-- read their own evidence; friend/group/public reads go through the versioned
-- API, which projects only authorized fields.
create policy listening_events_select_self
on public.listening_events for select
to authenticated
using (user_id = (select auth.uid()));

create policy sync_jobs_select_self
on public.sync_jobs for select
to authenticated
using (user_id = (select auth.uid()));

create policy listening_aggregates_select_visible
on public.listening_aggregates for select
using (public.can_view_app_user(user_id));

-- Provider/friend/group/event/job/outbox/aggregate mutations are server API
-- operations. No client mutation policies are intentionally defined.
revoke insert, update, delete on public.provider_connections from anon, authenticated;
revoke insert, update, delete on public.consent_records from anon, authenticated;
revoke insert, update, delete on public.friendships from anon, authenticated;
revoke insert, update, delete on public.groups from anon, authenticated;
revoke insert, update, delete on public.group_members from anon, authenticated;
revoke insert, update, delete on public.listening_events from anon, authenticated;
revoke insert, update, delete on public.sync_jobs from anon, authenticated;
revoke all on public.outbox_events from anon, authenticated;
revoke insert, update, delete on public.listening_aggregates from anon, authenticated;
