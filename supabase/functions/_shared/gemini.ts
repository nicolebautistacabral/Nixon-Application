// Gemini 2.5 Flash function-calling loop.
import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from 'npm:@google/genai@2'

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

const MODEL = 'gemini-2.5-flash'

let client: GoogleGenAI | null = null
function ai(): GoogleGenAI {
  if (!client) {
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) throw new Error('GEMINI_API_KEY not set')
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

export async function runAgent(opts: RunAgentOpts): Promise<string> {
  const { system, history, userText, tools, execute, maxSteps = 25, temperature = 0.4 } = opts
  const contents: Content[] = [...history, { role: 'user', parts: [{ text: userText }] }]

  for (let step = 0; step < maxSteps; step++) {
    const res = await ai().models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: system,
        temperature,
        thinkingConfig: { thinkingBudget: 512 },
        tools: tools.length ? [{ functionDeclarations: tools }] : undefined,
      },
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
