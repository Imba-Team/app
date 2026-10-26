import { Prisma } from '@prisma/client';

/**
 * Restricts SRS cards to modules that are in the user's library: sets they
 * own or have collected. Removing a module from the library therefore
 * pauses its reviews without deleting progress — collecting it again
 * resumes from the same SM-2 state.
 */
export function inUserLibrary(userId: string): Prisma.FlashcardWhereInput {
  return {
    studySet: {
      OR: [{ ownerId: userId }, { favourites: { some: { userId } } }],
    },
  };
}
