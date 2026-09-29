import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class HistoryRoute extends Route {
    @service lang;
    constructor() {
        super(...arguments);
        this.lang.setDefaultLang();
    }
}
