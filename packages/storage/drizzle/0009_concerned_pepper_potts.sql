CREATE TABLE `catalog_analysis` (
	`beatmap_id` integer NOT NULL,
	`mods` text NOT NULL,
	`stars` real NOT NULL,
	`pp_by_accuracy` text NOT NULL,
	PRIMARY KEY(`beatmap_id`, `mods`),
	FOREIGN KEY (`beatmap_id`) REFERENCES `catalog_maps`(`beatmap_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `catalog_maps` (
	`beatmap_id` integer PRIMARY KEY NOT NULL,
	`beatmapset_id` integer NOT NULL,
	`checksum` text NOT NULL,
	`mode` text NOT NULL,
	`title` text NOT NULL,
	`artist` text NOT NULL,
	`mapper` text NOT NULL,
	`version` text NOT NULL,
	`stars` real NOT NULL,
	`ar` real NOT NULL,
	`bpm` real NOT NULL,
	`length_seconds` integer NOT NULL,
	`play_count` integer NOT NULL,
	`style` text
);
