import { z } from 'zod'

export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      return res.status(400).json({
        error: 'Ungültige Eingabe',
        details: result.error.flatten().fieldErrors,
      })
    }
    req.body = result.data
    next()
  }
}

export const loginSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(1, 'Passwort erforderlich'),
})

export const setupUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'agency', 'creator']),
  agency_id: z.string().uuid().optional().nullable(),
  creator_id: z.string().uuid().optional().nullable(),
})

export const agencySchema = z.object({
  name: z.string().min(1, 'Name erforderlich'),
  contact_person: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_zip: z.string().optional().nullable(),
  address_country: z.string().default('DE'),
  notes: z.string().optional().nullable(),
  login_email: z.string().email('Login-E-Mail erforderlich'),
  login_password: z.string().min(8, 'Passwort min. 8 Zeichen'),
})

export const agencyUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  contact_person: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  address_street: z.string().optional().nullable(),
  address_city: z.string().optional().nullable(),
  address_zip: z.string().optional().nullable(),
  address_country: z.string().optional(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
})

export const creatorSchema = z.object({
  real_name: z.string().min(1, 'Bürgerlicher Name erforderlich'),
  artist_name: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  platforms: z.array(z.enum(['IG','TK','OF','FL','ML','OTHER'])).min(1, 'Mind. eine Plattform'),
  notes: z.string().optional().nullable(),
  agency_id: z.string().uuid('Agentur erforderlich'),
  login_email: z.string().email('Login-E-Mail erforderlich'),
  login_password: z.string().min(8, 'Passwort min. 8 Zeichen'),
})

export const creatorUpdateSchema = z.object({
  agency_id: z.string().uuid().optional().nullable(),
  real_name: z.string().min(1).optional(),
  artist_name: z.string().optional().nullable(),
  photo_url: z.string().optional().nullable(),
  contact_email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthday: z.string().optional().nullable(),
  platforms: z.array(z.enum(['IG','TK','OF','FL','ML','OTHER'])).optional(),
  notes: z.string().optional().nullable(),
  telegram_chat_id: z.number().int().optional().nullable(),
  active: z.boolean().optional(),
})

export const jobSchema = z.object({
  creator_id: z.string().uuid(),
  week_number: z.number().int().min(1).max(53),
  year: z.number().int().min(2024),
  platform: z.enum(['IG','TK','OF','FL','ML','OTHER']),
  content_type: z.enum(['clip','reel','script','other']).default('clip'),
  source_link: z.string().optional().nullable(),
})

export const jobStatusSchema = z.object({
  status: z.enum(['open','in_progress','delivered','confirmed','carried']),
  note: z.string().optional(),
})

export const contentPlanSchema = z.object({
  week_number: z.number().int().min(1).max(53),
  year: z.number().int().min(2024),
  platform: z.enum(['IG','TK','OF','FL','ML','OTHER']),
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source_link: z.string().optional().nullable(),
  status: z.enum(['idea','planned','filming','done']).default('idea'),
  visible_to_agency: z.boolean().default(false),
  partner_type: z.enum(['solo','partner']).default('solo'),
  carried_over_from: z.string().uuid().optional().nullable(),
  requisiten: z.string().optional().nullable(),
  kleidung: z.string().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  location_tags: z.array(z.enum(['outdoor','indoor','auto','stadt'])).optional().default([]),
})

export const contentPlanUpdateSchema = z.object({
  title: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  source_link: z.string().optional().nullable(),
  status: z.enum(['idea','planned','filming','done']).optional(),
  visible_to_agency: z.boolean().optional(),
  platform: z.enum(['IG','TK','OF','FL','ML','OTHER']).optional(),
  partner_type: z.enum(['solo','partner']).optional(),
  week_number: z.number().int().min(1).max(53).optional().nullable(),
  year: z.number().int().min(2024).optional().nullable(),
  pushed_to_week: z.number().int().optional().nullable(),
  pushed_to_year: z.number().int().optional().nullable(),
  requisiten: z.string().optional().nullable(),
  kleidung: z.string().optional().nullable(),
  account_id: z.string().uuid().optional().nullable(),
  is_top_video: z.boolean().optional(),
  location_tags: z.array(z.enum(['outdoor','indoor','auto','stadt'])).optional(),
})
