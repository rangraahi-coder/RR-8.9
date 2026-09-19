-- Add the process already offered by Contractor Issue; preserve existing labels/data.
-- Run as a standalone SQL Editor query before retrying the voucher.
ALTER TYPE public.contractor_process_type ADD VALUE IF NOT EXISTS 'Contractor';
NOTIFY pgrst, 'reload schema';
