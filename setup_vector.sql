-- Enable the pgvector extension to work with embeddings
create extension if not exists vector;

-- Create the table for your framework criteria
create table cia_criteria (
  id serial primary key,
  category text not null,       
  theme text not null,          
  indicator text not null,      
  sub_indicator text not null,  
  search_text text not null,    
  embedding vector(1536)        -- Using 1536 dimensions for text-embedding-3-small
);

-- Function to search for matching criteria via cosine similarity
create or replace function match_cia_criteria (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id int,
  category text,
  theme text,
  indicator text,
  sub_indicator text,
  similarity float
)
language sql stable
as $$
  select
    cia_criteria.id,
    cia_criteria.category,
    cia_criteria.theme,
    cia_criteria.indicator,
    cia_criteria.sub_indicator,
    1 - (cia_criteria.embedding <=> query_embedding) as similarity
  from cia_criteria
  where 1 - (cia_criteria.embedding <=> query_embedding) > match_threshold
  order by cia_criteria.embedding <=> query_embedding
  limit match_count;
$$;
