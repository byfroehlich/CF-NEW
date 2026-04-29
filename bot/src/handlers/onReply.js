import sql from '../db/client.js'
import { logInfo, logWarn, logError, logStatusChange } from '../lib/logger.js'

export async function handleReply(ctx) {
  const replyToId = ctx.message.reply_to_message.message_id
  const fileId = ctx.message.video?.file_id || ctx.message.document?.file_id
  const chatId = ctx.chat.id

  try {
    const [job] = await sql`
      SELECT j.id, j.platform, j.status, j.agency_id
      FROM jobs j
      JOIN creators c ON c.id = j.creator_id
      WHERE j.source_message_id = ${replyToId}
      AND c.telegram_chat_id = ${chatId}
      AND j.deleted_at IS NULL
      LIMIT 1
    `

    if (!job) {
      await logWarn('reply_no_job',
        'Video-Reply empfangen aber kein Job gefunden',
        { reply_to_message_id: replyToId, chat_id: chatId }
      )
      return
    }

    if (job.status === 'delivered' || job.status === 'confirmed') {
      await logInfo('reply_duplicate',
        `${job.platform}-Job bereits als geliefert markiert`,
        { job_id: job.id, status: job.status },
        job.agency_id
      )
      await ctx.reply(`ℹ️ ${job.platform}-Auftrag ist bereits als geliefert markiert.`)
      return
    }

    await sql`
      UPDATE jobs
      SET status = 'delivered', delivered_at = now()
      WHERE id = ${job.id}
    `

    await sql`
      INSERT INTO deliveries (job_id, telegram_message_id, telegram_file_id)
      VALUES (${job.id}, ${ctx.message.message_id}, ${fileId})
    `

    await logStatusChange(job.id, job.status, 'delivered', 'bot')

    await logInfo('reply_matched',
      `Video für ${job.platform}-Job als geliefert gespeichert`,
      { job_id: job.id, platform: job.platform, reply_to_message_id: replyToId },
      job.agency_id
    )

    await ctx.reply(`✅ ${job.platform}-Video als geliefert gespeichert.`)

  } catch (err) {
    await logError('reply_handler_error', err.message, { reply_to_message_id: replyToId, chat_id: chatId, stack: err.stack })
    console.error('onReply error:', err)
  }
}
