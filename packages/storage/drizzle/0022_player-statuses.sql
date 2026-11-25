CREATE TABLE `player_statuses` (
	`tournament_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`eliminated` integer NOT NULL,
	PRIMARY KEY(`tournament_id`, `user_id`),
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);
