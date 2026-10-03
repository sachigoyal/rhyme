import { createRoot } from 'react-dom/client'
import { Tldraw } from 'tldraw'
import { runCanvasTool } from '../../src/features/agent/canvas-actions'
import { createCanvasToolRunner } from '../../src/features/agent/canvas-tool-runner'
import { buildCanvasContext } from '../../src/features/agent/canvas-context'
import { DocumentSync } from '../../src/features/editor/document-sync'
import 'tldraw/tldraw.css'

createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0 }}>
    <Tldraw
      onMount={(editor) => {
        const saves: unknown[] = []
        const sync = new DocumentSync({
          fileId: 'fixture',
          version: 0,
          dirty: false,
          save: async (input) => {
            saves.push(input)
            return { version: saves.length }
          },
          fetchVersion: async () => saves.length,
        })
        const detach = sync.attach(editor)
        const runner = createCanvasToolRunner(editor)
        Object.assign(window, {
          canvasFixture: {
            editor,
            runner,
            sync,
            saves,
            detach,
            run: (name: string, input: unknown) =>
              runCanvasTool(editor, name, input),
            context: () => buildCanvasContext(editor, true),
          },
        })
        return () => {
          runner.cancel()
          detach()
        }
      }}
    />
  </div>,
)
