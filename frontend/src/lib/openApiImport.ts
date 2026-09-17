import * as yaml from 'js-yaml'

export type ImportedOpenApiRequest = { name: string; method: string; url: string; headers: { key: string; value: string }[]; body: string }

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

function parseSpecText(text: string): Record<string, unknown> {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch {
      /* not JSON after all — fall through to YAML */
    }
  }
  return yaml.load(text) as Record<string, unknown>
}

function baseUrlFrom(spec: Record<string, unknown>): string {
  const servers = spec.servers as { url?: string }[] | undefined
  if (Array.isArray(servers) && servers[0]?.url) return servers[0].url.replace(/\/$/, '')
  const host = spec.host as string | undefined
  if (host) {
    const schemes = spec.schemes as string[] | undefined
    const scheme = Array.isArray(schemes) && schemes[0] ? schemes[0] : 'https'
    return `${scheme}://${host}${(spec.basePath as string) ?? ''}`.replace(/\/$/, '')
  }
  return ''
}

function schemaStub(schema: any, depth = 0): unknown {
  if (!schema || depth > 4) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  switch (schema.type) {
    case 'object': {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(schema.properties ?? {})) out[k] = schemaStub(v, depth + 1)
      return out
    }
    case 'array':
      return [schemaStub(schema.items, depth + 1)]
    case 'string':
      return schema.enum?.[0] ?? ''
    case 'integer':
    case 'number':
      return 0
    case 'boolean':
      return false
    default:
      return null
  }
}

/** OpenAPI 3.x `requestBody.content['application/json']`, or Swagger 2.0's `in: body` parameter — whichever this operation has. */
function exampleBody(operation: any): string {
  const json = operation.requestBody?.content?.['application/json']
  if (json?.example !== undefined) return JSON.stringify(json.example, null, 2)
  if (json?.examples) {
    const first = Object.values(json.examples)[0] as any
    if (first?.value !== undefined) return JSON.stringify(first.value, null, 2)
  }
  if (json?.schema) return JSON.stringify(schemaStub(json.schema), null, 2)

  const bodyParam = Array.isArray(operation.parameters) ? operation.parameters.find((p: any) => p.in === 'body') : null
  if (bodyParam?.schema) return JSON.stringify(schemaStub(bodyParam.schema), null, 2)

  return ''
}

/** Parses an OpenAPI 3.x or Swagger 2.0 document (JSON or YAML) into one request per operation. */
export function parseOpenApiFile(text: string): { collectionName: string; requests: ImportedOpenApiRequest[] } {
  let spec: Record<string, unknown>
  try {
    spec = parseSpecText(text)
  } catch (e) {
    throw new Error(e instanceof Error ? `Could not parse file: ${e.message}` : 'Could not parse file')
  }
  const paths = spec?.paths as Record<string, unknown> | undefined
  if (!spec || !paths) {
    throw new Error('Unrecognized file — expected an OpenAPI 3.x or Swagger 2.0 document with a "paths" object.')
  }

  const baseUrl = baseUrlFrom(spec)
  const requests: ImportedOpenApiRequest[] = []
  for (const [rawPath, pathItem] of Object.entries(paths)) {
    for (const method of METHODS) {
      const operation = (pathItem as any)?.[method]
      if (!operation) continue
      const name = operation.operationId || operation.summary || `${method.toUpperCase()} ${rawPath}`
      requests.push({
        name,
        method: method.toUpperCase(),
        url: baseUrl + rawPath,
        headers: [],
        body: exampleBody(operation),
      })
    }
  }
  if (requests.length === 0) throw new Error('No operations found under "paths".')

  const info = spec.info as { title?: string } | undefined
  const collectionName = info?.title ? `${info.title} (OpenAPI)` : 'Imported from OpenAPI'
  return { collectionName, requests }
}
