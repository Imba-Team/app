import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterRequestDto } from 'src/modules/auth/dtos/register.dto';
import { CreateFlashcardDto } from 'src/modules/flashcard/dtos/create-flashcard.dto';
import { CreateStudySetDto } from 'src/modules/study-set/dtos/create-study-set.dto';
import { CreateStudySetTagDto } from 'src/modules/study-set-tag/dto/create-study-set-tag.dto';
import { UpdateMyProfileDto } from 'src/modules/users/dtos/update-my-profile.dto';
import { UpdateUserDto } from 'src/modules/users/dtos/update-user.dto';

import { textLimits } from './text-limits';

/** Properties that failed validation. */
function invalid<T extends object>(
  cls: new () => T,
  plain: Record<string, unknown>,
): string[] {
  return validateSync(plainToInstance(cls, plain)).map((e) => e.property);
}

const card = { term: 'term', definition: 'definition' };

describe('free-text DTO limits (MIM-49)', () => {
  it('accepts HTML-looking card content', () => {
    expect(
      invalid(CreateFlashcardDto, {
        term: 'List<String>',
        definition: '<p> is the paragraph element',
      }),
    ).toEqual([]);
  });

  it('caps every card text field', () => {
    const tooLong = (n: number) => 'x'.repeat(n + 1);
    expect(
      invalid(CreateFlashcardDto, {
        term: tooLong(textLimits.cardTerm),
        definition: tooLong(textLimits.cardDefinition),
        example: tooLong(textLimits.cardExample),
        phonetic: tooLong(textLimits.cardPhonetic),
        hint: tooLong(textLimits.cardHint),
      }).sort(),
    ).toEqual(['definition', 'example', 'hint', 'phonetic', 'term']);
  });

  it.each([
    ['https://cdn.mimir.app/cards/abc.jpg', true],
    ['http://localhost:9002/images/abc.jpg', true],
    ['images/3f2c-abc.jpg', true],
    ['javascript:alert(1)', false],
    ['data:image/svg+xml;base64,PHN2Zz4=', false],
    ['//evil.example/x.png', false],
    ['https://cdn.mimir.app/a b.jpg', false],
  ])('card imageUrl %s → valid=%s', (imageUrl, ok) => {
    expect(invalid(CreateFlashcardDto, { ...card, imageUrl })).toEqual(
      ok ? [] : ['imageUrl'],
    );
  });

  it('rejects javascript: profile pictures on the admin update', () => {
    expect(
      invalid(UpdateUserDto, { profilePicture: 'javascript:alert(1)' }),
    ).toEqual(['profilePicture']);
    expect(
      invalid(UpdateUserDto, { profilePicture: 'avatars/u-1.webp' }),
    ).toEqual([]);
  });

  it('caps set title, description and language', () => {
    expect(
      invalid(CreateStudySetDto, {
        title: 'x'.repeat(textLimits.setTitle + 1),
        description: 'x'.repeat(textLimits.setDescription + 1),
        language: 'x'.repeat(textLimits.language + 1),
      }).sort(),
    ).toEqual(['description', 'language', 'title']);
  });

  it('applies the tag name bounds when tagging a set', () => {
    const studySetId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';
    expect(
      invalid(CreateStudySetTagDto, {
        studySetId,
        tagName: 'x'.repeat(textLimits.tagName + 1),
      }),
    ).toEqual(['tagName']);
    expect(invalid(CreateStudySetTagDto, { studySetId, tagName: 'x' })).toEqual(
      ['tagName'],
    );
  });

  it('rejects angle brackets and overlong names', () => {
    const base = { email: 'a@b.co', password: 'password123' };
    expect(
      invalid(RegisterRequestDto, { ...base, username: '<img src=x>' }),
    ).toEqual(['username']);
    expect(
      invalid(RegisterRequestDto, { ...base, username: 'x'.repeat(51) }),
    ).toEqual(['username']);
    expect(
      invalid(RegisterRequestDto, { ...base, username: 'Zoë O’Neil' }),
    ).toEqual([]);
    expect(invalid(UpdateMyProfileDto, { name: '<b>Bob</b>' })).toEqual([
      'name',
    ]);
  });
});
