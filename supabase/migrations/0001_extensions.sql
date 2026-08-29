-- 0001_extensions
-- Trigram search for product name pickers (search-as-you-type, brief §8.2/§8.7).
-- gen_random_uuid() is built in on PG14+, no pgcrypto needed.

create extension if not exists pg_trgm with schema extensions;
