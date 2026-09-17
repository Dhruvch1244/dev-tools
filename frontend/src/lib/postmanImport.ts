export type ImportedRequest = { name: string; method: string; url: string; headers: { key: string; value: string }[]; body: string }

type PostmanItem = {
  name?: string
  item?: PostmanItem[]
  request?: {
    method?: string
    header?: { key: string; value: string; disabled?: boolean }[]
    url?: { raw?: string } | string
    body?: { mode?: string; raw?: string }
  }
}

function flattenPostmanItems(items: PostmanItem[], out: ImportedRequest[]) {
  for (const item of items) {
    if (item.item) {
      flattenPostmanItems(item.item, out)
      continue
    }
    if (!item.request) continue
    const url = typeof item.request.url === 'string' ? item.request.url : item.request.url?.raw ?? ''
    out.push({
      name: item.name ?? url,
      method: (item.request.method ?? 'GET').toUpperCase(),
      url,
      headers: (item.request.header ?? []).filter((h) => !h.disabled).map((h) => ({ key: h.key, value: h.value })),
      body: item.request.body?.raw ?? '',
    })
  }
}

type InsomniaResource = {
  _type: string
  _id: string
  parentId?: string
  name?: string
  method?: string
  url?: string
  headers?: { name: string; value: string; disabled?: boolean }[]
  body?: { text?: string }
}

function parseInsomnia(doc: { resources: InsomniaResource[] }): ImportedRequest[] {
  return doc.resources
    .filter((r) => r._type === 'request')
    .map((r) => ({
      name: r.name ?? r.url ?? 'request',
      method: (r.method ?? 'GET').toUpperCase(),
      url: r.url ?? '',
      headers: (r.headers ?? []).filter((h) => !h.disabled).map((h) => ({ key: h.name, value: h.value })),
      body: r.body?.text ?? '',
    }))
}

/** Postman v2.1 collection JSON, built from a flat request list — the format parseImportFile above reads back in, so it round-trips through this app's own import tool. */
export function buildPostmanCollection(name: string, requests: { name: string; method: string; url: string }[]): string {
  return JSON.stringify(
    {
      info: { name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
      item: requests.map((r) => ({
        name: r.name,
        request: { method: r.method, header: [], url: { raw: r.url } },
      })),
    },
    null,
    2
  )
}

export function parseImportFile(text: string): { collectionName: string; requests: ImportedRequest[] } {
  const doc = JSON.parse(text)
  if (Array.isArray(doc.resources)) {
    return { collectionName: 'Imported from Insomnia', requests: parseInsomnia(doc) }
  }
  if (doc.info || doc.item) {
    const out: ImportedRequest[] = []
    flattenPostmanItems(doc.item ?? [], out)
    return { collectionName: doc.info?.name ?? 'Imported from Postman', requests: out }
  }
  throw new Error('Unrecognized file — expected a Postman collection (v2.1) or an Insomnia export.')
}
