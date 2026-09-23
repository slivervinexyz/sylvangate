import { STATUS_DICTIONARY_STEP1_BOTTOM } from "./status-dictionary-step1-bottom";
import { STATUS_DICTIONARY_STEP1_TOP } from "./status-dictionary-step1-top";

export const STATUS_DICTIONARY_STEP1 = {
  ...STATUS_DICTIONARY_STEP1_TOP,
  ...STATUS_DICTIONARY_STEP1_BOTTOM,
} as const;
