import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class RouteSettingsComponent extends Component {
  @service('app-settings') appSettings;

  @tracked spreadsheetUrl = '';
  @tracked visicomApiKey = '';
  @tracked errorMessage = null;
  @tracked saved = false;

  constructor() {
    super(...arguments);
    this.spreadsheetUrl = this.appSettings.spreadsheetUrl;
    this.visicomApiKey = this.appSettings.visicomApiKey;
  }

  @action
  updateSpreadsheetUrl(event) {
    this.spreadsheetUrl = event.target.value;
    this.saved = false;
  }

  @action
  updateVisicomApiKey(event) {
    this.visicomApiKey = event.target.value;
    this.saved = false;
  }

  @action
  save(event) {
    event.preventDefault();
    this.errorMessage = null;
    this.saved = false;
    try {
      this.appSettings.save({
        spreadsheetUrl: this.spreadsheetUrl,
        visicomApiKey: this.visicomApiKey,
      });
      this.saved = true;
    } catch (error) {
      this.errorMessage = error.message;
    }
  }
}
