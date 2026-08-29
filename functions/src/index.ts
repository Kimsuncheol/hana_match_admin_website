import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { resolveAdminAssignment } from "./adminAssignment";

initializeApp();

// Configure via: firebase functions:config or, for v2, an env var / param
// set at deploy time. Comma-separated domains, no "@". Leave unset to allow
// any domain to receive the default admin role on sign-up.
const adminAllowedEmailDomains = defineString("ADMIN_ALLOWED_EMAIL_DOMAINS", {
  default: "",
});

/**
 * Runs server-side as part of account creation, before the account exists.
 * This is the only place the "admin" custom claim is ever granted — the
 * client never sets or requests it directly, so there is nothing for a
 * browser to spoof or escalate.
 *
 * Requires Identity Platform (blocking functions) to be enabled for this
 * Firebase project: Authentication > Settings > Blocking functions.
 */
export const assignDefaultAdminRole = beforeUserCreated(async (event) => {
  const user = event.data;
  if (!user) {
    // No user record on the event: nothing to grant a claim to.
    return { customClaims: { admin: false, role: "unassigned" } };
  }
  const decision = resolveAdminAssignment(user.email, adminAllowedEmailDomains.value());

  logger.info("admin-assignment-decision", {
    uid: user.uid,
    email: user.email,
    ...decision,
  });

  // Best-effort profile write. Blocking functions run under a tight
  // deadline (a few seconds) before the identity platform request times
  // out, so this must stay fast and must never block granting/withholding
  // the claim above.
  try {
    await getFirestore()
      .collection("adminProfiles")
      .doc(user.uid)
      .set({
        email: user.email ?? null,
        role: decision.role,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (err) {
    logger.error("admin-profile-write-failed", { uid: user.uid, err: String(err) });
  }

  return {
    customClaims: {
      admin: decision.admin,
      role: decision.role,
    },
  };
});
