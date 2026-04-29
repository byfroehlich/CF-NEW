import sql from '../db/client.js'

export async function log(level, event, message, metadata = {}, agencyId = null) {
  try {
    await sql`
      INSERT INTO logs (level, source, event, message, metadata, agency_id)
      VALUES (${level}, 'bot', ${event}, ${message}, ${JSON.stringify(metadata)}, ${agencyId})
    `
  } catch (err) {
    // Logger darf niemals den Bot crashen
    console.error('Logger DB error:', err.message)
  }
  const ts = new Date().toISOString()
  console.log(`[${ts}] [${level.toUpperCase()}] ${event}: ${message}`)
}

export async function logStatusChange(jobId, oldStatus, newStatus, source = 'bot', userId = null) {
  try {
    await sql`
      INSERT INTO job_status_history (job_id, old_status, new_status, changed_by, changed_by_source)
      VALUES (${jobId}, ${oldStatus}, ${newStatus}, ${userId}, ${source})
    `
  } catch (err) {
    console.error('Status history error:', err.message)
  }
}

export const logInfo  = (event, msg, meta, agencyId) => log('info',  event, msg, meta, agencyId)
export const logWarn  = (event, msg, meta, agencyId) => log('warn',  event, msg, meta, agencyId)
export const logError = (event, msg, meta, agencyId) => log('error', event, msg, meta, agencyId)
