# Security Specification — by Adisss Firestore Rules

## 1. Data Invariants
- All collections are locked by default (`allow read, write: if false`) unless explicitly matched.
- Only verified email identities (`request.auth.token.email_verified == true`) can authenticate against Firestore rules.
- `/users/{userId}` documents strictly bind `data.uid == userId`, require exact schema keys (`hasAll` + `hasOnly`), enforce server timestamps (`request.time`), preserve `uid` and `createdAt` immutably, and prevent non-admin users from setting `isAdmin: true` or elevated `role` unless they hold a valid, active matching `/admin_invites/{inviteId}` record created by a Super Admin.
- `/admins/{adminUid}` documents strictly bind `data.uid == adminUid`, require `isAdmin: true` and `role in ['super_admin', 'admin', 'editor']`, enforce server timestamps (`request.time`), and preserve `uid` and `createdAt` immutably after creation.
- `/admin_invites/{inviteId}` documents strictly require Super Admin authority for create/update/delete, bind `inviteId` deterministically from normalized email (`email.lower().replace('[^a-z0-9]', '_')`), and can only be read by admins or the matching verified email owner.
- Only verified super-admins (or the bootstrapped owner `ejafebriansyah3@gmail.com`) can assign admin flags/roles, manage invites, or delete user/admin records, and cannot self-delete.
- No collection permits unauthenticated writes or arbitrary `list` scraping (`allow list` never calls `get()`/`exists()` and restricts rows to the owner or own UID/email).

## 2. Dirty Dozen Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated read on `/users/uid123`, `/admins/uid123`, or `/admin_invites/test_gmail_com`.
2. Read/write on any unknown collection `/products/1` or `/test/connection`.
3. Unverified email (`email_verified: false`) attempting `/users/uid123` or `/admins/uid123` read/write even with owner email.
4. Non-owner user without an active `/admin_invites` record attempting `create` on `/users/{ownUid}` with `isAdmin: true` or `role: "admin"` / `"super_admin"`.
5. Non-owner user without an active `/admin_invites` record attempting `update` on `/users/{ownUid}` to escalate `isAdmin` from `false` to `true` or change `role`.
6. Non-super-admin attempting `create` on `/admins/attacker` or `/admin_invites/attacker_gmail_com` to self-assign `role: "super_admin"`.
7. Shadow field injection (`extraAdminFlag: true`) in `create` or `update` payload on `/users/{uid}`, `/admins/{uid}`, or `/admin_invites/{inviteId}`.
8. Oversized document ID (> 128 chars) or invalid characters (`../bad`) in document path.
9. Mismatched `data.uid !== userId` or `data.uid !== adminUid` during creation.
10. Client-spoofed `createdAt` or `updatedAt` timestamp differing from `request.time`.
11. Update attempting to mutate immutable `uid`, `createdAt`, or `createdByUid` fields.
12. Non-owner attempting `list` query on `/users`, `/admins`, or `/admin_invites`.
