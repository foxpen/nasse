import { neon } from '@neondatabase/serverless';

// @netlify/database vyzaduje NETLIFY_DB_URL, kterou Netlify injektuje jen
// pri buildu pres propojeny Git repo - u CLI-only deploye (bez vlastniho
// repa) se nikdy nenastavi. Misto toho se pripojujeme primo vlastnim
// Neon projektem pres klasicky connection string.
const url = process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL;
export const sql = url
  ? neon(url)
  : () => {
      throw new Error('DATABASE_URL neni nastavena');
    };
