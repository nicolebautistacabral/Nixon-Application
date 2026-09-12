// Gemini function-calling loop.
import {
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from 'npm:@google/genai@2'

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>

export type RunAgentOpts = {
  system: string
  history: Content[]
  userText: string
  tools: FunctionDeclaration[]
  execute: ToolExecutor
  maxSteps?: number
  temperature?: number
}

// Google retires model names over time and rejects old ones with 404 for new
// API keys. Try in order and remember the first that answers; override the
// whole list with the GEMINI_MODEL secret if a specific model is wanted.
const MODEL_CANDIDATES: string[] = [
  Deno.env.get('GEMINI_MODEL'),
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash',
].filter((m): m is string => !!m)

let activeModel: string | null = null

let client: GoogleGenAI | null = null
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

/** True when the error means "this model name is not usable on this key". */
function isModelMissing(err: unknown): boolean {
  const status = (err as { status?: number })?.status
  const msg = err instanceof Error ? err.message : String(err)
  return status === 404 || /NOT_FOUND|no longer available|is not found/i.test(msg)
}

type GenConfig = Record<string, unknown>

async function generate(contents: Content[], config: GenConfig): Promise<GenerateContentResponse> {
  const candidates = activeModel ? [activeModel] : MODEL_CANDIDATES
  let lastErr: unknown
  for (const model of candidates) {
    try {
      const res = await ai().models.generateContent({ model, contents, config })
      if (activeModel !== model) {
        activeModel = model
        console.log(`gemini model: ${model}`)
      }
      return res
    } catch (err) {
      if (!isModelMissing(err)) throw err
      console.warn(`gemini model ${model} unavailable, trying next`)
      lastErr = err
      if (activeModel === model) activeModel = null // retired mid-flight; re-probe
    }
  }
  throw new Error(
    `No usable Gemini model. Tried ${candidates.join(', ')}. ` +
      `Set the GEMINI_MODEL secret to a model your key can use. ` +
      `Last error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
  )
}

export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const { system, history, userText, tools, execute, maxSteps = 25, temperature = 0.4 } = opts
  const contents: Content[] = [...history, { role: 'user', parts: [{ text: userText }] }]

  for (let step = 0; step < maxSteps; step++) {
    const res = await generate(contents, {
      systemInstruction: system,
      temperature,
      tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
    })

    const calls = res.functionCalls ?? []
    const modelContent = res.candidates?.[0]?.content

    if (calls.length === 0 || !modelContent) {
      const text = res.text?.trim()
      if (text) return text
      throw new Error('gemini returned no text and no function calls')
    }

    contents.push(modelContent)
    const responses: Part[] = []
    for (const call of calls) {
      const name = call.name ?? ''
      const args = (call.args ?? {}) as Record<string, unknown>
      let result: unknown
      try {
        result = await execute(name, args)
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) }
      }
      console.log(`tool ${name}`, JSON.stringify(args).slice(0, 300))
      responses.push({
        functionResponse: { name, id: call.id, response: { result: result ?? null } },
      })
    }
    contents.push({ role: 'user', parts: responses })
  }
  throw new Error(`agent exceeded ${maxSteps} steps`)
}
