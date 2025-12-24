export class CreateDocDto {
  title: string
  content?: string
  type?: string
  status?: string
  tags?: string[]
  parentId?: number
  folderId?: number
  order?: number
}
