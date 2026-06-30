import type { Dict } from './types';
import { commonDict } from './dict/common';
import { settingsDict } from './dict/settings';
import { chatDict } from './dict/chat';
import { fileTreeDict } from './dict/file-tree';
import { onboardingDict } from './dict/onboarding';
import { toolsDict } from './dict/tools';
import { dialogsDict } from './dict/dialogs';
import { tutorialDict } from './dict/tutorial';

export const dict: Dict = {
  ...commonDict,
  ...settingsDict,
  ...chatDict,
  ...fileTreeDict,
  ...onboardingDict,
  ...toolsDict,
  ...dialogsDict,
  ...tutorialDict,
};

export type { DictEntry, Dict } from './types';
