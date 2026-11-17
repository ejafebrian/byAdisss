# Security Specification — by Adisss Firestore Rules

## 1. Data Invariants
- All collections are locked by default (`allow read, write: if false`) unless explicitly matched.
- Only verified email identities (`request.auth.token.email_verified == true`) can authenticate against Firestore rules.
- `/admins/{adminUid}` documents strictly bind `data.uid == adminUid`, require exact schema keys (`hasAll` + `hasOnly`), enforce server timestamps (`request.time`), and preserve `uid` and `createdAt` immutably after creation.
- Only verified super-admins (or the bootstrapped owner `ejafebriansyah3@gmail.com`) can create, update, or delete admin records, and cannot self-delete.
- No collection permits unauthenticated writes or arbitrary `list` scraping (`allow list` never calls `get()`/`exists()` and restricts rows to the owner or own UID).

## 2. Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/admins/uid123`.
2. Read/write on any unknown collection `/products/1` or `/test/connection`.
3. Unverified email (`email_verified: false`) attempting `/admins/uid123` read/write even with owner email.
4. Non-super-admin attempting `create` on `/admins/attacker` to self-assign `role: "super_admin"`.
5. Shadow field injection (`extraAdminFlag: true`) in `create` payload on `/admins/{uid}`.
6. Oversized `adminUid` (> 128 chars) or invalid characters (`../bad`) in document path.
7. Mismatched `data.uid !== adminUid` during admin document creation.
8. Client-spoofed `createdAt` or `updatedAt` timestamp differing from `request.time`.
9. Update attempting to mutate immutable `uid` or `createdAt` fields.
10. Update introducing unexpected keys outside `['email', 'role', 'isActive', 'updatedAt']`.
11. Invalid `role` enum value (e.g. `role: "root"`) or non-boolean `isActive`.
12. Non-owner attempting `list` query on `/admins`.
