import type { TranslationKey } from "../en";
import { common } from "./common";
import { publicMessages as publicMessages } from "./public";
import { account } from "./account";
import { content } from "./content";

export const es: Record<TranslationKey, string> = {
  ...common,
  ...publicMessages,
  ...account,
  ...content,
};