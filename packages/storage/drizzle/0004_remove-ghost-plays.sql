-- Retries used to record a play with no note played when the game restarted a map.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `id` FROM `plays`
  WHERE `result` IN ('failed', 'retried')
    AND `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `result` IN ('failed', 'retried')
  AND `score` = 0 AND `n300` = 0 AND `n100` = 0 AND `n50` = 0 AND `misses` = 0;
