CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create stalwart database and user
CREATE USER stalwart WITH PASSWORD 'stalwart_sogo6_2026';
CREATE DATABASE stalwart OWNER stalwart;
GRANT ALL PRIVILEGES ON DATABASE stalwart TO stalwart;
