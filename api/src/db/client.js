import postgres from 'postgres'
import { config } from 'dotenv'
config()

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', prepare: false })
export default sql
