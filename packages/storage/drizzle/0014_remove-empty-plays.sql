-- Plays left before any note, such as leaving a map at its start, were kept as quits.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `id` FROM `plays`
  WHERE `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0;
--> statement-breakpoint
-- A play seen again after the app restarted in its middle was kept twice.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `later`.`id` FROM `plays` AS `later`
  WHERE `later`.`partial` = 1 AND `later`.`score` > 0 AND EXISTS (
    SELECT 1 FROM `plays` AS `earlier`
    WHERE `earlier`.`session_id` = `later`.`session_id`
      AND `earlier`.`beatmap_checksum` = `later`.`beatmap_checksum`
      AND `earlier`.`score` = `later`.`score`
      AND `earlier`.`max_combo` = `later`.`max_combo`
      AND `earlier`.`started_at` < `later`.`started_at`
  )
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `partial` = 1 AND `score` > 0 AND EXISTS (
  SELECT 1 FROM `plays` AS `earlier`
  WHERE `earlier`.`session_id` = `plays`.`session_id`
    AND `earlier`.`beatmap_checksum` = `plays`.`beatmap_checksum`
    AND `earlier`.`score` = `plays`.`score`
    AND `earlier`.`max_combo` = `plays`.`max_combo`
    AND `earlier`.`started_at` < `plays`.`started_at`
);
