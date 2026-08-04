-- SEC-002 + SEC-009: revoke client execute on internal/trigger functions,
-- scope RPCs to authenticated only. user_role() is left untouched: RLS
-- policies invoke it as anon/authenticated, so PUBLIC execute must remain.

revoke execute on function public.adjust_karma(uuid, integer) from public, anon, authenticated;
revoke execute on function public.check_explorer_badge(uuid) from public, anon, authenticated;
revoke execute on function public.check_guardian_badge(uuid) from public, anon, authenticated;
revoke execute on function public.check_host_badge(uuid) from public, anon, authenticated;
revoke execute on function public.check_photographer_badge(uuid) from public, anon, authenticated;
revoke execute on function public.check_pioneer_badge(uuid, integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.protect_pin_sensitive_fields() from public, anon, authenticated;
revoke execute on function public.on_forum_vote_badge_trigger() from public, anon, authenticated;
revoke execute on function public.on_forum_vote_change_karma() from public, anon, authenticated;
revoke execute on function public.on_pin_badge_trigger() from public, anon, authenticated;
revoke execute on function public.on_pin_photo_badge_trigger() from public, anon, authenticated;
revoke execute on function public.on_pin_vote_badge_trigger() from public, anon, authenticated;
revoke execute on function public.on_pin_vote_change_karma() from public, anon, authenticated;
revoke execute on function public.on_profile_badge_trigger() from public, anon, authenticated;
revoke execute on function public.notify_admins_about_report() from public, anon, authenticated;
revoke execute on function public.notify_badge_awarded() from public, anon, authenticated;
revoke execute on function public.notify_event_rsvp_in_window() from public, anon, authenticated;
revoke execute on function public.notify_forum_reply() from public, anon, authenticated;
revoke execute on function public.queue_notification_push() from public, anon, authenticated;

-- Admin RPCs: internal user_role() = 'admin' checks already gate these,
-- but client execute should still be scoped to authenticated (defense in depth).
revoke execute on function public.admin_broadcast_push_notification(text, text) from public, anon;
revoke execute on function public.admin_count_push_subscribers() from public, anon;
revoke execute on function public.admin_set_user_role(uuid, text) from public, anon;
grant execute on function public.admin_broadcast_push_notification(text, text) to authenticated;
grant execute on function public.admin_count_push_subscribers() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;

-- Public-facing RPCs: authenticated only, anon dropped, PUBLIC dropped.
revoke execute on function public.vote_pin(uuid, smallint) from public, anon;
revoke execute on function public.vote_thread(uuid, integer) from public, anon;
revoke execute on function public.extend_pin_ttl(uuid, integer) from public, anon;
revoke execute on function public.set_pin_permanent(uuid) from public, anon;
revoke execute on function public.verify_and_make_permanent(uuid, text) from public, anon;
grant execute on function public.vote_pin(uuid, smallint) to authenticated;
grant execute on function public.vote_thread(uuid, integer) to authenticated;
grant execute on function public.extend_pin_ttl(uuid, integer) to authenticated;
grant execute on function public.set_pin_permanent(uuid) to authenticated;
grant execute on function public.verify_and_make_permanent(uuid, text) to authenticated;
