import messages_en from "../locales/en.json";
import { axiosWithAuth } from "./AxiosInstance";

export interface II18nConfig {
  locale: ISupportedLangs | "custom";
  messages: Record<string, string>;
}

// Add here new new supported languages literals
export enum ISupportedLangs {
  en = "en",
}

const messages = {};

// Load here the compiled messages for each supported language
messages[ISupportedLangs.en] = messages_en;

export default class I18n {
  public static getDefaulI18nConfig(): II18nConfig {
    return { locale: ISupportedLangs.en, messages: messages[ISupportedLangs.en] };
  }

  public static getI18nConfig(lang: ISupportedLangs): II18nConfig {
    if (lang && ISupportedLangs[lang]) {
      return { locale: lang, messages: messages[lang] };
    } else {
      return this.getDefaulI18nConfig();
    }
  }

  public static async getCustomI18nConfig(lang: ISupportedLangs) {
    try {
      const customMessages = (await axiosWithAuth.get<Record<string, string>>("custom_locale.json"))
        .data;
      if (Object.keys(customMessages).length === 0) {
        throw new Error("Empty custom locale");
      }
      return { locale: lang, messages: customMessages };
    } catch (err) {
      if (lang && ISupportedLangs[lang]) {
        return this.getI18nConfig(lang);
      } else {
        return this.getDefaulI18nConfig();
      }
    }
  }
}
