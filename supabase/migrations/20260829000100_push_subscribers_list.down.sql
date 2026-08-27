-- Deshace 20260829000100_push_subscribers_list.sql.
-- No borra ningún dato: la función solo leía.
drop function if exists public.admin_push_subscribers();
