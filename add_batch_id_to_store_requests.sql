-- Add batch_id column to group requests together
ALTER TABLE store_requests 
ADD COLUMN IF NOT EXISTS batch_id uuid DEFAULT gen_random_uuid();

-- Add comment
COMMENT ON COLUMN store_requests.batch_id IS 'Group ID for multiple items requested at once';
