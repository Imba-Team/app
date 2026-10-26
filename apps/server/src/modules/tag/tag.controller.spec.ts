import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/guards/roles.guard';
import { TagController } from './tag.controller';

// Runs the real RolesGuard against the real route metadata, so a missing
// @Roles(Role.ADMIN) on a handler fails here instead of in production.
const contextFor = (
  handler: keyof TagController,
  role: Role,
): ExecutionContext =>
  ({
    getHandler: () => TagController.prototype[handler],
    getClass: () => TagController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as unknown as ExecutionContext;

describe('TagController role requirements', () => {
  const guard = new RolesGuard(new Reflector());

  it.each(['update', 'delete'] as const)(
    'rejects a regular user on %s',
    (handler) => {
      expect(() => guard.canActivate(contextFor(handler, Role.USER))).toThrow(
        ForbiddenException,
      );
    },
  );

  it.each(['update', 'delete'] as const)('allows an admin on %s', (handler) => {
    expect(guard.canActivate(contextFor(handler, Role.ADMIN))).toBe(true);
  });

  it('still lets a regular user create tags', () => {
    expect(guard.canActivate(contextFor('create', Role.USER))).toBe(true);
  });
});
