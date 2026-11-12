-- Replaying a map recorded a retry made of the score of the previous play.
DELETE FROM `play_samples` WHERE `play_id` IN (
  SELECT `id` FROM `plays`
  WHERE `result` = 'retried' AND `score` > 0
    AND `ended_at` - `started_at` < 1000 AND `map_time_ms` <= 0
);
--> statement-breakpoint
DELETE FROM `plays`
WHERE `result` = 'retried' AND `score` > 0
  AND `ended_at` - `started_at` < 1000 AND `map_time_ms` <= 0;
