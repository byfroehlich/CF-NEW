import sql from '../db/client.js'
import { logInfo, logError, logStatusChange } from './logger.js'

export function getCurrentWeek() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  return { week, year: d.getUTCFullYear() }
}

export async function carryOverJobs(creatorId = null) {
  const { week, year } = getCurrentWeek()
  const nextWeek = week >= 52 ? 1 : week + 1
  const nextYear = week >= 52 ? year + 1 : year

  try {
    const openJobs = await sql`
      SELECT * FROM jobs
      WHERE status = 'open'
      AND week_number <= ${week}
      AND year = ${year}
      AND deleted_at IS NULL
      ${creatorId ? sql`AND creator_id = ${creatorId}` : sql``}
    `

    for (const job of openJobs) {
      const [newJob] = await sql`
        INSERT INTO jobs
          (creator_id, agency_id, week_number, year, platform, content_type,
           source_link, source_message_id, carried_over_from)
        VALUES
          (${job.creator_id}, ${job.agency_id}, ${nextWeek}, ${nextYear},
           ${job.platform}, ${job.content_type}, ${job.source_link},
           ${job.source_message_id}, ${job.id})
        RETURNING id
      `
      await sql`UPDATE jobs SET status = 'carried' WHERE id = ${job.id}`
      await logStatusChange(job.id, 'open', 'carried', 'cron')
      await logStatusChange(newJob.id, null, 'open', 'cron')
    }

    await logInfo('cron_carry',
      `Übertrag: ${openJobs.length} Jobs von KW${week} nach KW${nextWeek}`,
      { count: openJobs.length, from_week: week, to_week: nextWeek, year }
    )

    return openJobs.length

  } catch (err) {
    await logError('cron_carry_error', err.message, { stack: err.stack })
    throw err
  }
}
