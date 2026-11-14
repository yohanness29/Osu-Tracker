CREATE TABLE `match_scores` (
	`match_id` text NOT NULL,
	`game_id` integer NOT NULL,
	`position` integer NOT NULL,
	`beatmap_id` integer NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`played_at` integer NOT NULL,
	`user_id` integer NOT NULL,
	`username` text NOT NULL,
	`mods` text NOT NULL,
	`score` integer NOT NULL,
	`accuracy` real NOT NULL,
	`max_combo` integer NOT NULL,
	`n300` integer NOT NULL,
	`n100` integer NOT NULL,
	`misses` integer NOT NULL,
	`passed` integer NOT NULL,
	PRIMARY KEY(`match_id`, `game_id`, `user_id`),
	FOREIGN KEY (`match_id`) REFERENCES `tournament_matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `pool_maps` (
	`pool_id` text NOT NULL,
	`slot` text NOT NULL,
	`position` integer NOT NULL,
	`mods` text NOT NULL,
	`free_mod` integer NOT NULL,
	`beatmap_id` integer NOT NULL,
	`beatmapset_id` integer NOT NULL,
	`checksum` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`version` text NOT NULL,
	`mapper` text NOT NULL,
	`stars` real NOT NULL,
	`ar` real NOT NULL,
	`od` real NOT NULL,
	`cs` real NOT NULL,
	`hp` real NOT NULL,
	`bpm` real NOT NULL,
	`length_seconds` real NOT NULL,
	`style` text,
	`tags` text NOT NULL,
	PRIMARY KEY(`pool_id`, `slot`),
	FOREIGN KEY (`pool_id`) REFERENCES `tournament_pools`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`osu_match_id` integer NOT NULL,
	`name` text NOT NULL,
	`started_at` integer NOT NULL,
	`imported_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournament_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`mode` text NOT NULL,
	`best_of` integer,
	`bans` integer,
	`next_match_at` integer,
	`next_pool_id` text,
	`next_opponent_id` integer,
	`created_at` integer NOT NULL
);
