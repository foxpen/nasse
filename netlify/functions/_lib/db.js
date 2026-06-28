import { neon } from '@neondatabase/serverless';

const url = process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL;
export const sql = url
  ? neon(url)
  : () => {
      throw new Error('DATABASE_URL nebo NETLIFY_DATABASE_URL není nastavená');
    };
