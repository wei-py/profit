#!/usr/bin/env node
/**
 * 激活码管理工具（通过 wrangler d1 execute --remote）
 *
 * 用法:
 *   pnpm code create [数量] [--max-devices=N] [--expires-in=30d]
 *   pnpm code delete PFT-XXXX-XXXX
 *   pnpm code all
 *   pnpm code actived
 *   pnpm code inactive
 *   pnpm code check PFT-XXXX-XXXX
 */

const crypto = require('crypto')
const { execSync } = require('child_process')
const path = require('path')

const WORKER_DIR = path.resolve(__dirname, '../worker')

function wrangler(sql) {
  const cmd = `wrangler d1 execute profit-db --remote --command="${sql.replace(/"/g, '\\"')}"`
  try {
    const stdout = execSync(cmd, {
      cwd: WORKER_DIR,
      stdio: 'pipe',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
      shell: true,
    }).toString()
    const jsonStart = stdout.indexOf('[')
    if (jsonStart === -1) return []
    const jsonEnd = stdout.lastIndexOf(']')
    return JSON.parse(stdout.slice(jsonStart, jsonEnd + 1))
  } catch (e) {
    const stderr = e.stderr?.toString() || ''
    const jsonStart = stderr.indexOf('[')
    if (jsonStart !== -1) {
      const jsonEnd = stderr.lastIndexOf(']')
      try { return JSON.parse(stderr.slice(jsonStart, jsonEnd + 1)) } catch {}
    }
    if (stderr.includes('CLOUDFLARE_API_TOKEN') || stderr.includes('auth')) {
      console.error('认证失败。请先登录: cd worker && pnpm wrangler login')
      process.exit(1)
    }
    console.error('命令执行失败:', stderr.slice(0, 500) || e.message)
    process.exit(1)
  }
}

function genCode() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase()
  return `PFT-${raw.slice(0, 4)}-${raw.slice(4, 8)}`
}

// --- 子命令 ---

function cmdCreate(args) {
  let count = 1
  let maxDevices = 1
  let expiresIn = null

  for (const arg of args) {
    if (/^\d+$/.test(arg)) {
      count = parseInt(arg, 10)
    } else if (arg.startsWith('--max-devices=')) {
      maxDevices = parseInt(arg.split('=')[1], 10) || 1
    } else if (arg.startsWith('--expires-in=')) {
      expiresIn = arg.split('=')[1]
    }
  }

  function expiresClause(days) {
    return `datetime('now', '+${days} days')`
  }

  console.log(`生成 ${count} 个激活码 ...`)
  console.log()

  for (let i = 0; i < count; i++) {
    const code = genCode()
    let cols = 'code, max_devices'
    let vals = `'${code}', ${maxDevices}`
    if (expiresIn) {
      const m = expiresIn.match(/^(\d+)(d|m|y)$/)
      let days = 365
      if (m) {
        const num = parseInt(m[1], 10)
        if (m[2] === 'd') days = num
        else if (m[2] === 'm') days = num * 30
        else if (m[2] === 'y') days = num * 365
      }
      cols += ', expires_at'
      vals += `, ${expiresClause(days)}`
    }
    const result = wrangler(`INSERT INTO activations (${cols}) VALUES (${vals})`)
    if (result[0]?.success) {
      console.log(`  ✓ ${code}`)
    } else {
      console.log(`  ✗ ${code} 写入失败`)
    }
  }
}

function cmdDelete(args) {
  const code = args[0]
  if (!code) { console.error('用法: pnpm code delete <激活码>'); process.exit(1) }

  const check = wrangler(`SELECT COUNT(*) as cnt FROM devices d JOIN activations a ON a.id=d.activation_id WHERE a.code='${code}'`)
  const cnt = check[0]?.results?.[0]?.cnt || 0

  if (cnt > 0) {
    console.log(`${code} 已绑定 ${cnt} 台设备，改为撤销`)
    wrangler(`UPDATE activations SET status='revoked' WHERE code='${code}'`)
    console.log(`  ✓ 已撤销: ${code}`)
  } else {
    wrangler(`DELETE FROM activations WHERE code='${code}'`)
    console.log(`  ✓ 已删除: ${code}`)
  }
}

function cmdAll() {
  const result = wrangler(
    `SELECT a.code, a.status, a.max_devices, a.created_at, a.expires_at,
            COUNT(d.id) AS used
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     GROUP BY a.id
     ORDER BY a.created_at DESC`
  )
  const rows = result[0]?.results || []
  if (rows.length === 0) { console.log('暂无激活码'); return }
  console.log('所有激活码:')
  console.log()
  rows.forEach(r => {
    const remaining = (r.max_devices || 0) - (r.used || 0)
    console.log(`  ${r.code}  [${r.status}]  已用${r.used}/${r.max_devices}  剩余${remaining}  ${r.expires_at || ''}`)
  })
}

function cmdActived() {
  const result = wrangler(
    `SELECT a.code, a.status, a.max_devices,
            COUNT(d.id) AS used,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     INNER JOIN devices d ON d.activation_id = a.id
     WHERE a.status = 'active'
     GROUP BY a.id
     HAVING COUNT(d.id) > 0
     ORDER BY a.created_at DESC`
  )
  const rows = result[0]?.results || []
  if (rows.length === 0) { console.log('暂无已使用的激活码'); return }
  console.log('已使用的激活码:')
  console.log()
  rows.forEach(r => console.log(`  ${r.code}  已用${r.used}/${r.max_devices}  剩余${r.remaining}`))
}

function cmdInactive() {
  const result = wrangler(
    `SELECT a.code, a.status, a.max_devices, a.created_at, a.expires_at
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     WHERE a.status = 'active'
     GROUP BY a.id
     HAVING COUNT(d.id) = 0
     ORDER BY a.created_at DESC`
  )
  const rows = result[0]?.results || []
  if (rows.length === 0) { console.log('暂无未使用的激活码'); return }
  console.log('未使用的激活码:')
  console.log()
  rows.forEach(r => console.log(`  ${r.code}  可用${r.max_devices}次  ${r.expires_at || '永不过期'}`))
}

function cmdCheck(args) {
  const code = args[0]
  if (!code) { console.error('用法: pnpm code check <激活码>'); process.exit(1) }

  const result = wrangler(
    `SELECT a.code, a.status, a.max_devices, a.created_at, a.expires_at,
            COUNT(d.id) AS used,
            a.max_devices - COUNT(d.id) AS remaining
     FROM activations a
     LEFT JOIN devices d ON d.activation_id = a.id
     WHERE a.code = '${code}'
     GROUP BY a.id`
  )
  const row = result[0]?.results?.[0]
  if (!row) { console.log(`激活码不存在: ${code}`); return }

  const devResult = wrangler(
    `SELECT d.fingerprint, d.bound_at, d.last_seen_at
     FROM devices d JOIN activations a ON a.id = d.activation_id
     WHERE a.code = '${code}' ORDER BY d.bound_at`
  )
  const devices = devResult[0]?.results || []

  console.log()
  console.log(`激活码: ${row.code}`)
  console.log(`状态:   ${row.status}`)
  console.log(`额度:   ${row.used || 0} / ${row.max_devices} (剩余 ${row.remaining || row.max_devices})`)
  console.log(`创建:   ${row.created_at}`)
  console.log(`过期:   ${row.expires_at || '永不过期'}`)
  if (devices.length > 0) {
    console.log(`已绑定设备 (${devices.length}):`)
    devices.forEach((d, i) => {
      console.log(`  ${i + 1}. ${d.fingerprint}`)
      console.log(`     绑定: ${d.bound_at}  最后活跃: ${d.last_seen_at}`)
    })
  }
  console.log()
}

// --- 入口 ---

const args = process.argv.slice(2)
const subcmd = args[0]
const rest = args.slice(1)

switch (subcmd) {
  case 'create':   cmdCreate(rest); break
  case 'delete':
  case 'revoke':   cmdDelete(rest); break
  case 'all':
  case 'list':     cmdAll(); break
  case 'actived':
  case 'used':     cmdActived(); break
  case 'inactive':
  case 'unused':   cmdInactive(); break
  case 'check':
  case 'info':     cmdCheck(rest); break
  default:
    console.log('用法: pnpm code <create|delete|all|actived|inactive|check> [参数]')
    console.log()
    console.log('  pnpm code create [数量] [--max-devices=N] [--expires-in=30d]')
    console.log('  pnpm code delete <激活码>')
    console.log('  pnpm code all')
    console.log('  pnpm code actived')
    console.log('  pnpm code inactive')
    console.log('  pnpm code check <激活码>')
}
