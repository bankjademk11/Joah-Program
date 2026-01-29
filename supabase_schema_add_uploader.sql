-- Add 'uploaded_by' column to 'location_inventory' table
ALTER TABLE location_inventory 
ADD COLUMN uploaded_by TEXT DEFAULT 'Unknown';

-- Add comment to the column
COMMENT ON COLUMN location_inventory.uploaded_by IS 'Stores the name of the user who uploaded or last updated this record';
