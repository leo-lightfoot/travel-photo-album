export async function upsertSubscriber(db, email) {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO subscribers (email, first_verified_at, last_verified_at, verify_count)
     VALUES (?1, ?2, ?2, 1)
     ON CONFLICT(email) DO UPDATE SET
       last_verified_at = ?2,
       verify_count = verify_count + 1`
  ).bind(email, now).run();
}

export async function listSubscribers(db) {
  const { results } = await db.prepare(
    `SELECT email, first_verified_at, last_verified_at, verify_count
     FROM subscribers ORDER BY first_verified_at`
  ).all();
  return results;
}
