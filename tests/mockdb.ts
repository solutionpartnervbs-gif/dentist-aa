type Row = Record<string, string | number | null>;

export type MockDb = {
  prepare(query: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean }>;
    };
  };
  exec(query: string): Promise<unknown>;
};

function likeMatch(value: string | number | null, pattern: string): boolean {
  const inner = String(pattern).replace(/^%|%$/g, '').toLowerCase();
  return String(value ?? '').toLowerCase().includes(inner);
}

export function makeMockDb(seed: Row[] = []): MockDb {
  const rows: Row[] = seed.map((r) => ({ ...r }));
  return {
    async exec() {
      return [];
    },
    prepare(query: string) {
      const q = query.trim().toUpperCase();
      return {
        bind(...values: unknown[]) {
          const vals = values as (string | number | null)[];
          const matchWhere = (): Row[] => {
            let out = rows.slice();
            let i = 0;
            const take = () => vals[i++] as string;
            const condRe =
              /APPOINTMENT_DATE = \?|APPOINTMENT_TIME = \?|REMINDER_SENT = \?|STATUS = \?|STATUS=\?|PATIENT_PHONE = \?|ID != \?|ID <> \?|ID = \?|PATIENT_NAME LIKE \?/g;
            let m: RegExpExecArray | null;
            while ((m = condRe.exec(q)) !== null) {
              const cond = m[0];
              if (cond === 'APPOINTMENT_DATE = ?') {
                const date = take();
                out = out.filter((r) => r['appointment_date'] === date);
              } else if (cond === 'APPOINTMENT_TIME = ?') {
                const time = take();
                out = out.filter((r) => r['appointment_time'] === time);
              } else if (cond === 'STATUS = ?' || cond === 'STATUS=?') {
                const status = take();
                out = out.filter((r) => r['status'] === status);
              } else if (cond === 'REMINDER_SENT = ?') {
                const flag = take();
                out = out.filter((r) => Number(r['reminder_sent']) === Number(flag));
              } else if (cond === 'PATIENT_PHONE = ?') {
                const phone = take();
                out = out.filter((r) => r['patient_phone'] === phone);
              } else if (cond === 'ID != ?' || cond === 'ID <> ?') {
                const id = take();
                out = out.filter((r) => r['id'] !== id);
              } else if (cond === 'ID = ?') {
                const id = take();
                out = out.filter((r) => r['id'] === id);
              } else if (cond === 'PATIENT_NAME LIKE ?') {
                const p = take();
                take();
                out = out.filter(
                  (r) =>
                    likeMatch(r['patient_name'], p) ||
                    likeMatch(r['patient_phone'], p),
                );
              }
            }
            return out;
          };
          return {
            async all<T>(): Promise<{ results: T[] }> {
              if (q.startsWith('SELECT')) return { results: matchWhere() as T[] };
              return { results: [] };
            },
            async run(): Promise<{ success: boolean }> {
              if (q.startsWith('INSERT')) {
                const [
                  id,
                  patient_name,
                  patient_phone,
                  patient_email,
                  service_type,
                  appointment_date,
                  appointment_time,
                  created_at,
                ] = vals as [
                  string,
                  string,
                  string,
                  string | null,
                  string,
                  string,
                  string,
                  string,
                ];
                const taken = rows.some(
                  (r) =>
                    r['appointment_date'] === appointment_date &&
                    r['appointment_time'] === appointment_time &&
                    r['status'] === 'confirmed',
                );
                if (taken) throw new Error('SLOT_TAKEN');
                rows.push({
                  id,
                  patient_name,
                  patient_phone,
                  patient_email,
                  service_type,
                  appointment_date,
                  appointment_time,
                  status: 'confirmed',
                  reminder_sent: 0,
                  created_at,
                });
                return { success: true };
              }
              if (q.startsWith('UPDATE')) {
                const [setClause, whereClause = ''] = query.split(/WHERE/i);
                const assignments = [
                  ...setClause.matchAll(/(\w+)\s*=\s*(\?|'[^']*'|\d+)/g),
                ];
                let si = 0;
                const setPairs: [string, string | number | null][] =
                  assignments.map((a) => [
                    a[1].toLowerCase(),
                    a[2] === '?'
                      ? (vals[si++] as string | number | null)
                      : a[2].startsWith("'")
                        ? a[2].slice(1, -1)
                        : Number(a[2]),
                  ]);
                const whereVals = vals.slice(si) as string[];
                const wq = whereClause.toUpperCase();
                let out = rows.slice();
                let i = 0;
                const takeW = () => whereVals[i++] as string;
                if (wq.includes('ID = ?')) {
                  const id = takeW();
                  out = out.filter((r) => r['id'] === id);
                }
                if (wq.includes('PATIENT_PHONE = ?')) {
                  const phone = takeW();
                  out = out.filter((r) => r['patient_phone'] === phone);
                }
                if (wq.includes('APPOINTMENT_DATE = ?')) {
                  const date = takeW();
                  out = out.filter((r) => r['appointment_date'] === date);
                }
                if (wq.includes("STATUS = ?") || wq.includes('STATUS=?')) {
                  const status = takeW();
                  out = out.filter((r) => r['status'] === status);
                }
                let n = 0;
                for (const r of out) {
                  for (const [c, v] of setPairs) {
                    r[c] = v ?? null;
                  }
                  n++;
                }
                return { success: n > 0 };
              }
              if (q.startsWith('DELETE')) {
                const id = vals[0] as string;
                const before = rows.length;
                for (let i = rows.length - 1; i >= 0; i--) {
                  if (rows[i]['id'] === id) rows.splice(i, 1);
                }
                void before;
                return { success: rows.length < before };
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}
