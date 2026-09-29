import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

export default class IndexRoute extends Route {
    queryParams = {
        congID: {
            refreshModel: true,
            replace: true,
        },
        sheetID: {
            refreshModel: true,
            replace: true,
        },
        settings: {
            refreshModel: true,
            replace: true,
        },
        clear: {
            refreshModel: true,
            replace: true,
        },
    };

    @service lang;

    constructor() {
        super(...arguments);
        this.lang.setDefaultLang();
    }

    reloadWithoutQuery() {
        let url = new URL(window.location.href);
        url.search = '';
        window.location.href = url.toString();
    }

    async model(params, transition) {
        return {  };
    }
}
