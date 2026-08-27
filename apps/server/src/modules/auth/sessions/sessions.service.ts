import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { LoggerService } from 'src/common/logger/logger.service';

export interface SessionSummary {
  id: string; // familyId — treated as the session identifier by the UI
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date; // session start (first token issued in the family)
  lastUsedAt: Date; // most recent token issuance in the family
  expiresAt: Date; // latest expiry — session dies when this passes
  isCurrent: boolean;
}

@Injectable()
export class SessionsService {
  private readonly context = 'SessionsService';

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(this.context);
  }

  /**
   * List active sessions for a user. A "session" here is a
   * refresh-token family: one row per family, summarised from the
   * latest non-revoked, non-expired token in that family.
   *
   * `currentFamilyId` (from the JWT `sid` claim) marks the caller's
   * own session so the UI can render a "This device" badge and
   * confirm the destructive intent when revoking.
   */
  async list(
    userId: string,
    currentFamilyId?: string,
  ): Promise<SessionSummary[]> {
    const now = new Date();

    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byFamily = new Map<
      string,
      {
        first: (typeof rows)[number];
        latest: (typeof rows)[number];
      }
    >();

    for (const row of rows) {
      const existing = byFamily.get(row.familyId);
      if (!existing) {
        byFamily.set(row.familyId, { first: row, latest: row });
      } else if (row.createdAt > existing.latest.createdAt) {
        existing.latest = row;
      }
    }

    return Array.from(byFamily.values())
      .map(({ first, latest }) => ({
        id: first.familyId,
        userAgent: latest.userAgent ?? first.userAgent,
        ipAddress: latest.ipAddress ?? first.ipAddress,
        createdAt: first.createdAt,
        lastUsedAt: latest.createdAt,
        expiresAt: latest.expiresAt,
        isCurrent:
          currentFamilyId !== undefined && first.familyId === currentFamilyId,
      }))
      .sort((a, b) => {
        // Current session first, then most-recently used.
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
        return b.lastUsedAt.getTime() - a.lastUsedAt.getTime();
      });
  }

  /**
   * Revoke every token in a family so the device can no longer refresh.
   * Returns whether the revoked session belonged to the caller — the
   * controller uses this to clear the caller's cookies and hint that
   * they've been logged out.
   *
   * Refuses to revoke a family that doesn't belong to the caller with
   * a 404 (rather than a 403) to avoid leaking family-id existence.
   */
  async revoke(
    userId: string,
    familyId: string,
    currentFamilyId?: string,
  ): Promise<{ wasCurrent: boolean }> {
    const anyRow = await this.prisma.refreshToken.findFirst({
      where: { familyId, userId },
      select: { id: true },
    });
    if (!anyRow) {
      throw new NotFoundException({
        ok: false,
        message: 'Session not found',
        code: 'SESSION_NOT_FOUND',
      });
    }

    await this.prisma.refreshToken.updateMany({
      where: { familyId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    this.logger.log(`Revoked session family=${familyId} user=${userId}`);

    return { wasCurrent: currentFamilyId === familyId };
  }
}
