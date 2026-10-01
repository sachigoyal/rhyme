import { tool } from 'ai'
import {
  createShapesInput,
  arrangeShapesInput,
  connectShapesInput,
  createDiagramInput,
  inspectSceneInput,
  deleteShapesInput,
  readCanvasInput,
  updateShapesInput,
} from './canvas-schema'

// No `execute`: the browser applies each call to the live editor and returns the result.
export const canvasTools = {
  read_canvas: tool({
    description:
      'Read live canvas shapes with labels, geometry, style, hierarchy, and connections. Filter by ids, selection, region, text or types. Page scope is paginated: follow nextOffset until null. Standard detail preserves labels; full adds typography and connector properties. Includes page counts and offscreen region summaries.',
    inputSchema: readCanvasInput,
  }),
  create_shapes: tool({
    description:
      'Create shapes on the canvas. Shapes are created in order, so an arrow can refer to the id of a shape created earlier in the same call. Returns the created ids with their actual page bounds.',
    inputSchema: createShapesInput,
  }),
  update_shapes: tool({
    description:
      'Precisely edit shapes by id, or apply one shared patch to many ids. Supports page position, relative dx/dy, local rotation in degrees, typography, labelColor separately from body color, and connector style. Only supplied fields change. Returns actual updated shapes; use arrange_shapes for spacing.',
    inputSchema: updateShapesInput,
  }),
  create_diagram: tool({
    description:
      'Create a complete connected scene without calculating coordinates. Give nodes semantic roles and labelled edges; roles supply suitable shapes and colors, all overridable. Text is measured and nodes are spaced by a layout engine. Flow supports branching, cycles and disconnected components; grid suits boards, stack suits sequences. Finds empty space by default. Returns actual shapes, id aliases and layout checks. Prefer this for diagrams and multi-node scenes.',
    inputSchema: createDiagramInput,
  }),
  arrange_shapes: tool({
    description:
      'Arrange existing shapes deterministically: align, distribute, pack, or layout as flow/grid/stack with a gap. Flow uses existing arrow relationships. Keeps connectors bound. Does not move locked shapes, or a parent and its child twice. Returns actual geometry and layout checks.',
    inputSchema: arrangeShapesInput,
  }),
  connect_shapes: tool({
    description:
      'Create labelled relationships between existing shape ids, in a single batch; arrowId rebinds an existing connector. Optional normalized fromAnchor/toAnchor select attachment points. Uses bound connectors so links follow their nodes. Choose elbow for flowcharts, arc with bend for curved relations, dashed for optional relations, and arrowheads for direction. Returns actual connectors.',
    inputSchema: connectShapesInput,
  }),
  inspect_scene: tool({
    description:
      'Inspect current scene geometry and relationships. Checks overlapping bodies, insufficient spacing, unbound connectors and likely label contrast problems. Focus on ids or a region; also checks focused shapes against their neighbors. Reports capped issues with total counts. Contained text and ancestor/descendant pairs are intentional; free endpoints may be intentional.',
    inputSchema: inspectSceneInput,
  }),
  delete_shapes: tool({
    description:
      'Delete shapes by id. The user is asked to approve every deletion; if they decline, do not retry.',
    inputSchema: deleteShapesInput,
  }),
}
