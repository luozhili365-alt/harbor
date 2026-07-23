-- Harbor Database Initialization
-- This creates the required extensions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- For fuzzy text search
CREATE EXTENSION IF NOT EXISTS "vector";      -- For pgvector (embeddings)

-- Note: Tables are created by Alembic migrations or SQLAlchemy auto-create
