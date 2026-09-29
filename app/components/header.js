import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class AuthAccountComponent extends Component {
    @service router;

    @tracked isShowVersion = false;
    clickTimeout;

    constructor() {
        super(...arguments);
    }

    pressTimeout = null;
    pressDuration = 600;

    startPress = (event) => {
        event.preventDefault();

        this.pressTimeout = setTimeout(() => {
            this.isShowVersion = true;
            setTimeout(() => {
                this.isShowVersion = false;
                this.loadNewVersion();
            }, 2000);
            this.pressTimeout = null;
        }, this.pressDuration);
    };

    endPress = (event) => {
        if (this.pressTimeout) {
            clearTimeout(this.pressTimeout);
            this.pressTimeout = null;
            window.location.reload(true);
        }
    };

    loadNewVersion = () => {
        let url = new URL(window.location.href);
        window.location.href = `${url.origin}/settings?newVersion=true`;
    };
}
