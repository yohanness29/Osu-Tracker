const STREAM_MAX_GAP_MS = 120;
const STREAM_MIN_NOTES = 5;
const STREAM_MAP_SHARE = 0.25;
const LONG_NOTE_TYPE_BIT = 128;
const LONG_NOTE_MAP_SHARE = 0.3;
// Aim is rated higher than speed on most maps, so a plain comparison would call them all aim.
const AIM_MAP_RATIO = 1.35;
const SPEED_MAP_RATIO = 1.1;

const CIRCLE_TYPE_BIT = 1;
const SPINNER_TYPE_BIT = 8;

export type StyleAttributes = {
  aim: number;
  speed: number;
  stamina: number;
  rhythm: number;
  color: number;
};

export type MapStyle = {
  /** The main skill of the map. */
  style: string | null;
  /** What else stands out in its patterns, osu! only. Read without mods. */
  tags: string[];
};

type HitObject = {
  x: number;
  y: number;
  time: number;
  type: number;
  endTime: number;
};

type TimingPoint = { time: number; beatLength: number; uninherited: boolean };

function section(content: string, name: string): string[] {
  const start = content.indexOf(`[${name}]`);
  if (start === -1) return [];

  const lines = content.slice(start + name.length + 2).split(/\r?\n/);
  const end = lines.findIndex((line) => line.startsWith("["));
  return (end === -1 ? lines : lines.slice(0, end)).filter(
    (line) => line.trim() !== "",
  );
}

function parseHitObjects(content: string): HitObject[] {
  return section(content, "HitObjects").flatMap((line) => {
    const [x, y, time, type, , extra] = line.split(",");
    if (time === undefined || type === undefined) return [];

    const flags = Number(type);
    const endTime = flags & SPINNER_TYPE_BIT ? Number(extra) : Number(time);
    return [
      { x: Number(x), y: Number(y), time: Number(time), type: flags, endTime },
    ];
  });
}

function parseTimingPoints(content: string): TimingPoint[] {
  return section(content, "TimingPoints")
    .map((line) => {
      const [time, beatLength, , , , , uninherited] = line.split(",");
      const length = Number(beatLength);
      // Old maps leave out the last field: only inherited points have a negative length.
      return {
        time: Number(time),
        beatLength: length,
        uninherited:
          uninherited === undefined ? length > 0 : uninherited === "1",
      };
    })
    .filter(
      ({ time, beatLength }) =>
        Number.isFinite(time) && Number.isFinite(beatLength),
    )
    .toSorted((a, b) => a.time - b.time);
}

function circleSize(content: string): number {
  const line = section(content, "Difficulty").find((entry) =>
    entry.startsWith("CircleSize"),
  );
  const value = Number(line?.split(":")[1]);
  return Number.isFinite(value) ? value : 5;
}

function longNoteShare(objects: HitObject[]): number {
  if (objects.length === 0) return 0;
  return (
    objects.filter(({ type }) => type & LONG_NOTE_TYPE_BIT).length /
    objects.length
  );
}

function distance(a: HitObject, b: HitObject): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Lengths of the runs of notes that follow each other fast enough to be tapped as a stream. */
function runs(notes: HitObject[]): { start: number; length: number }[] {
  const found: { start: number; length: number }[] = [];
  let start = 0;
  for (let index = 1; index <= notes.length; index += 1) {
    const gap = (notes[index]?.time ?? Infinity) - notes[index - 1]!.time;
    if (gap <= STREAM_MAX_GAP_MS) continue;
    found.push({ start, length: index - start });
    start = index;
  }
  return found;
}

function beatLengthAt(points: TimingPoint[], time: number): number | null {
  let beatLength: number | null = null;
  for (const point of points) {
    if (point.time > time + 1) break;
    if (point.uninherited && point.beatLength > 0)
      beatLength = point.beatLength;
  }
  return (
    beatLength ??
    points.find(({ uninherited }) => uninherited)?.beatLength ??
    null
  );
}

/** Real changes of slider speed: many maps add timing points only to change the volume. */
function sliderSpeedChanges(points: TimingPoint[]): number {
  // Points sharing a time are one change: a new tempo line resets the speed just before.
  const speeds = [...Map.groupBy(points, ({ time }) => time).values()].map(
    (group) =>
      group.reduce((speed, point) => {
        if (point.uninherited) return 1;
        const next = -100 / point.beatLength;
        return Number.isFinite(next) && next > 0 ? next : speed;
      }, Number.NaN),
  );

  let changes = 0;
  let speed = 1;
  for (const next of speeds) {
    if (Number.isNaN(next)) continue;
    if (Math.abs(next - speed) / speed >= SV_CHANGE_RATIO) changes += 1;
    speed = next;
  }
  return changes;
}

const BEAT_DIVISIONS = 24;
const SNAP_TOLERANCE = 0.25;
const RHYTHM_MAX_BEATS = 2;

/** Gaps on a 1/3 or 1/6 grid but not on the 1/2, 1/4 or 1/8 one. */
function isTripletGap(gap: number, beatLength: number): boolean {
  const ticks = (gap / beatLength) * BEAT_DIVISIONS;
  const snapped = Math.round(ticks);
  return (
    Math.abs(ticks - snapped) <= SNAP_TOLERANCE &&
    snapped > 0 &&
    snapped % 3 !== 0
  );
}

export type MapMeasures = {
  notes: number;
  /** Share of the notes in runs of 5 or more, and in shorter bursts of 3 or 4. */
  streamShare: number;
  burstShare: number;
  longestRun: number;
  /** Median distance between notes of streams, in circle diameters. */
  streamSpacing: number | null;
  /** Among jumps between circles: share crossing a large part of the screen. */
  bigJumpShare: number;
  /** Share of the rhythm on a 1/3 or 1/6 grid. */
  tripletShare: number;
  sliderSpeedChanges: number;
  /** Notes placed on the previous one. */
  stackShare: number;
  /** Among jumps between circles: share touching the previous circle. */
  overlapShare: number;
  spinnerShare: number;
};

const BIG_JUMP_PX = 280;
const STACK_MAX_PX = 3;
const JUMP_MAX_GAP_MS = 600;
const SV_CHANGE_RATIO = 0.15;

export function measureMap(content: string): MapMeasures {
  const objects = parseHitObjects(content);
  const notes = objects.filter(({ type }) => !(type & SPINNER_TYPE_BIT));
  const points = parseTimingPoints(content);
  const diameter = 2 * (54.4 - 4.48 * circleSize(content));

  const allRuns = runs(notes);
  const streams = allRuns.filter(({ length }) => length >= STREAM_MIN_NOTES);
  const share = (count: number, total: number): number =>
    total > 0 ? count / total : 0;
  const sum = (values: number[]): number =>
    values.reduce((total, value) => total + value, 0);

  const streamSpacing = median(
    streams.flatMap(({ start, length }) =>
      notes
        .slice(start + 1, start + length)
        .map((note, index) => distance(notes[start + index]!, note)),
    ),
  );

  const pairs = notes
    .slice(1)
    .map((note, index) => ({ previous: notes[index]!, note }));
  const jumps = pairs.filter(({ previous, note }) => {
    const gap = note.time - previous.time;
    const circles = previous.type & note.type & CIRCLE_TYPE_BIT;
    return circles && gap > STREAM_MAX_GAP_MS && gap <= JUMP_MAX_GAP_MS;
  });

  const rhythmGaps = pairs.flatMap(({ previous, note }) => {
    const beatLength = beatLengthAt(points, note.time);
    const gap = note.time - previous.time;
    return beatLength && gap <= RHYTHM_MAX_BEATS * beatLength
      ? [{ gap, beatLength }]
      : [];
  });

  const spinners = objects.filter(({ type }) => type & SPINNER_TYPE_BIT);
  const duration = (objects.at(-1)?.endTime ?? 0) - (objects[0]?.time ?? 0);

  return {
    notes: notes.length,
    streamShare: share(sum(streams.map(({ length }) => length)), notes.length),
    burstShare: share(
      sum(
        allRuns
          .filter(({ length }) => length >= 3 && length < 5)
          .map(({ length }) => length),
      ),
      notes.length,
    ),
    longestRun: Math.max(0, ...allRuns.map(({ length }) => length)),
    streamSpacing:
      streamSpacing === null || diameter <= 0 ? null : streamSpacing / diameter,
    bigJumpShare: share(
      jumps.filter(
        ({ previous, note }) => distance(previous, note) >= BIG_JUMP_PX,
      ).length,
      jumps.length,
    ),
    tripletShare: share(
      rhythmGaps.filter(({ gap, beatLength }) => isTripletGap(gap, beatLength))
        .length,
      rhythmGaps.length,
    ),
    sliderSpeedChanges: sliderSpeedChanges(points),
    stackShare: share(
      pairs.filter(
        ({ previous, note }) => distance(previous, note) < STACK_MAX_PX,
      ).length,
      pairs.length,
    ),
    overlapShare: share(
      jumps.filter(({ previous, note }) => {
        const gap = distance(previous, note);
        return gap >= STACK_MAX_PX && gap < diameter;
      }).length,
      jumps.length,
    ),
    spinnerShare: share(
      sum(spinners.map(({ time, endTime }) => endTime - time)),
      duration,
    ),
  };
}

function mainOsuStyle(
  measures: MapMeasures,
  { aim, speed }: StyleAttributes,
): string {
  if (measures.streamShare >= STREAM_MAP_SHARE) return "Stream";
  if (speed > 0 && aim / speed >= AIM_MAP_RATIO) return "Aim";
  if (speed > 0 && aim / speed <= SPEED_MAP_RATIO) return "Speed";
  return "Équilibré";
}

/** An estimate from the map file and its difficulty. No style when a mode has no known method. */
export function classifyMapStyle(
  content: string,
  mode: string,
  attributes: StyleAttributes,
): MapStyle {
  const { stamina, rhythm, color } = attributes;

  switch (mode) {
    case "osu": {
      const measures = measureMap(content);
      return {
        style: mainOsuStyle(measures, attributes),
        tags: osuTags(measures),
      };
    }
    case "taiko": {
      if (stamina >= rhythm && stamina >= color)
        return { style: "Stamina", tags: [] };
      return { style: rhythm >= color ? "Rythme" : "Couleur", tags: [] };
    }
    case "mania": {
      const longNotes =
        longNoteShare(parseHitObjects(content)) >= LONG_NOTE_MAP_SHARE;
      return { style: longNotes ? "Long notes" : "Rice", tags: [] };
    }
    default:
      return { style: null, tags: [] };
  }
}

const DEATHSTREAM_MIN_NOTES = 64;
const BURST_MAP_SHARE = 0.18;
const SPACED_STREAM_DIAMETERS = 0.9;
const SPACED_STREAM_MIN_SHARE = 0.1;
const BIG_JUMP_MAP_SHARE = 0.25;
const TRIPLET_MAP_SHARE = 0.1;
// Kiai sections often speed sliders up for a while: only frequent changes stand out.
const SV_CHANGES_PER_NOTE = 0.1;
const STACK_MAP_SHARE = 0.18;
const OVERLAP_MAP_SHARE = 0.2;
const SPINNER_MAP_SHARE = 0.1;

/** Order of importance: the first ones say the most about the map. */
function osuTags(measures: MapMeasures): string[] {
  const spacedStreams =
    measures.streamShare >= SPACED_STREAM_MIN_SHARE &&
    (measures.streamSpacing ?? 0) >= SPACED_STREAM_DIAMETERS;

  const rules: [string, boolean][] = [
    ["Deathstream", measures.longestRun >= DEATHSTREAM_MIN_NOTES],
    ["Streams espacés", spacedStreams],
    ["Bursts", measures.burstShare >= BURST_MAP_SHARE],
    ["Gros jumps", measures.bigJumpShare >= BIG_JUMP_MAP_SHARE],
    ["Rythme 1/3 – 1/6", measures.tripletShare >= TRIPLET_MAP_SHARE],
    [
      "Changements de SV",
      measures.sliderSpeedChanges >= SV_CHANGES_PER_NOTE * measures.notes,
    ],
    ["Stacks", measures.stackShare >= STACK_MAP_SHARE],
    ["Overlaps", measures.overlapShare >= OVERLAP_MAP_SHARE],
    ["Spinners", measures.spinnerShare >= SPINNER_MAP_SHARE],
  ];
  return rules.flatMap(([tag, applies]) => (applies ? [tag] : []));
}
