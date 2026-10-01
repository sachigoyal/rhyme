import { createRoot } from 'react-dom/client'
import { Tldraw } from 'tldraw'
import { runCanvasTool } from '../../src/features/agent/canvas-actions'
import { createCanvasToolRunner } from '../../src/features/agent/canvas-tool-runner'
import { buildCanvasContext } from '../../src/features/agent/canvas-context'
import 'tldraw/tldraw.css'

createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0 }}>
    <Tldraw
      onMount={(editor) => {
        const runner = createCanvasToolRunner(editor)
        Object.assign(window, {
          canvasFixture: {
            editor,
            runner,
            run: (name: string, input: unknown) =>
              runCanvasTool(editor, name, input),
            context: () => buildCanvasContext(editor, true),
          },
        })
      }}
    />
  </div>,
)
