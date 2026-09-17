export type ClassCoverage = {
  packageName: string
  className: string
  lineCovered: number
  lineMissed: number
  branchCovered: number
  branchMissed: number
}

export type JacocoReport = {
  reportName: string
  classes: ClassCoverage[]
  totalLineCovered: number
  totalLineMissed: number
  totalBranchCovered: number
  totalBranchMissed: number
}

export function linePct(c: { lineCovered: number; lineMissed: number }): number | null {
  const total = c.lineCovered + c.lineMissed
  return total === 0 ? null : (c.lineCovered / total) * 100
}

function directCounter(el: Element, type: string): { missed: number; covered: number } {
  const c = Array.from(el.children).find((child) => child.tagName === 'counter' && child.getAttribute('type') === type)
  return { missed: Number(c?.getAttribute('missed') ?? 0), covered: Number(c?.getAttribute('covered') ?? 0) }
}

/**
 * Parses a JaCoCo `jacoco.xml` report. Browsers' DOMParser never fetches or resolves the
 * external DOCTYPE JaCoCo declares (`report.dtd`) — no network call, no XXE — so this runs
 * safely client-side, same as SVG Tools' DOM-based XML parsing.
 */
export function parseJacocoXml(xmlText: string): JacocoReport {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('Could not parse XML — is this a JaCoCo report.xml?')

  const reportEl = doc.querySelector('report')
  if (!reportEl) throw new Error('No <report> root element found — is this a JaCoCo report.xml?')

  const classes: ClassCoverage[] = []
  for (const pkgEl of Array.from(reportEl.children).filter((c) => c.tagName === 'package')) {
    const packageName = (pkgEl.getAttribute('name') ?? '').replace(/\//g, '.') || '(default package)'
    for (const classEl of Array.from(pkgEl.children).filter((c) => c.tagName === 'class')) {
      const fullName = (classEl.getAttribute('name') ?? '').replace(/\//g, '.')
      const className = fullName.startsWith(packageName + '.') ? fullName.slice(packageName.length + 1) : fullName
      const line = directCounter(classEl, 'LINE')
      const branch = directCounter(classEl, 'BRANCH')
      classes.push({
        packageName,
        className,
        lineCovered: line.covered,
        lineMissed: line.missed,
        branchCovered: branch.covered,
        branchMissed: branch.missed,
      })
    }
  }

  const totalLine = directCounter(reportEl, 'LINE')
  const totalBranch = directCounter(reportEl, 'BRANCH')

  return {
    reportName: reportEl.getAttribute('name') ?? 'report',
    classes,
    totalLineCovered: totalLine.covered,
    totalLineMissed: totalLine.missed,
    totalBranchCovered: totalBranch.covered,
    totalBranchMissed: totalBranch.missed,
  }
}
