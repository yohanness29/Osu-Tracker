/** Colors of the app given to the bracket: read from main.css, for the current theme. */
export type BracketColors = {
  text: string
  textSoft: string
  textFaint: string
  box: string
  boxSoft: string
  line: string
  accent: string
  onAccent: string
}

function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]!)
}

function styleOf(colors: BracketColors): string {
  const { text, textSoft, textFaint, box, boxSoft, line, accent, onAccent } = colors
  return `<style type="text/css">
svg { font-family: Inter, 'Segoe UI', 'Noto Sans', sans-serif; overflow: visible; }
rect { shape-rendering: crispEdges; }
/* The letters of the Challonge logo, black on any background. */
svg svg path[fill='black'] { fill: ${text}; }
.title { fill: ${text}; font-size: 24px; font-weight: bold; }
.bracket-line { fill: none; stroke: ${line}; stroke-width: 2px; }
.match--base-background, .match--player-background { fill: ${box}; }
.match--wrapper-background { fill-opacity: 0; }
.match--identifier { fill: ${textFaint}; font-size: 10px; }
.match--seed { fill: ${textSoft}; font-size: 10px; }
.match--seed-background, .match--player-score-background { fill: ${boxSoft}; }
.match--player-score-background.-winner { fill: ${accent}; }
.match--player-name { fill: ${textSoft}; font-size: 12px; }
.match--player-name.-winner { fill: ${text}; font-weight: 600; }
.match--player-name.-placeholder { font-style: italic; font-size: 11px; fill: ${textFaint}; }
.match--player-name.-me { fill: ${accent}; font-weight: bold; }
.match--player-score { fill: ${text}; font-size: 12px; font-weight: 600; }
.match--player-divider { stroke: ${line}; stroke-width: 1px; }
.match--station-background { fill: ${boxSoft}; opacity: 0.5; }
.match--station { font-size: 11px; fill: ${textSoft}; }
.round-label rect { fill: ${boxSoft}; }
.round-label text { fill: ${textSoft}; font-size: 12px; }
text.round-label--best-of, .round-header-label text.round-header-label--best-of { fill: ${accent}; font-weight: bold; }
.round-header-label text { fill: ${text}; font-size: 16px; font-weight: bold; }
.match--player-score.-winner { fill: ${onAccent}; }
</style>`
}

/**
 * The bracket drawn by Challonge, with the colors of the app, the player's name set apart and
 * its scripts removed. Ready for an image: an image runs no script anyway.
 */
export function themedBracket(svg: string, colors: BracketColors, me: string | null): string {
  let themed = svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/i, styleOf(colors))
  if (me) {
    const name = escapeText(me)
    themed = themed.replace(
      /(<text[^>]*class="match--player-name[^"]*)("[^>]*>)([^<]*)(<\/text>)/g,
      (whole, start: string, end: string, text: string, close: string) =>
        text.trim() === name ? `${start} -me${end}${text}${close}` : whole
    )
  }
  return themed
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
