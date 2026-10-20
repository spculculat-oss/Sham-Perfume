/** «بنك شام» vocabularies shared by the server, the admin panel and the store (no server code). */
export const EXPENSE_CATEGORIES = ['ai', 'marketing', 'shipping', 'salaries', 'rent', 'software', 'fees', 'other'] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
/** Ways a buyer pays the store directly, with no payment gateway in between. */
export const COLLECTION_KINDS = ['instapay', 'bank_transfer', 'wallet', 'cod'] as const;
export type CollectionKind = typeof COLLECTION_KINDS[number];
