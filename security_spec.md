# Security Specification — by Adisss Firestore Rules

## 1. Data Invariants
- All collections are locked by default (`allow read, write: if false`) unless explicitly matched.
- Only verified email identities (`request.auth.token.email_verified == true`) can authenticate against Firestore rules.
- `/users/{userId}` documents strictly bind `data.uid == userId`, require exact schema keys (`hasAll` + `hasOnly`), enforce server timestamps (`request.time`), preserve `uid` and `createdAt` immutably, and prevent non-admin users from setting `isAdmin: true` or elevated `role`.
- `/admins/{adminUid}` documents strictly bind `data.uid == adminUid`, require `isAdmin: true` and `role in ['super_admin', 'admin', 'editor']`, enforce server timestamps (`request.time`), and preserve `uid` and `createdAt` immutably after creation.
- Only verified super-admins (or the bootstrapped owner `ejafebriansyah3@gmail.com`) can assign admin flags/roles or delete user/admin records, and cannot self-delete.
- No collection permits unauthenticated writes or arbitrary `list` scraping (`allow list` never calls `get()`/`exists()` and restricts rows to the owner or own UID).

## 2. Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/uid123` or `/admins/uid123`.
2. Read/write on any unknown collection `/products/1` or `/test/connection`.
3. Unverified email (`email_verified: false`) attempting `/users/uid123` or `/admins/uid123` read/write even with owner email.
4. Non-owner user attempting `create` on `/users/{ownUid}` with `isAdmin: true` or `role: "admin"` / `"super_admin"`.
5. Non-owner user attempting `update` on `/users/{ownUid}` to escalate `isAdmin` from `false` to `true` or change `role`.
6. Non-super-admin attempting `create` on `/admins/attacker` to self-assign `role: "super_admin"`.
7. Shadow field injection (`extraAdminFlag: true`) in `create` or `update` payload on `/users/{uid}` or `/admins/{uid}`.
8. Oversized document ID (> 128 chars) or invalid characters (`../bad`) in document path.
9. Mismatched `data.uid !== userId` or `data.uid !== adminUid` during creation.
10. Client-spoofed `createdAt` or `updatedAt` timestamp differing from `request.time`.
11. Update attempting to mutate immutable `uid` or `createdAt` fields.
12. Non-owner attempting `list` query on `/users` or `/admins`.
