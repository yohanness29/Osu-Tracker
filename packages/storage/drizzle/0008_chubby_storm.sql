CREATE TABLE `top_scores` (
	`mode` text NOT NULL,
	`position` integer NOT NULL,
	`score_id` integer NOT NULL,
	`beatmap_id` integer NOT NULL,
	`beatmapset_id` integer NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`version` text NOT NULL,
	`stars` real NOT NULL,
	`mods` text NOT NULL,
	`accuracy` real NOT NULL,
	`pp` real NOT NULL,
	`weight_percent` real,
	`rank` text NOT NULL,
	`played_at` integer NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`mode`, `position`)
);
--> statement-breakpoint
ALTER TABLE `plays` ADD `net_gain` real;