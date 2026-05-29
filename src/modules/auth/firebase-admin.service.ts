import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';

export interface FirebaseIdentity {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}

/**
 * Verifies Firebase ID tokens for the mobile app's Google sign-in.
 *
 * This is intentionally isolated from the existing web Google OAuth flow
 * (`/auth/google`): the website keeps using Passport + cookies, while the app
 * obtains a Firebase ID token client-side and exchanges it here for the app's
 * own JWT. `firebase-admin` is loaded lazily so the rest of the server boots
 * and builds even when the package or credentials are not yet configured.
 */
@Injectable()
export class FirebaseAdminService {
  private readonly logger = new Logger(FirebaseAdminService.name);
  // Cached firebase-admin `auth` instance once initialized.
  private authInstance: unknown | null = null;

  private async getAuth(): Promise<{
    verifyIdToken: (token: string) => Promise<Record<string, unknown>>;
  }> {
    if (this.authInstance) {
      return this.authInstance as never;
    }

    let admin: typeof import('firebase-admin');
    try {
      admin = await import('firebase-admin');
    } catch {
      throw new InternalServerErrorException(
        'firebase-admin is not installed. Run `npm i firebase-admin`.',
      );
    }

    if (admin.apps.length === 0) {
      const credential = this.resolveCredential(admin);
      admin.initializeApp(credential ? { credential } : undefined);
    }

    this.authInstance = admin.auth();
    return this.authInstance as never;
  }

  /**
   * Builds an admin credential from environment configuration. Supports a raw
   * JSON service account (FIREBASE_SERVICE_ACCOUNT), a base64-encoded one
   * (FIREBASE_SERVICE_ACCOUNT_BASE64), or falls back to Application Default
   * Credentials (GOOGLE_APPLICATION_CREDENTIALS).
   */
  private resolveCredential(
    admin: typeof import('firebase-admin'),
  ): import('firebase-admin').credential.Credential | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    try {
      if (raw) {
        return admin.credential.cert(JSON.parse(raw));
      }
      if (b64) {
        return admin.credential.cert(
          JSON.parse(Buffer.from(b64, 'base64').toString('utf8')),
        );
      }
    } catch (err) {
      this.logger.error('Invalid FIREBASE_SERVICE_ACCOUNT', err as Error);
      throw new InternalServerErrorException(
        'Firebase service account is misconfigured.',
      );
    }
    // Application Default Credentials (e.g. GOOGLE_APPLICATION_CREDENTIALS).
    return admin.credential.applicationDefault();
  }

  async verifyIdToken(idToken: string): Promise<FirebaseIdentity> {
    const auth = await this.getAuth();
    let decoded: Record<string, unknown>;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (err) {
      this.logger.warn(`Firebase token verification failed: ${String(err)}`);
      throw new UnauthorizedException('Invalid Firebase ID token');
    }

    const uid = decoded['uid'] as string | undefined;
    if (!uid) {
      throw new UnauthorizedException('Firebase token missing uid');
    }
    return {
      uid,
      email: (decoded['email'] as string | undefined) ?? null,
      name:
        (decoded['name'] as string | undefined) ??
        (decoded['email'] as string | undefined)?.split('@')[0] ??
        'Explorer',
      picture: (decoded['picture'] as string | undefined) ?? null,
    };
  }
}
