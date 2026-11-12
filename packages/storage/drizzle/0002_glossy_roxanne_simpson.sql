CREATE TABLE `no_mod_max_pp` (
	`beatmap_checksum` text NOT NULL,
	`mode` text NOT NULL,
	`pp` real NOT NULL,
	PRIMARY KEY(`beatmap_checksum`, `mode`)
);
