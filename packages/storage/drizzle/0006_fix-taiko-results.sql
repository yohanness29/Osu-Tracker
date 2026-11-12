-- Plays without any note that were recorded between two fixes of the tracker.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `id` FROM `plays`
  WHERE `result` IN ('failed', 'retried')
    AND `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `result` IN ('failed', 'retried')
  AND `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0;
--> statement-breakpoint
-- Health starts at 0 in taiko, so plays left early were recorded as failed.
UPDATE `plays` SET `result` = 'quit'
WHERE `mode` = 'taiko' AND `result` = 'failed'
  AND `map_time_ms` < (
    SELECT `length_ms` FROM `beatmaps` WHERE `checksum` = `plays`.`beatmap_checksum`
  );
