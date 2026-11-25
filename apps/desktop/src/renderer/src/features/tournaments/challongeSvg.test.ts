import { describe, expect, it } from 'vitest'
import { themedBracket, type BracketColors } from './challongeSvg'

const colors: BracketColors = {
  text: '#111',
  textSoft: '#222',
  textFaint: '#333',
  box: '#444',
  boxSoft: '#555',
  line: '#666',
  accent: '#f6a',
  onAccent: '#000'
}

const svg = `<svg><defs><style type="text/css">.title { fill: #444; }</style></defs>
<script>alert(1)</script>
<text x="5" class="match--player-name  -winner">yohanness</text>
<text x="5" class="match--player-name ">--Dragon--</text></svg>`

describe('themedBracket', () => {
  it('replaces the colors of Challonge with those given', () => {
    const themed = themedBracket(svg, colors, null)
    expect(themed).not.toContain('.title { fill: #444; }')
    expect(themed).toContain('.title { fill: #111;')
  })

  it('removes the scripts', () => {
    expect(themedBracket(svg, colors, null)).not.toContain('<script')
  })

  it('sets the player apart, and only them', () => {
    const themed = themedBracket(svg, colors, 'yohanness')
    expect(themed).toContain('class="match--player-name  -winner -me">yohanness')
    expect(themed).toContain('class="match--player-name ">--Dragon--')
  })
})
