-- Add 'accepted_by' column if it doesn't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'store_requests' and column_name = 'accepted_by') then
        alter table store_requests add column accepted_by text;
    end if;
end $$;
