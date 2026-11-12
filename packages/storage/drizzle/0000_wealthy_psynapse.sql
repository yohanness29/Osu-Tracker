CREATE TABLE `beatmaps` (
	`checksum` text PRIMARY KEY NOT NULL,
	`beatmap_id` integer NOT NULL,
	`beatmapset_id` integer NOT NULL,
	`artist` text NOT NULL,
	`title` text NOT NULL,
	`version` text NOT NULL,
	`mapper` text NOT NULL,
	`status` text NOT NULL,
	`length_ms` integer NOT NULL,
	`max_combo` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `play_samples` (
	`play_id` text NOT NULL,
	`position` integer NOT NULL,
	`map_time_ms` integer NOT NULL,
	`pp` real NOT NULL,
	`accuracy` real NOT NULL,
	`combo` integer NOT NULL,
	PRIMARY KEY(`play_id`, `position`),
	FOREIGN KEY (`play_id`) REFERENCES `plays`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plays` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`beatmap_checksum` text NOT NULL,
	`mode` text NOT NULL,
	`mods` text NOT NULL,
	`rate` real NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer NOT NULL,
	`map_time_ms` integer NOT NULL,
	`result` text NOT NULL,
	`partial` integer NOT NULL,
	`score` integer NOT NULL,
	`accuracy` real NOT NULL,
	`max_combo` integer NOT NULL,
	`n300` integer NOT NULL,
	`n100` integer NOT NULL,
	`n50` integer NOT NULL,
	`misses` integer NOT NULL,
	`geki` integer NOT NULL,
	`katu` integer NOT NULL,
	`slider_breaks` integer NOT NULL,
	`unstable_rate` real NOT NULL,
	`rank` text NOT NULL,
	`pp` real NOT NULL,
	`pp_fc` real NOT NULL,
	`online_score_id` integer,
	`stars` real NOT NULL,
	`ar` real NOT NULL,
	`cs` real NOT NULL,
	`od` real NOT NULL,
	`hp` real NOT NULL,
	`bpm` real NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`beatmap_checksum`) REFERENCES `beatmaps`(`checksum`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`start_pp` real NOT NULL,
	`end_pp` real
);
