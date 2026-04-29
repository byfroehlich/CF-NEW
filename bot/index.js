import { Telegraf } from 'telegraf'
import { config } from 'dotenv'
import cron from 'node-cron'
import { handleMessage } from './src/handlers/onMessage.js'
import { handleReply }   from './src/handlers/onReply.js'
import { handleCommand } from './src/handlers/onCommand.js'
import { carryOverJobs } from './src/lib/weekHelper.js'
import { logInfo, logError } from './src/lib/logger.js'
import sql from './src/db/client.js'

config()

const bot = new Telegraf(process.env.BOT_TOKEN)

async function getKnownChatIds() {
  const creators = await sql`
    SELECT telegram_chat_id FROM creators
    WHERE telegram_chat_id IS NOT NULL AND active = true AND deleted_at IS NULL
  `
  return new Set(creators.map(c => String(c.telegram_chat_id)))
}

bot.on('message', async (ctx) => {
  try {
    const knownChats = await getKnownChatIds()
    if (!knownChats.has(String(ctx.chat.id))) return

    const msg = ctx.message
    if (msg.text?.startsWith('/'))                             return handleCommand(ctx)
    if (msg.reply_to_message && (msg.video || msg.document))  return handleReply(ctx)
    if (msg.text)                                             return handleMessage(ctx)
  } catch (err) {
    await logError('bot_message_error', err.message, { stack: err.stack })
  }
})

// Heartbeat alle 5 Minuten
cron.schedule('*/5 * * * *', async () => {
  await logInfo('heartbeat', 'Bot online')
})

// Montags 08:00 — offene Jobs in neue KW übertragen
cron.schedule('0 8 * * 1', async () => {
  try {
    const count = await carryOverJobs()
    await logInfo('carry_over', `${count} Jobs übertragen`)
  } catch (err) {
    await logError('cron_carry_over_failed', err.message, { stack: err.stack })
  }
})

// Täglich 03:00 — DSGVO Log-Cleanup
cron.schedule('0 3 * * *', async () => {
  try {
    await sql`DELETE FROM logs WHERE created_at < now() - interval '90 days'`
    await logInfo('log_cleanup', 'Alte Logs gelöscht')
  } catch (err) {
    console.error('Log-Cleanup error:', err.message)
  }
})

bot.launch()
await logInfo('bot_start', 'CreatorFlow Bot gestartet')
console.log('✅ CreatorFlow Bot gestartet')

process.once('SIGINT',  () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
