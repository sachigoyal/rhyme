import { getToolName, isToolUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { canvasToolInputs } from 'api/canvas-schema'
import type { NewShape } from 'api/canvas-schema'
import type { Editor } from 'tldraw'
import { createShapes, updateShapes } from './canvas-actions'
import { createEditorPreview } from '../editor/editor-preview'
import { computeLayout, prepareDiagramNode } from './canvas-layout'

export function createCanvasStreamPreview(editor: Editor) {
  const preview = createEditorPreview(editor)
  const finished = new Set<string>()
  let fingerprint = ''
  let activeId: string | undefined
  const clear = () => {
    fingerprint = ''
    activeId = undefined
    preview.clear()
  }
  const draw = (shapes: NewShape[]) => {
    const nodes = shapes.filter((shape) => shape.type !== 'arrow')
    let aliases: Record<string, string> = {}
    try {
      if (nodes.length)
        aliases = createShapes(editor, { shapes: nodes }).aliases
    } catch {
      return
    }
    for (const arrow of shapes.filter((shape) => shape.type === 'arrow')) {
      try {
        createShapes(editor, {
          shapes: [
            {
              ...arrow,
              from:
                typeof arrow.from === 'string'
                  ? (aliases[arrow.from] ?? arrow.from)
                  : arrow.from,
              to:
                typeof arrow.to === 'string'
                  ? (aliases[arrow.to] ?? arrow.to)
                  : arrow.to,
            },
          ],
        })
      } catch {
        // Incomplete arrow endpoints wait for their nodes.
      }
    }
  }
  return {
    clear,
    cancel() {
      if (activeId) finished.add(activeId)
      clear()
    },
    finish(toolCallId: string) {
      finished.add(toolCallId)
      const visible = activeId === toolCallId
      if (visible) clear()
      return visible
    },
    update(messages: UIMessage[]) {
      const message = messages.at(-1)
      const part =
        message?.role === 'assistant'
          ? message.parts.findLast(
              (candidate) =>
                isToolUIPart(candidate) &&
                candidate.state === 'input-streaming' &&
                !finished.has(candidate.toolCallId),
            )
          : undefined
      if (!part || !isToolUIPart(part)) return clear()
      const name = getToolName(part)
      const input = part.input as Record<string, unknown> | undefined
      if (
        !input ||
        ![
          'create_shapes',
          'update_shapes',
          'create_diagram',
          'connect_shapes',
        ].includes(name)
      )
        return clear()
      const next = JSON.stringify([part.toolCallId, input])
      if (next === fingerprint) return
      fingerprint = next
      activeId = part.toolCallId
      if (name === 'create_diagram' && Array.isArray(input.nodes)) {
        const nodes = input.nodes.slice(0, 200).flatMap((node) => {
          const parsed = canvasToolInputs.create_diagram.safeParse({
            nodes: [node],
          })
          return parsed.success ? parsed.data.nodes : []
        })
        if (!nodes.length) return
        const parsed = canvasToolInputs.create_diagram.safeParse({
          nodes,
          edges: [],
          origin: input.origin,
        })
        if (!parsed.success) return
        const prepared = nodes.map((node) => prepareDiagramNode(editor, node))
        const edges = Array.isArray(input.edges)
          ? input.edges.slice(0, 400).flatMap((edge) => {
              const parsedEdge = canvasToolInputs.create_diagram.safeParse({
                nodes,
                edges: [edge],
              })
              return parsedEdge.success ? parsedEdge.data.edges : []
            })
          : []
        const viewport = editor.getViewportPageBounds()
        const origin = parsed.data.origin ?? {
          x: viewport.x + 40,
          y: viewport.y + 40,
        }
        // Draft diagrams use a measured grid until the complete graph can be laid out.
        void computeLayout(prepared, [], {
          ...parsed.data.layout,
          mode: 'grid',
        })
          .then((positions) => {
            if (fingerprint !== next || editor.isDisposed) return
            preview.apply(() => {
              draw([
                ...prepared.map((node, index) => ({
                  ...node,
                  x: origin.x + positions[index]!.x,
                  y: origin.y + positions[index]!.y,
                })),
                ...edges.map((edge) => ({ ...edge, type: 'arrow' as const })),
              ])
            })
          })
          .catch(() => {})
        return
      }
      preview.apply(() => {
        const source =
          name === 'connect_shapes' && Array.isArray(input.connections)
            ? input.connections
                .filter((connection) => connection && !connection.arrowId)
                .map((connection) => ({ ...connection, type: 'arrow' }))
            : input.shapes
        if (
          ['create_shapes', 'connect_shapes'].includes(name) &&
          Array.isArray(source)
        ) {
          const shapes = source.slice(0, 200).flatMap((shape) => {
            const parsed = canvasToolInputs.create_shapes.safeParse({
              shapes: [shape],
            })
            return parsed.success ? parsed.data.shapes : []
          })
          draw(shapes)
        } else if (name === 'update_shapes') {
          const updates = Array.isArray(input.updates)
            ? input.updates.slice(0, 200).flatMap((update) => {
                const parsed = canvasToolInputs.update_shapes.safeParse({
                  updates: [update],
                })
                return parsed.success ? (parsed.data.updates ?? []) : []
              })
            : []
          const shared = canvasToolInputs.update_shapes.safeParse({
            ids: input.ids,
            patch: input.patch,
          })
          if (updates.length) updateShapes(editor, { updates })
          if (shared.success) updateShapes(editor, shared.data)
        }
      })
    },
  }
}
