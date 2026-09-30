import { tool } from 'ai'
import {
  createShapesInput,
  deleteShapesInput,
  readCanvasInput,
  updateShapesInput,
} from './canvas-schema'

// No `execute`: the browser applies each call to the live editor and returns the result.
export const canvasTools = {
  read_canvas: tool({
    description:
      'Read the current shapes (ids, types, text, colors, page bounds). Use it after edits to verify layout, or with scope "page" to see shapes outside the viewport.',
    inputSchema: readCanvasInput,
  }),
  create_shapes: tool({
    description:
      'Create shapes on the canvas. Shapes are created in order, so an arrow can refer to the id of a shape created earlier in the same call. Returns the created ids with their actual page bounds.',
    inputSchema: createShapesInput,
  }),
  update_shapes: tool({
    description:
      'Move, resize, relabel or restyle existing shapes by id. Only the given fields change.',
    inputSchema: updateShapesInput,
  }),
  delete_shapes: tool({
    description:
      'Delete shapes by id. The user is asked to approve every deletion; if they decline, do not retry.',
    inputSchema: deleteShapesInput,
  }),
}
