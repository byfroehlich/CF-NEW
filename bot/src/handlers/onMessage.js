import sql from '../db/client.js'
import { extractLinks, detectPlatform } from '../lib/parser.js'
import { getCurrentWeek } from '../lib/weekHelper.js'
import { logInfo, logWarn, logError } from '../lib/logger.js'

export async function handleMessage(ctx) {
  const text = ctx.message.text
  const messageId = ctx.message.message_id
  const chatId = ctx.chat.id

  try {
    const links = extractLinks(text)
    if (links.length === 0) return

    const { week, year } = getCurrentWeek()

    // Multi-Creator: Creator anhand Chat-ID finden
    const [creator] = await sql`
      SELECT c.id, c.agency_id FROM creators c
      WHERE c.telegram_chat_id = ${chatId}
      AND c.active = true
      AND c.deleted_at IS NULL
      LIMIT 1
    `

    if (!creator) {
      await logWarn('creator_not_found',
        'Nachricht empfangen aber kein aktiver Creator gefunden',
        { chat_id: chatId, message_id: messageId }
      )
      await ctx.reply('⚠️ Creator nicht gefunden. Bitte Admin kontaktieren.')
      return
    }

    const inserted = []
    for (const link of links) {
      const platform = detectPlatform(link)
      const [job] = await sql`
        INSERT INTO jobs (creator_id, agency_id, week_number, year, platform, source_link, source_message_id)
        VALUES (${creator.id}, ${creator.agency_id}, ${week}, ${year}, ${platform}, ${link}, ${messageId})
        RETURNING id, platform
      `
      // Status-History
      await sql`
        INSERT INTO job_status_history (job_id, old_status, new_status, changed_by_source)
        VALUES (${job.id}, null, 'open', 'bot')
      `
      inserted.push(job)
    }

    await logInfo('jobs_created',
      `${inserted.length} Job(s) angelegt für KW${week}`,
      { creator_id: creator.id, week, year, count: inserted.length, platforms: inserted.map(j => j.platform), message_id: messageId },
      creator.agency_id
    )

    const platforms = [...new Set(inserted.map(j => j.platform))].join(', ')
    const lines = inserted.map((j, i) => `  ${i + 1}. ${j.platform}`).join('\n')
    await ctx.reply(
      `✅ KW${week}: ${inserted.length} Auftrag${inserted.length !== 1 ? 'e' : ''} erfasst (${platforms})\n${lines}`
    )

  } catch (err) {
    await logError('message_handler_error', err.message, { chat_id: chatId, message_id: messageId, stack: err.stack })
    console.error('onMessage error:', err)
  }
}
