import { getDatabase } from '@netlify/database';

// @netlify/database si sam vyresi spravne read-write pripojeni k produkcni
// vetvi - rucni cteni DATABASE_URL/NETLIFY_DATABASE_URL davalo jen read-only
// connection string a zapisy (INSERT/UPDATE/DELETE) padaly na permission denied.
let sqlFn;
try {
  sqlFn = getDatabase().sql;
} catch (e) {
  sqlFn = () => {
    throw new Error('Pripojeni k databazi selhalo: ' + (e?.message || e));
  };
}
export const sql = sqlFn;
