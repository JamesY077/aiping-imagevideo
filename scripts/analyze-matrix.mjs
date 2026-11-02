import fs from 'node:fs'
import path from 'node:path'

const file = process.argv[2]
if (!file) {
  console.error('usage: node scripts/analyze-matrix.mjs <matrix.jsonl>')
  process.exit(1)
}

const records = fs
  .readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line))

const byModel = new Map()
for (const r of records) {
  if (!byModel.has(r.model)) byModel.set(r.model, [])
  byModel.get(r.model).push(r)
}

function pct(n, d) {
  return d ? `${Math.round((n / d) * 100)}%` : '-'
}

const overall = {
  total: records.length,
  ok: records.filter((r) => r.status === 'succeeded').length,
  failed: records.filter((r) => r.status === 'failed').length,
}
overall.rate = pct(overall.ok, overall.total)

const lines = []
lines.push('# 全模型参数矩阵测试报告')
lines.push('')
lines.push(`- 用例总数：**${overall.total}**`)
lines.push(`- 成功：**${overall.ok}**（${overall.rate}）`)
lines.push(`- 失败：**${overall.failed}**`)
lines.push('')
lines.push('## 按模型汇总')
lines.push('')
lines.push('| 模型 | 用例 | 成功 | 失败 | 成功率 | 平均耗时 |')
lines.push('| --- | ---: | ---: | ---: | ---: | ---: |')
for (const [model, list] of byModel) {
  const ok = list.filter((r) => r.status === 'succeeded').length
  const avg = Math.round(list.reduce((s, r) => s + (r.elapsedMs || 0), 0) / list.length / 1000)
  lines.push(`| ${model} | ${list.length} | ${ok} | ${list.length - ok} | ${pct(ok, list.length)} | ${avg}s |`)
}
lines.push('')

const failures = records.filter((r) => r.status === 'failed')
if (failures.length) {
  lines.push('## 失败用例')
  lines.push('')
  lines.push('| 用例 | HTTP | 原因 |')
  lines.push('| --- | ---: | --- |')
  for (const f of failures) {
    const reason = String(f.error?.message || '').replace(/\|/g, '\\|').slice(0, 300)
    lines.push(`| \`${f.caseId}\` | ${f.error?.status ?? '-'} | ${reason} |`)
  }
  lines.push('')
}

const slow = [...records].sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0)).slice(0, 10)
lines.push('## 最慢的 10 个用例')
lines.push('')
lines.push('| 用例 | 耗时 | 状态 |')
lines.push('| --- | ---: | --- |')
for (const s of slow) {
  lines.push(`| \`${s.caseId}\` | ${Math.round((s.elapsedMs || 0) / 1000)}s | ${s.status} |`)
}
lines.push('')

const report = lines.join('\n')
const outFile = file.replace(/\.jsonl$/, '-report.md')
fs.writeFileSync(outFile, report)
console.log(report)
console.log(`\nwritten: ${outFile}`)
