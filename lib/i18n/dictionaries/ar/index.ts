import type { TranslationKey } from "../en";
import { common } from "./common";
import { publicMessages } from "./public";
import { account } from "./account";
import { content } from "./content";

export const ar: Record<TranslationKey, string> = {
  ...common,
  ...publicMessages,
  ...account,
  ...content,
};
