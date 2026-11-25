import { useEffect, useRef } from 'react'
import { BarChart, LineChart as EChartsLine } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import { format, init, use as registerCharts } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { themeColor, useTheme } from './theme'

registerCharts([
  BarChart,
  EChartsLine,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer
])

// Canvas charts cannot use the CSS tokens of main.css: their values are read for each theme.
function chartColors(): Record<
  'accent' | 'accentMuted' | 'panel' | 'line' | 'ink' | 'inkSoft',
  string
> {
  return {
    accent: themeColor('accent'),
    accentMuted: themeColor('accent-muted'),
    panel: themeColor('panel-raised'),
    line: themeColor('line'),
    ink: themeColor('ink'),
    inkSoft: themeColor('ink-soft')
  }
}

export type ChartPoint = {
  label: string
  value: number
  title: string
  details?: string[]
  /** Too little data to trust this point. */
  muted?: boolean
}

export function LineChart(props: {
  points: ChartPoint[]
  unit: string
  decimals: number
  height?: number
  /** Fixed scale, for values such as percentages. */
  range?: [number, number]
  /** Reference line, such as an average. */
  reference?: number | null
  /** For categories without order, where a line would suggest a trend. */
  bars?: boolean
}): React.JSX.Element {
  const { points, unit, decimals, height = 130, range, reference = null, bars = false } = props
  const container = useRef<HTMLDivElement>(null)
  const theme = useTheme((state) => state.theme)

  useEffect(() => {
    if (!container.current) return

    const COLORS = chartColors()
    const chart = init(container.current, undefined, { renderer: 'canvas' })
    chart.setOption({
      animation: false,
      grid: { left: 40, right: 12, top: 10, bottom: 22 },
      tooltip: {
        trigger: 'axis',
        // Attached to the page: the small chart area would cut it.
        appendTo: 'body',
        backgroundColor: COLORS.panel,
        borderColor: COLORS.line,
        textStyle: { color: COLORS.ink, fontSize: 12 },
        formatter: (items: { dataIndex: number }[]) => {
          const point = points[items[0]!.dataIndex]!
          const lines = [
            format.encodeHTML(point.title),
            `<b>${point.value.toFixed(decimals)}${unit}</b>`
          ]
          for (const detail of point.details ?? []) lines.push(format.encodeHTML(detail))
          return lines.join('<br/>')
        }
      },
      xAxis: {
        type: 'category',
        data: points.map(({ label }) => label),
        axisLine: { lineStyle: { color: COLORS.line } },
        axisTick: { show: false },
        axisLabel: { color: COLORS.inkSoft, fontSize: 10, interval: 0 }
      },
      yAxis: {
        type: 'value',
        scale: !range,
        min: range?.[0],
        max: range?.[1],
        ...(range ? { interval: (range[1] - range[0]) / 4 } : { splitNumber: 3 }),
        splitLine: { lineStyle: { color: COLORS.line } },
        axisLabel: { color: COLORS.inkSoft, fontSize: 10, formatter: `{value}${unit}` }
      },
      series: [
        {
          type: bars ? 'bar' : 'line',
          data: points.map(({ value, muted }) => ({
            value,
            itemStyle: {
              color: muted ? COLORS.accentMuted : COLORS.accent,
              borderRadius: bars ? [4, 4, 0, 0] : undefined
            }
          })),
          color: COLORS.accent,
          ...(bars
            ? { barMaxWidth: 28 }
            : {
                smooth: 0.3,
                smoothMonotone: 'x',
                lineStyle: { width: 2 },
                symbol: 'circle',
                symbolSize: 8
              }),
          markLine:
            reference === null
              ? undefined
              : {
                  silent: true,
                  symbol: 'none',
                  label: { show: false },
                  lineStyle: { color: COLORS.inkSoft, type: 'dashed', width: 1 },
                  data: [{ yAxis: reference }]
                }
        }
      ]
    })

    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      chart.dispose()
    }
  }, [points, unit, decimals, range, reference, bars, theme])

  return <div ref={container} style={{ height }} className="w-full" />
}
