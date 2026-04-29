import sql from '../db/client.js'
import { getCurrentWeek, carryOverJobs } from '../lib/weekHelper.js'
import { logInfo, logError, logStatusChange } from '../lib/logger.js'

export async function handleCommand(ctx) {
  const text = ctx.message.text
  const parts = text.split(' ')
  const cmd = parts[0].toLowerCase().replace('@' + (ctx.botInfo?.username?.toLowerCase() || ''), '')
  const arg = parts[1]
  const chatId = ctx.chat.id
  const { week, year } = getCurrentWeek()

  try {
    // Creator identifizieren
    const [creator] = await sql`
      SELECT id, agency_id FROM creators
      WHERE telegram_chat_id = ${chatId}
      AND active = true AND deleted_at IS NULL
      LIMIT 1
    `

    if (cmd === '/help') {
      return ctx.reply(
        `📱 CreatorFlow Commands:\n\n` +
        `/status — Offene Jobs diese Woche\n` +
        `/week — Alle Jobs KW${week}\n` +
        `/done [nr] — Job manuell erledigt\n` +
        `/carry — Offene Jobs → nächste Woche\n` +
        `/help — Diese Hilfe`
      )
    }

    if (cmd === '/status') {
      const jobs = await sql`
        SELECT platform FROM jobs
        WHERE creator_id = ${creator?.id}
        AND week_number = ${week} AND year = ${year}
        AND status = 'open' AND deleted_at IS NULL
        ORDER BY created_at
      `
      if (jobs.length === 0) return ctx.reply(`✅ Keine offenen Jobs in KW${week}.`)
      const lines = jobs.map((j, i) => `${i + 1}. 🔴 ${j.platform}`).join('\n')
      return ctx.reply(`📋 Offene Jobs KW${week}:\n${lines}`)
    }

    if (cmd === '/week') {
      const jobs = await sql`
        SELECT platform, status, carried_over_from FROM jobs
        WHERE creator_id = ${creator?.id}
        AND week_number = ${week} AND year = ${year}
        AND deleted_at IS NULL
        ORDER BY created_at
      `
      if (jobs.length === 0) return ctx.reply(`Keine Jobs in KW${week}.`)
      const emoji = { open: '🔴', in_progress: '🟡', delivered: '✅', confirmed: '⭐', carried: '↩' }
      const lines = jobs.map((j, i) => {
        const carry = j.carried_over_from ? ' ↩' : ''
        return `${i + 1}. ${emoji[j.status] || '⚪'} ${j.platform}${carry}`
      }).join('\n')
      return ctx.reply(`📅 KW${week} — ${jobs.length} Jobs:\n${lines}`)
    }

    if (cmd === '/done') {
      const nr = parseInt(arg)
      if (!nr) return ctx.reply('Verwendung: /done [Nummer]\nBeispiel: /done 2')
      const jobs = await sql`
        SELECT id, platform, status FROM jobs
        WHERE creator_id = ${creator?.id}
        AND week_number = ${week} AND year = ${year}
        AND deleted_at IS NULL
        ORDER BY created_at
      `
      const job = jobs[nr - 1]
      if (!job) return ctx.reply(`Job ${nr} nicht gefunden. /week für Übersicht.`)
      const oldStatus = job.status
      await sql`UPDATE jobs SET status = 'delivered', delivered_at = now() WHERE id = ${job.id}`
      await logStatusChange(job.id, oldStatus, 'delivered', 'bot')
      await logInfo('manual_done', `Job ${nr} manuell als erledigt`, { job_id: job.id, platform: job.platform }, creator?.agency_id)
      return ctx.reply(`✅ Job ${nr} (${job.platform}) als erledigt markiert.`)
    }

    if (cmd === '/carry') {
      const count = await carryOverJobs(creator?.id)
      await logInfo('manual_carry', `${count} Jobs manuell übertragen`, { count }, creator?.agency_id)
      return ctx.reply(`↩ ${count} offene Job${count !== 1 ? 's' : ''} in nächste Woche übertragen.`)
    }

  } catch (err) {
    await logError('command_error', err.message, { cmd, stack: err.stack })
    console.error('Command error:', err)
    await ctx.reply('⚠️ Fehler beim Ausführen des Commands.')
  }
}
