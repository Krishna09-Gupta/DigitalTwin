CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'visiting_scientist');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stations (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(120) UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'visiting_scientist',
    station_id INTEGER REFERENCES stations(id),
    security_question VARCHAR(255) NOT NULL,
    security_answer_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admin_station_rule CHECK (
        role = 'admin'
        OR station_id IS NOT NULL
    )
);

CREATE TABLE IF NOT EXISTS sessions (
    jti UUID PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry
    ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS telemetry_metrics (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    domain VARCHAR(80) NOT NULL,
    metric_name VARCHAR(120) NOT NULL,
    unit VARCHAR(30) NOT NULL DEFAULT '',
    current_value NUMERIC NOT NULL,
    min_value NUMERIC,
    max_value NUMERIC,
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(station_id, metric_name)
);

CREATE TABLE IF NOT EXISTS simulation_profiles (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    metric_name VARCHAR(120) NOT NULL,
    step NUMERIC NOT NULL DEFAULT 1,
    min_value NUMERIC,
    max_value NUMERIC,
    UNIQUE(station_id, metric_name)
);

CREATE TABLE IF NOT EXISTS station_logistics (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    category VARCHAR(80) NOT NULL,
    item_key VARCHAR(100) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    unit VARCHAR(40) NOT NULL,
    capacity NUMERIC,
    current_quantity NUMERIC NOT NULL,
    reorder_threshold NUMERIC,
    status VARCHAR(30) NOT NULL DEFAULT 'NOMINAL',
    storage_location VARCHAR(160) NOT NULL DEFAULT '',
    eta VARCHAR(100) NOT NULL DEFAULT 'On station',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(station_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_logistics_station
    ON station_logistics(station_id);

CREATE TABLE IF NOT EXISTS condition_requests (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    metric_id INTEGER NOT NULL REFERENCES telemetry_metrics(id) ON DELETE CASCADE,
    requested_by INTEGER NOT NULL REFERENCES users(id),
    proposed_value NUMERIC NOT NULL,
    justification TEXT NOT NULL,
    status request_status NOT NULL DEFAULT 'PENDING',
    reviewed_by INTEGER REFERENCES users(id),
    reviewed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS emergency_events (
    id SERIAL PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    metric_id INTEGER NOT NULL REFERENCES telemetry_metrics(id) ON DELETE CASCADE,
    triggered_by INTEGER NOT NULL REFERENCES users(id),
    resolved_by INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    previous_value NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(80),
    entity_id VARCHAR(100),
    station_id INTEGER REFERENCES stations(id),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_station
    ON audit_logs(station_id);

CREATE INDEX IF NOT EXISTS idx_telemetry_station
    ON telemetry_metrics(station_id);

CREATE INDEX IF NOT EXISTS idx_requests_status
    ON condition_requests(status);

-- This file creates structure only. It intentionally inserts ZERO
-- application rows.
--
-- Run `npm run seed` once after applying this schema to create the demo
-- stations, initial telemetry profiles, logistics inventory and demo accounts.