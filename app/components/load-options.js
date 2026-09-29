import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class SettingsComponent extends Component {
    @service intl;
    @service('app-settings') appSettings;

    @tracked loadAdditionalInfo;

    constructor() {
        super(...arguments);
        this.loadAdditionalInfo = this.appSettings.loadAdditionalInfo;
    }

    get loadName() {
        return this.loadAdditionalInfo ? 'Детально' : 'Швидко';
    }

    get isLoad() {
        return this.loadAdditionalInfo === true;
    }

    get isShow() {
        return this.appSettings.spreadsheetId;
    }

    get loadOptions() {
        return [
            {
                id: true,
                name: 'Шукати деталі адреси',
            },
            {
                id: false,
                name: 'Будувати швидко',
            },
        ];
    }

    onChange = (item) => {
        this.appSettings.saveLoadAdditionalInfo(item.id);
        this.loadAdditionalInfo = item.id;
    };
}
