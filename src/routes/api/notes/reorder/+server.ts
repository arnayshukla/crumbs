import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '$lib/server/api-utils.js';

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const body = await request.json();
	const orders: { id: string; sortOrder: number }[] = body.orders;

	if (!Array.isArray(orders)) {
		return json({ error: 'Invalid payload' }, { status: 400 });
	}

	db.transaction((tx) => {
		for (const { id, sortOrder } of orders) {
			tx.update(notes)
				.set({ sortOrder })
				.where(and(eq(notes.id, id), eq(notes.userId, userId)))
				.run();
		}
	});

	return json({ ok: true });
};
