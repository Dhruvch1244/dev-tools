export type LargestEntry = { name: string; size: number }
export type PackageCount = { packageName: string; classCount: number }

export type JarSummary = {
  fileName: string
  entryCount: number
  classCount: number
  totalUncompressedSize: number
  manifestMainAttributes: Record<string, string>
  classMajorVersions: Record<string, number>
  resourcesByExtension: Record<string, number>
  largestEntries: LargestEntry[]
  topPackages: PackageCount[]
  signed: boolean
  multiRelease: boolean
}
export type DuplicateClass = { className: string; foundInJars: string[] }
export type JarInspectResponse = { jars: JarSummary[]; duplicateClasses: DuplicateClass[] }

export async function inspectJars(files: File[]): Promise<JarInspectResponse> {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  const res = await fetch('/api/java/jar-inspect', { method: 'POST', body: form })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Request failed')
  }
  return res.json()
}
