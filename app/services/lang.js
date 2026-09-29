import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";

export default class LangService extends Service {
  @service intl;
  
  get langName() {
    return this.isUkLang
      ? this.intl.t("site.uk-lang")
      : this.intl.t("site.ru-lang");
  }

  get isUkLang() {
    return this.intl.primaryLocale === "uk";
  }

  @action
  setDefaultLang() {
    let lang = localStorage.getItem("lang");
    if (!["ru", "uk"].includes(lang)) {
      lang = "uk";
    }

    this.intl.setLocale([lang]);
  }

  @action
  setLang(lang) {
    if (this.intl.primaryLocale === lang) {
      return;
    }

    localStorage.setItem("lang", lang);
    this.intl.setLocale([lang]);
    
    this.onChangeLangFn?.(lang);
  }

  onChangeLang(fn) {
    this.onChangeLangFn = fn;
  }
}
