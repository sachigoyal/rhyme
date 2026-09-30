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

export function getFolderPath(folders: Folder[], folderId: string): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: Folder[] = []
  const visited = new Set<string>()
  let folder = byId.get(folderId)
  while (folder && !visited.has(folder.id)) {
    visited.add(folder.id)
    path.unshift(folder)
    folder = folder.parentId ? byId.get(folder.parentId) : undefined
  }
  return path
}
