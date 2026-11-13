/**
 * Writes SALES_PLAYBOOK.md from src/sales/playbook.ts:
 *   node --import tsx scripts/shaheen-sales/playbook-doc.mts
 * The test tests/salesManager.test.ts fails when the file is out of date.
 */
import { writeFileSync } from 'node:fs';
import { salesPlaybookDoc } from '../../src/sales/playbook';

writeFileSync(new URL('../../SALES_PLAYBOOK.md', import.meta.url), `${salesPlaybookDoc()}\n`);
console.log('SALES_PLAYBOOK.md written');
