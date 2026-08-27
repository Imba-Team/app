export type ModuleProgress = {
  not_started: number;
  in_progress: number;
  completed: number;
  completedTerms: number;
};

export type ModuleInfo = {
  title: string;
  description: string;
  termsCount: number;
  isPrivate: boolean;
  progress?: ModuleProgress;
  ownerImg: string;
  ownerName: string;
  isCollected?: boolean;
  isOwner?: boolean;
};

export type ModuleResponse = {
  data: ModuleInfo;
};

export type Term = {
  id: string;
  term: string;
  definition: string;
  isStarred: boolean;
};
export type TermProgress = {
  status: "not_started" | "in_progress" | "completed";
};

export type ApiTerm = {
  id: string;
  term: string;
  definition: string;
  isStarred?: boolean;
};
