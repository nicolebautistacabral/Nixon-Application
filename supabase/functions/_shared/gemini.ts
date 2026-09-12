// Gemini function-calling loop, built for a very small free-tier budget.
//
// Google's free tier caps requests PER DAY PER MODEL (as low as 20 for
// gemini-3.6-flash), so two things matter more than speed:
//   1. spend as few requests as possible per message, and
//   2. when one model's daily quota is gone, keep working on another.
import {
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
  type Part,
} from 'npm:@google/genai@2'

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>

/** Coordinating is routing and bookkeeping; authoring is the lesson itself.
 *  Lite models have far larger daily allowances, so Nixon's own turns use them
 *  and the scarce capable-model budget goes to Cadence and Helix. */
export type ModelRole = 'coordinator' | 'author'

export type RunAgentOpts = {
  system: string
  history: Content[]
  userText: string
  tools: FunctionDeclaration[]
  execute: ToolExecutor
  role?: ModelRole
  maxSteps?: number
  temperature?: number
}

const env = (k: string) => Deno.env.get(k) || undefined

// Unknown names 404 and are skipped automatically, so listing several spellings
// costs nothing and survives Google renaming things.
const CHAINS: Record<ModelRole, string[]> = {
  coordinator: [
    env('GEMINI_MODEL_COORDINATOR'),
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
    env('GEMINI_MODEL'),
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
  ].filter((m): m is string => !!m),
  author: [
    env('GEMINI_MODEL'),
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-flash-lite-latest',
    'gemini-2.5-flash-lite',
  ].filter((m): m is string => !!m),
}

/** Models known not to exist on this key — skipped for the life of the instance. */
const missing = new Set<string>()
/** Models whose daily quota is spent — retried after this timestamp. */
const exhausted = new Map<string, number>()
const EXHAUSTED_FOR_MS = 15 * 60 * 1000

let client: GoogleGenAI | null = null
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

const msgOf = (err: unknown) => (err instanceof Error ? err.message : String(err))
const statusOf = (err: unknown) => (err as { status?: number })?.status

/** The model name is not usable on this key at all. */
function isModelMissing(err: unknown): boolean {
  return statusOf(err) === 404 || /NOT_FOUND|no longer available|is not found/i.test(msgOf(err))
}

/** 429 because today's allowance for this model is gone. Waiting will not help. */
function isDailyQuota(err: unknown): boolean {
  return statusOf(err) === 429 && /PerDay|per day|GenerateRequestsPerDay/i.test(msgOf(err))
}

/** 429/503 that a short wait can clear (per-minute burst, overload). */
function isTransient(err: unknown): boolean {
  const s = statusOf(err)
  return (s === 429 && !isDailyQuota(err)) || s === 503 || s === 500 ||
    /UNAVAILABLE|overloaded/i.test(msgOf(err))
}

/** Google tells us how long to wait; honour it when it is short. */
function retryDelayMs(err: unknown, fallback: number): number {
  const m = msgOf(err).match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/) ??
    msgOf(err).match(/retry in (\d+(?:\.\d+)?)s/i)
  const secs = m ? Number(m[1]) : NaN
  return Number.isFinite(secs) && secs > 0 && secs <= 20 ? Math.ceil(secs * 1000) : fallback
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type GenConfig = Record<string, unknown>

async function callModel(model: string, contents: Content[], config: GenConfig) {
  const fallbacks = [3000, 8000]
  for (let attempt = 0; ; attempt++) {
    try {
      return await ai().models.generateContent({ model, contents, config })
    } catch (err) {
      if (!isTransient(err) || attempt >= fallbacks.length) throw err
      const wait = retryDelayMs(err, fallbacks[attempt])
      console.warn(`gemini ${model}: transient, retrying in ${wait}ms`)
      await sleep(wait)
    }
  }
}

function available(chain: string[]): string[] {
  const now = Date.now()
  const usable = chain.filter((m) => !missing.has(m) && (exhausted.get(m) ?? 0) < now)
  return usable.length ? usable : chain.filter((m) => !missing.has(m))
}

async function generate(
  contents: Content[],
  config: GenConfig,
  role: ModelRole,
): Promise<GenerateContentResponse> {
  const chain = available(CHAINS[role])
  let lastErr: unknown
  for (const model of chain) {
    try {
      const res = await callModel(model, contents, config)
      return res
    } catch (err) {
      lastErr = err
      if (isModelMissing(err)) {
        missing.add(model)
        console.warn(`gemini ${model}: not available on this key, skipping`)
      } else if (isDailyQuota(err)) {
        exhausted.set(model, Date.now() + EXHAUSTED_FOR_MS)
        console.warn(`gemini ${model}: daily quota spent, falling through to the next model`)
      } else {
        throw err
      }
    }
  }
  const spent = [...exhausted.keys()].join(', ')
  throw new Error(
    `No Gemini model left for ${role}. Tried ${CHAINS[role].join(', ')}.` +
      (spent ? ` Daily quota spent on: ${spent}.` : '') +
      ` Last error: ${msgOf(lastErr)}`,
  )
}

export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const {
    system, history, userText, tools, execute,
    role = 'author', maxSteps = 25, temperature = 0.4,
  } = opts
  const contents: Content[] = [...history, { role: 'user', parts: [{ text: userText }] }]

  for (let step = 0; step < maxSteps; step++) {
    const res = await generate(contents, {
      systemInstruction: system,
      temperature,
      // A lesson runs to ~3300 chars and the model spends tokens thinking
      // before writing; too low a cap returns an empty candidate.
      maxOutputTokens: 8192,
      tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
    }, role)

    const calls = res.functionCalls ?? []
    const candidate = res.candidates?.[0]
    const modelContent = candidate?.content

    if (calls.length === 0 || !modelContent) {
      const text = res.text?.trim()
      if (text) return text
      throw new Error(
        `gemini returned no text and no function calls ` +
          `(finishReason=${candidate?.finishReason ?? 'none'}, step ${step + 1}/${maxSteps})`,
      )
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
        result = { error: msgOf(err) }
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
