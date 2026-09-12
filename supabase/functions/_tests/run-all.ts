// Runs every Nixon test suite in one go: deno run -A supabase/functions/_tests/run-all.ts
const suites = ['phase3_test', 'phase4_test', 'phase4b_test', 'phase4c_test', 'phase5_test']
let bad = 0
for (const s of suites) {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ['run', '-A', '--no-check', new URL(`./${s}.ts`, import.meta.url).pathname],
    env: {
      SUPABASE_URL: 'http://sb.local', SUPABASE_SERVICE_ROLE_KEY: 'svc',
      TELEGRAM_BOT_TOKEN: 'tok', TELEGRAM_WEBHOOK_SECRET: 'sec', GEMINI_API_KEY: 'g',
    },
    stdout: 'piped', stderr: 'piped',
  })
  const { code, stdout } = await cmd.output()
  const out = new TextDecoder().decode(stdout)
  const passed = (out.match(/^ {2}ok/gm) ?? []).length
  console.log(`${s.padEnd(14)} ${String(passed).padStart(3)} assertions  ${code === 0 ? 'PASS' : 'FAIL'}`)
  if (code !== 0) { bad++; console.log(out.split('\n').filter((l) => l.includes('FAIL')).join('\n')) }
}
console.log(bad ? `\n${bad} suite(s) failing` : '\nall suites pass')
Deno.exit(bad ? 1 : 0)
