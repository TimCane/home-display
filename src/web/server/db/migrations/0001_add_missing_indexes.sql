CREATE INDEX "entries_enabled_idx" ON "entries" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "entry_drafts_consumed_at_expires_at_idx" ON "entry_drafts" USING btree ("consumed_at","expires_at");--> statement-breakpoint
CREATE INDEX "generator_runs_instance_id_ran_at_idx" ON "generator_runs" USING btree ("instance_id","ran_at" DESC);--> statement-breakpoint
CREATE INDEX "display_status_history_polled_at_idx" ON "display_status_history" USING btree ("polled_at");--> statement-breakpoint
CREATE INDEX "push_log_entry_id_idx" ON "push_log" USING btree ("entry_id");
