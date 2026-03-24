-- Add unique constraint on year for upsert support
ALTER TABLE seasons ADD CONSTRAINT seasons_year_unique UNIQUE (year);
