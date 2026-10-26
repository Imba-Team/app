import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from './user-response.dto';

const toDto = (user: object) =>
  plainToInstance(UserResponseDto, user, { excludeExtraneousValues: true });

describe('UserResponseDto.name', () => {
  it('uses the display name when one is set', () => {
    const dto = toDto({ username: 'jane-doe', displayName: 'Jane Doe' });

    expect(dto.name).toBe('Jane Doe');
    expect(dto.username).toBe('jane-doe');
  });

  it('falls back to the username for users without a display name', () => {
    expect(toDto({ username: 'jane-doe', displayName: null }).name).toBe(
      'jane-doe',
    );
  });
});
