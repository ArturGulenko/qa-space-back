export class UpdateDocDto {
  title?: string
  content?: string
  type?: string
  status?: string
  tags?: string[]
  parentId?: number | null
  folderId?: number | null
  order?: number
  changeNote?: string
}
