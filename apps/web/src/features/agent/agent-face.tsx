import { useEffect, useId, useRef } from 'react'
import { cn } from '@rhyme/ui/lib/utils'
import type { AgentStatus } from './agent-status'

const expressions = {
  idle: { width: 1, height: 1, tilt: 0, asymmetry: 0, x: 0, y: 0 },
  connecting: {
    width: 0.92,
    height: 0.75,
    tilt: -5,
    asymmetry: 0.08,
    x: 0,
    y: 0,
  },
  thinking: {
    width: 0.94,
    height: 0.82,
    tilt: -7,
    asymmetry: 0.18,
    x: 4,
    y: -8,
  },
  editing: { width: 1.08, height: 0.72, tilt: 0, asymmetry: 0, x: 0, y: 2 },
  approval: {
    width: 0.94,
    height: 1.08,
    tilt: -9,
    asymmetry: -0.3,
    x: 0,
    y: -2,
  },
  done: { width: 1.12, height: 0.5, tilt: 0, asymmetry: 0, x: 0, y: -3 },
  error: { width: 1.08, height: 0.48, tilt: 7, asymmetry: 0.25, x: 0, y: 3 },
} satisfies Record<AgentStatus, FaceExpression>

interface FaceExpression {
  width: number
  height: number
  tilt: number
  asymmetry: number
  x: number
  y: number
}

const random = (min: number, max: number) => min + Math.random() * (max - min)
const ease = (current: number, target: number, dt: number, rate = 12) =>
  current + (target - current) * (1 - Math.exp(-rate * dt))

export function AgentFace({
  status = 'idle',
  className,
}: {
  status?: AgentStatus
  className?: string
}) {
  const maskId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const leftRef = useRef<SVGRectElement>(null)
  const rightRef = useRef<SVGRectElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const smileRef = useRef<SVGGElement>(null)
  const headRef = useRef<SVGGElement>(null)
  const transitionRef = useRef<(next: AgentStatus) => void>(() => {})

  useEffect(() => {
    const svg = svgRef.current
    const left = leftRef.current
    const right = rightRef.current
    const eyes = eyesRef.current
    const smile = smileRef.current
    const head = headRef.current
    if (!svg || !left || !right || !eyes || !smile || !head) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let state: AgentStatus = 'idle'
    let target: FaceExpression = { ...expressions.idle }
    const current = { ...target, blink: 1, pop: 1, happy: 0 }
    let pop = 1
    let frameId = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let last = 0
    let inView = true
    let pointer: { x: number; y: number; at: number } | undefined
    let blinkAt = performance.now() + random(2600, 5000)
    let blinkUntil = 0
    let gazeAt = performance.now() + random(1800, 3200)
    let disposed = false

    const draw = (breath = 1) => {
      for (const [eye, x, bias] of [
        [left, 99, 0],
        [right, 157, current.asymmetry],
      ] as const) {
        const width = 31 * current.width * current.pop * (1 + bias * 0.3)
        const height = Math.max(
          54 * current.height * current.blink * (1 + bias),
          4,
        )
        eye.setAttribute('x', (-width / 2).toFixed(2))
        eye.setAttribute('y', (-height / 2).toFixed(2))
        eye.setAttribute('width', width.toFixed(2))
        eye.setAttribute('height', height.toFixed(2))
        eye.setAttribute('rx', (Math.min(width, height) / 2).toFixed(2))
        eye.setAttribute('opacity', (1 - current.happy).toFixed(3))
        const angle = state === 'error' ? (x < 128 ? -18 : 18) : 0
        eye.setAttribute('transform', `translate(${x} 127) rotate(${angle})`)
      }
      smile.setAttribute('opacity', current.happy.toFixed(3))
      smile.setAttribute(
        'transform',
        `translate(0 127) scale(1 ${current.blink.toFixed(3)}) translate(0 -127)`,
      )
      eyes.setAttribute(
        'transform',
        `translate(${current.x.toFixed(2)} ${current.y.toFixed(2)}) rotate(${current.tilt.toFixed(2)} 128 128)`,
      )
      head.setAttribute(
        'transform',
        `translate(128 128) scale(${(breath * current.pop).toFixed(4)}) translate(-128 -128)`,
      )
    }

    const stop = () => {
      cancelAnimationFrame(frameId)
      frameId = 0
      clearTimeout(timer)
      timer = undefined
      last = 0
    }
    const visible = () => inView && !document.hidden && !disposed
    const start = () => {
      if (!visible() || motion.matches) return
      clearTimeout(timer)
      timer = undefined
      if (!frameId) frameId = requestAnimationFrame(frame)
    }
    const settle = () => {
      Object.assign(current, target, {
        blink: 1,
        pop: 1,
        happy: state === 'done' ? 1 : 0,
      })
      draw()
    }

    const frame = (now: number) => {
      frameId = 0
      if (!visible() || motion.matches) return
      const dt = Math.min(last ? (now - last) / 1000 : 1 / 60, 0.05)
      last = now
      const working =
        state === 'thinking' || state === 'editing' || state === 'connecting'
      if (now >= blinkAt) {
        blinkUntil = now + 100
        blinkAt = now + random(3200, 6500)
      }
      if (state === 'idle' || state === 'approval') {
        if (pointer && now - pointer.at < 2800) {
          const bounds = svg.getBoundingClientRect()
          target.x =
            Math.max(
              -1,
              Math.min(1, (pointer.x - bounds.left - bounds.width / 2) / 280),
            ) * 12
          target.y =
            Math.max(
              -1,
              Math.min(1, (pointer.y - bounds.top - bounds.height / 2) / 280),
            ) * 8
          gazeAt = pointer.at + 2800
        } else if (now >= gazeAt) {
          target.x = random(-6, 6)
          target.y = random(-3, 3)
          gazeAt = now + random(2400, 4200)
        }
      } else if (state === 'thinking') {
        target.x = 4 + Math.sin(now / 1000) * 4
        target.y = -8 + Math.cos(now / 1300) * 2
      } else if (state === 'editing') {
        target.x = Math.sin(now / 360) * 8
        target.y = 2 + Math.cos(now / 650) * 2
      } else if (state === 'connecting') {
        target.x = Math.sin(now / 750) * 6
      }
      const values = {
        ...target,
        blink: now < blinkUntil ? 0.08 : 1,
        pop,
        happy: state === 'done' ? 1 : 0,
      }
      let moving = false
      for (const key of Object.keys(values) as Array<keyof typeof current>) {
        current[key] = ease(
          current[key],
          values[key],
          dt,
          key === 'blink' ? 30 : 12,
        )
        if (Math.abs(current[key] - values[key]) > 0.002) moving = true
      }
      pop = ease(pop, 1, dt, 8)
      draw(working ? 1 + Math.sin(now / 1300) * 0.006 : 1)
      if (working || moving || now < blinkUntil) start()
      else {
        last = 0
        const canWander = state === 'idle' || state === 'approval'
        timer = setTimeout(
          start,
          Math.max(80, Math.min(blinkAt, canWander ? gazeAt : Infinity) - now),
        )
      }
    }

    transitionRef.current = (next) => {
      state = next
      target = { ...expressions[next] }
      pointer = undefined
      gazeAt = performance.now() + 2800
      if (motion.matches) settle()
      else {
        if (next === 'done') pop = 1.08
        start()
      }
    }
    const onPointer = (event: PointerEvent) => {
      if (
        !visible() ||
        motion.matches ||
        (state !== 'idle' && state !== 'approval')
      )
        return
      pointer = { x: event.clientX, y: event.clientY, at: performance.now() }
      start()
    }
    const resume = () => {
      stop()
      if (motion.matches) settle()
      else if (visible()) {
        blinkAt = performance.now() + random(2600, 5000)
        gazeAt = performance.now() + random(1800, 3200)
        start()
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? false
      resume()
    })
    observer.observe(svg)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.addEventListener('visibilitychange', resume)
    motion.addEventListener('change', resume)
    resume()
    return () => {
      disposed = true
      stop()
      observer.disconnect()
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', resume)
      motion.removeEventListener('change', resume)
      transitionRef.current = () => {}
    }
  }, [])

  useEffect(() => transitionRef.current(status), [status])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 256 256"
      fill="currentColor"
      className={cn('text-primary size-8 shrink-0', className)}
      aria-hidden="true"
      data-agent-face={status}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="256"
          height="256"
        >
          <rect width="256" height="256" fill="white" />
          <g ref={eyesRef} fill="black">
            <rect
              ref={leftRef}
              x="-15.5"
              y="-27"
              width="31"
              height="54"
              rx="15.5"
              transform="translate(99 127)"
            />
            <rect
              ref={rightRef}
              x="-15.5"
              y="-27"
              width="31"
              height="54"
              rx="15.5"
              transform="translate(157 127)"
            />
            <g
              ref={smileRef}
              opacity="0"
              fill="none"
              stroke="black"
              strokeWidth="12"
              strokeLinecap="round"
            >
              <path d="M85 131Q99 111 113 131" />
              <path d="M143 131Q157 111 171 131" />
            </g>
          </g>
        </mask>
      </defs>
      <g ref={headRef}>
        <circle cx="128" cy="128" r="116" mask={`url(#${maskId})`} />
      </g>
    </svg>
  )
}
