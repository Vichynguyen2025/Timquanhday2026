-- Phase 2: Message dedup - client_temp_id
ALTER TABLE messages ADD COLUMN client_temp_id VARCHAR(64) DEFAULT NULL AFTER id;
ALTER TABLE messages ADD UNIQUE INDEX idx_sender_temp (sender_id, client_temp_id);
