ALTER TABLE `tournaments` ADD `qualified_count` integer;--> statement-breakpoint
ALTER TABLE `tournaments` ADD `loser_bracket` integer DEFAULT false NOT NULL;