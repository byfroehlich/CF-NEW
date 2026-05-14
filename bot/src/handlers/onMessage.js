import sql from '../db/client.js'
import { extractLinks, detectPlatform, parseListeMessage } from '../lib/parser.js'
import { getCurrentWeek } from '../lib/weekHelper.js'
import { logInfo, logWarn, logError } from '../lib/logger.js'

export async function handleMessage(ctx) {
  const text = ctx.message.text
  const messageId = ctx.message.message_id
  const chatId = ctx.chat.id

  try {
    const { week, year } = getCurrentWeek()

    const [creator] = await sql`
      SELECT c.id, c.agency_id FROM creators c
      WHERE c.telegram_chat_id = ${chatId}
      AND c.active = true AND c.deleted_at IS NULL
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

    // "Liste"-Nachricht der Agentur → strukturierter Job
    const parsed = parseListeMessage(text)
    if (parsed) {
      const [job] = await sql`
        INSERT INTO jobs (
          creator_id, agency_id, week_number, year,
          platform, source_link, source_message_id,
          title, description, kleidung, requisiten, script, caption,
          location_tags
        ) VALUES (
          ${creator.id}, ${creator.agency_id}, ${week}, ${year},
          ${parsed.platform}, ${parsed.source_link}, ${messageId},
          ${parsed.title}, ${parsed.description}, ${parsed.kleidung},
          ${parsed.requisiten}, ${parsed.script}, ${parsed.caption},
          ${parsed.location_tags}
        )
        RETURNING id, platform, title
      `
      await sql`
        INSERT INTO job_status_history (job_id, old_status, new_status, changed_by_source)
        VALUES (${job.id}, null, 'open', 'bot')
      `
      await logInfo('job_created_from_liste',
        `Job aus Liste-Nachricht angelegt: ${job.title}`,
        { job_id: job.id, platform: job.platform, week, year, message_id: messageId },
        creator.agency_id
      )
      await ctx.reply(`✅ Auftrag erfasst: ${job.title} (${job.platform}) — KW${week}`)
      return
    }

    // Fallback: einzelne Links in der Nachricht
    const links = extractLinks(text)
    if (links.length === 0) return

    const inserted = []
    for (const link of links) {
      const platform = detectPlatform(link)
      const [job] = await sql`
        INSERT INTO jobs (creator_id, agency_id, week_number, year, platform, source_link, source_message_id)
        VALUES (${creator.id}, ${creator.agency_id}, ${week}, ${year}, ${platform}, ${link}, ${messageId})
        RETURNING id, platform
      `
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

    const lines = inserted.map((j, i) => `  ${i + 1}. ${j.platform}`).join('\n')
    await ctx.reply(
      `✅ KW${week}: ${inserted.length} Auftrag${inserted.length !== 1 ? 'e' : ''} erfasst\n${lines}`
    )

  } catch (err) {
    await logError('message_handler_error', err.message, { chat_id: chatId, message_id: messageId, stack: err.stack })
    console.error('onMessage error:', err)
  }
}
