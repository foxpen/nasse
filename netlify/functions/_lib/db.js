import { neon } from '@neondatabase/serverless';

const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
export const sql = neon(url);
