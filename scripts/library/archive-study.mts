/** Explicit local export; never writes into the site's public/live reports. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { BOOK_STUDY_ARCHIVE } from '../../server/library/bookStudyArchive';
const directory = new URL('../../.data/library/', import.meta.url);
mkdirSync(directory, { recursive: true });
const file = new URL('book-study-archive.json', directory);
writeFileSync(file, JSON.stringify(BOOK_STUDY_ARCHIVE, null, 2) + '\n', { mode: 0o600 });
console.log('Internal archive: .data/library/book-study-archive.json');
console.log(`${BOOK_STUDY_ARCHIVE.books.length} references queued; full-text reading and scientific review have not started. No public memory or training data changed.`);
