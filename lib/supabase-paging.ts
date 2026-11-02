/**
 * lib/supabase-paging.ts
 *
 * PostgREST returns at most 1,000 rows per request, silently. Pages that need
 * "everything" (BK history, monthly overview) use this to fetch consecutive pages
 * instead of letting the first page quietly become the whole data set.
 */
const PAGE = 1000;

export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  maxPages = 20,
): Promise<T[]> {
  const rows: T[] = [];
  for (let i = 0; i < maxPages; i++) {
    const { data, error } = await page(i * PAGE, i * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}
