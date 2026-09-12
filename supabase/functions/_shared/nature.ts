// Europe PMC search, filtered to the Nature family. Free, no API key.
import { Type, type FunctionDeclaration } from 'npm:@google/genai@2'

const BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest/search'

const JOURNALS = [
  'Nature',
  'Nature Neuroscience',
  'Nature Genetics',
  'Nature Reviews Neuroscience',
  'Nature Metabolism',
  'Nature Communications',
]

export type Paper = { title: string; journal: string; year: string; doi: string }

export const NATURE_SEARCH_TOOL: FunctionDeclaration = {
  name: 'nature_search',
  description:
    'Search real published papers in Nature-family journals. Returns title, journal, year and DOI. Cite only what this returns.',
  parameters: {
    type: Type.OBJECT,
    required: ['query'],
    properties: {
      query: {
        type: Type.STRING,
        description: 'Plain keywords, e.g. "caffeine adenosine receptor sleep"',
      },
    },
  },
}

/** Returns up to 6 papers, newest-cited first. Never throws: search failure must
 *  not kill a lesson — Helix is told to cite nothing instead. */
export async function natureSearch(query: string): Promise<Paper[] | { error: string }> {
  const journalFilter = JOURNALS.map((j) => `JOURNAL:"${j}"`).join(' OR ')
  const url =
    `${BASE}?query=${encodeURIComponent(`(${query}) AND (${journalFilter})`)}` +
    `&format=json&pageSize=6&resultType=lite&sort=${encodeURIComponent('CITED desc')}`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return { error: `europepmc ${res.status}` }

    const body = await res.json()
    const results = body?.resultList?.result
    if (!Array.isArray(results)) return { error: 'europepmc returned no result list' }

    return results
      .filter((r: Record<string, unknown>) => r.doi && r.title)
      .map((r: Record<string, unknown>) => ({
        title: String(r.title).replace(/\.$/, ''),
        journal: String(r.journalTitle ?? ''),
        year: String(r.pubYear ?? ''),
        doi: String(r.doi),
      }))
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
