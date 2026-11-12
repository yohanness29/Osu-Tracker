// Turns raw tosu captures (hundreds of MB) into small fixtures that can be committed.
// Usage: pnpm fixtures:reduce <capture.jsonl> <output.jsonl>
import { createReadStream, writeFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { parseTosuMessage, type GameFrame, type TrackerEvent } from '@osu-tracker/shared'
import { Tracker } from '@osu-tracker/tracker'

const KEEP_EVERY = 5
const KEEP_AROUND_CHANGE = 3

function changed(previous: GameFrame, frame: GameFrame): boolean {
  return (
    previous.state !== frame.state ||
    previous.beatmap.checksum !== frame.beatmap.checksum ||
    previous.play.failed !== frame.play.failed ||
    previous.play.playerName !== frame.play.playerName ||
    previous.results.scoreId !== frame.results.scoreId ||
    previous.results.score !== frame.results.score ||
    frame.play.score < previous.play.score ||
    frame.beatmap.liveTime < previous.beatmap.liveTime
  )
}

function summarize(frames: GameFrame[]): string[] {
  const tracker = new Tracker({ createId: () => 'id' })
  const events: TrackerEvent[] = frames.flatMap((frame) => tracker.feed(frame))
  return events.flatMap((event) =>
    event.type === 'play-finished'
      ? [`${event.play.result} ${event.play.partial} ${event.play.beatmap.title}`]
      : []
  )
}

const [input, output] = process.argv.slice(2)
if (!input || !output) throw new Error('Usage: reduce-capture <capture.jsonl> <output.jsonl>')

const frames: GameFrame[] = []
let rejected = 0
for await (const line of createInterface({ input: createReadStream(input) })) {
  // Files captured from a running app can end with a partial line.
  let entry: { receivedAt: number; message: string }
  try {
    entry = JSON.parse(line)
  } catch {
    rejected += 1
    continue
  }
  const frame = parseTosuMessage(entry.message, entry.receivedAt)
  if (frame) frames.push(frame)
  else rejected += 1
}

const keep = frames.map((_, index) => index % KEEP_EVERY === 0)
frames.forEach((frame, index) => {
  const previous = frames[index - 1]
  if (!previous || !changed(previous, frame)) return
  const last = Math.min(frames.length - 1, index + KEEP_AROUND_CHANGE)
  for (let i = Math.max(0, index - KEEP_AROUND_CHANGE); i <= last; i += 1) keep[i] = true
})
const reduced = frames.filter((_, index) => keep[index])

const before = summarize(frames)
const after = summarize(reduced)
if (JSON.stringify(before) !== JSON.stringify(after)) {
  console.error({ before, after })
  throw new Error('The reduced fixture does not produce the same plays as the capture')
}

writeFileSync(output, reduced.map((frame) => JSON.stringify(frame)).join('\n') + '\n')
console.log({ frames: frames.length, reduced: reduced.length, rejected, plays: before })
