-- RAG knowledge base storage with pgvector
create extension if not exists vector;

create table if not exists kb_documents (
  id          serial primary key,
  slug        text not null unique,
  title       text not null,
  source      text not null,           -- file path in repo, e.g. kb/handbook.md
  updated_at  timestamptz not null default now()
);

create table if not exists kb_chunks (
  id               bigserial primary key,
  document_id      int  not null references kb_documents(id) on delete cascade,
  chunk_index      int  not null,
  heading          text not null,
  content          text not null,
  content_hash     text not null unique,  -- sha256(model + doc + heading + content): idempotent ingest
  embedding_model  text not null,
  embedding        vector(768) not null,
  created_at       timestamptz not null default now()
);

create index if not exists kb_chunks_doc_idx on kb_chunks(document_id);
create index if not exists kb_chunks_embedding_idx
  on kb_chunks using hnsw (embedding vector_cosine_ops);

alter table kb_documents enable row level security;
alter table kb_chunks    enable row level security;

-- Top-k cosine similarity search, filtered by a minimum similarity threshold
create or replace function match_kb_chunks(
  query_embedding vector(768),
  match_count     int   default 5,
  min_similarity  float default 0.5
)
returns table (
  id          bigint,
  document_id int,
  title       text,
  slug        text,
  heading     text,
  content     text,
  similarity  float
)
language sql stable
as $$
  select c.id, c.document_id, d.title, d.slug, c.heading, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from kb_chunks c
  join kb_documents d on d.id = c.document_id
  where 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

-- Lock the function down to the server role
revoke execute on function match_kb_chunks(vector, int, float) from public, anon, authenticated;
grant execute on function match_kb_chunks(vector, int, float) to service_role;
