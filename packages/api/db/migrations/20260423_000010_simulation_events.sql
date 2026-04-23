-- ADR-011 — Simulation telemetry event log.
--
-- Append-only audit stream. `id` is the SSE Last-Event-ID cursor
-- (monotonic across the whole table). `seq` is the per-simulation
-- ordinal used to reconcile UI state. `payload` shape is enforced
-- by the Zod union in @agentics/contracts/simulation-events.
--
-- The NOTIFY trigger publishes minimal `(simulation_id, id)` pairs on
-- the `simulation_events_channel`; SSE handlers LISTEN on that channel
-- and, on notification, SELECT rows WHERE simulation_id = $1 AND id > $2.

BEGIN;

CREATE TABLE IF NOT EXISTS simulation_events (
  id             BIGSERIAL     PRIMARY KEY,
  simulation_id  UUID          NOT NULL,
  seq            INT           NOT NULL,
  ts             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  kind           TEXT          NOT NULL,
  payload        JSONB         NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT simulation_events_seq_unique UNIQUE (simulation_id, seq)
);

CREATE INDEX IF NOT EXISTS simulation_events_sim_id_idx
  ON simulation_events (simulation_id, id);

CREATE INDEX IF NOT EXISTS simulation_events_kind_idx
  ON simulation_events (kind);

-- NOTIFY trigger. Payload is a compact JSON object; consumers decode
-- it to learn which simulation advanced and what id they should catch
-- up to.
CREATE OR REPLACE FUNCTION simulation_events_notify()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'simulation_events_channel',
    json_build_object(
      'simulation_id', NEW.simulation_id,
      'id',            NEW.id,
      'kind',          NEW.kind
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS simulation_events_notify_trigger ON simulation_events;
CREATE TRIGGER simulation_events_notify_trigger
AFTER INSERT ON simulation_events
FOR EACH ROW EXECUTE FUNCTION simulation_events_notify();

COMMIT;
