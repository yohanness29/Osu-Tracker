ALTER TABLE `tournament_pools` ADD `best_of` integer;--> statement-breakpoint
ALTER TABLE `tournament_pools` ADD `bans` integer;--> statement-breakpoint
UPDATE `tournament_pools` SET `best_of` = (SELECT `best_of` FROM `tournaments` WHERE `tournaments`.`id` = `tournament_pools`.`tournament_id`), `bans` = (SELECT `bans` FROM `tournaments` WHERE `tournaments`.`id` = `tournament_pools`.`tournament_id`) WHERE lower(`name`) NOT LIKE '%qualif%' AND lower(`name`) <> 'quals';
