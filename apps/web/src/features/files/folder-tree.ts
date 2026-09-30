import type { Folder } from '@rhyme/trpc-client'

export interface FolderNode extends Folder {
  depth: number
  children: FolderNode[]
}

export function buildFolderTree(folders: Folder[]) {
  const byParent = Map.groupBy(folders, (folder) => folder.parentId)
  const build = (parentId: string | null, depth: number): FolderNode[] =>
    (byParent.get(parentId) ?? []).map((folder) => ({
      ...folder,
      depth,
      children: build(folder.id, depth + 1),
    }))
  return build(null, 0)
}

export function flattenFolderTree(nodes: FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolderTree(node.children)])
}
