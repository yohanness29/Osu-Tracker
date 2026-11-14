-- A score seen a second time, such as its replay, was kept as a new play.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `later`.`id` FROM `plays` AS `later`
  WHERE `later`.`score` > 0 AND EXISTS (
    SELECT 1 FROM `plays` AS `earlier`
    WHERE `earlier`.`session_id` = `later`.`session_id`
      AND `earlier`.`beatmap_checksum` = `later`.`beatmap_checksum`
      AND `earlier`.`score` = `later`.`score`
      AND `earlier`.`max_combo` = `later`.`max_combo`
      AND `earlier`.`accuracy` = `later`.`accuracy`
      AND `earlier`.`misses` = `later`.`misses`
      AND `earlier`.`started_at` < `later`.`started_at`
  )
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `score` > 0 AND EXISTS (
  SELECT 1 FROM `plays` AS `earlier`
  WHERE `earlier`.`session_id` = `plays`.`session_id`
    AND `earlier`.`beatmap_checksum` = `plays`.`beatmap_checksum`
    AND `earlier`.`score` = `plays`.`score`
    AND `earlier`.`max_combo` = `plays`.`max_combo`
    AND `earlier`.`accuracy` = `plays`.`accuracy`
    AND `earlier`.`misses` = `plays`.`misses`
    AND `earlier`.`started_at` < `plays`.`started_at`
);
--> statement-breakpoint
-- Multiplayer games played to their end were kept as quits.
UPDATE `plays` SET `result` = 'passed'
WHERE `result` = 'quit' AND `partial` = 0 AND `mods` LIKE '%NF%'
  AND `map_time_ms` >= (
    SELECT `length_ms` - 1000 FROM `beatmaps` WHERE `beatmaps`.`checksum` = `plays`.`beatmap_checksum`
  );
