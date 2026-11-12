CREATE TABLE `playlist_maps` (
	`playlist_id` text NOT NULL,
	`beatmap_checksum` text NOT NULL,
	`mode` text NOT NULL,
	`beatmap_id` integer NOT NULL,
	`beatmapset_id` integer NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`version` text NOT NULL,
	`mapper` text NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`playlist_id`, `beatmap_checksum`),
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
