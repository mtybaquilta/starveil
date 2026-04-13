-- Allow ship_queue items to have NULL completes_at (queued but not yet building)
ALTER TABLE ship_queue ALTER COLUMN completes_at DROP NOT NULL;
