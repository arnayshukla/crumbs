import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dataDir = process.env.DATA_DIR || './data';
const databasePath = process.env.DATABASE_URL || join(dataDir, 'crumbs.db');
const pending = join(dataDir, 'restore-pending');
const pendingDatabase = join(pending, 'crumbs.db');
const pendingAttachments = join(pending, 'attachments');

if (existsSync(pendingDatabase)) {
	JSON.parse(await readFile(join(pending, 'manifest.json'), 'utf8'));
	const timestamp = new Date().toISOString().replaceAll(':', '-');
	const safety = join(dataDir, `restore-safety-${timestamp}`);
	await mkdir(safety, { recursive: true });
	if (existsSync(databasePath)) await cp(databasePath, join(safety, 'crumbs.db'));
	for (const suffix of ['-wal', '-shm']) {
		if (existsSync(`${databasePath}${suffix}`)) await cp(`${databasePath}${suffix}`, join(safety, `crumbs.db${suffix}`));
	}
	const liveAttachments = join(dataDir, 'attachments');
	if (existsSync(liveAttachments)) await cp(liveAttachments, join(safety, 'attachments'), { recursive: true });

	await mkdir(dirname(databasePath), { recursive: true });
	await cp(pendingDatabase, databasePath);
	await rm(`${databasePath}-wal`, { force: true });
	await rm(`${databasePath}-shm`, { force: true });
	const previousAttachments = join(dataDir, '.attachments-before-restore');
	await rm(previousAttachments, { recursive: true, force: true });
	if (existsSync(liveAttachments)) await rename(liveAttachments, previousAttachments);
	try {
		await rename(pendingAttachments, liveAttachments);
	} catch (error) {
		if (existsSync(previousAttachments)) await rename(previousAttachments, liveAttachments);
		await cp(join(safety, 'crumbs.db'), databasePath);
		throw error;
	}
	await rm(previousAttachments, { recursive: true, force: true });
	await rm(pending, { recursive: true, force: true });
	console.log(`Applied staged Crumbs restore. Safety snapshot: ${safety}`);
}
