import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class RouteBuilderComponent extends Component {
  @service('route-optimizer') routeOptimizer;
  @service('route-history') routeHistory;

  @tracked addresses = '';
  @tracked result = null;
  @tracked resultRecordId = null;
  @tracked errorMessage = null;
  @tracked isLoading = false;
  @tracked pendingMissing = null;
  @tracked resolutions = {};
  @tracked resolvedPoints = [];

  constructor(owner, args) {
    super(owner, args);
    this.addresses = args.initialAddresses ?? '';
  }

  get isSubmitDisabled() {
    return this.isLoading || !this.addresses.trim();
  }

  get resultRecord() {
    return this.routeHistory.routes.find((record) => record.id === this.resultRecordId);
  }

  get missingItems() {
    return (this.pendingMissing ?? []).map((item) => ({
      ...item,
      choice: this.resolutions[item.index] ?? { type: 'rename', address: item.address },
    }));
  }

  @action
  updateAddresses(event) {
    this.addresses = event.target.value;
    this.pendingMissing = null;
    this.resolvedPoints = [];
    this.resolutions = {};
  }

  @action
  chooseResolution(index, choice) {
    this.resolutions = { ...this.resolutions, [index]: choice };
  }

  @action
  bookmarkRoute(id, name) {
    this.routeHistory.bookmarkRoute(id, name);
  }

  @action
  async buildRoute(event) {
    event?.preventDefault();
    if (this.isSubmitDisabled) return;

    this.resolutions = {};
    this.resolvedPoints = [];
    this.pendingMissing = null;
    await this.runBuild();
  }

  @action
  async continueBuild(event) {
    console.log(this.isLoading);
    
    event?.preventDefault();
    if (this.isLoading || !this.pendingMissing) return;
    await this.runBuild();
  }

  async runBuild() {
    this.isLoading = true;
    this.errorMessage = null;
    this.result = null;
    this.resultRecordId = null;

    try {
      const result = await this.routeOptimizer.buildRoute({
        addresses: this.addresses,
        origin: this.args.origin,
        googleMapsApiKey: this.args.googleMapsApiKey,
        visicomApiKey: this.args.visicomApiKey,
        corrections: this.args.corrections ?? {},
        addressRepairer: this.args.addressRepairer,
        resolutions: this.resolutions,
        resolvedPoints: this.resolvedPoints,
      });
      this.result = result;
      this.pendingMissing = null;
      this.addresses = result.inputAddresses.join('\n');
      try {
        const record = this.routeHistory.saveRoute({ addresses: this.addresses, route: result });
        this.resultRecordId = record.id;
      } catch (error) {
        this.errorMessage = error.message;
      }
      this.args.onBuilt?.(this.result);
    } catch (error) {
      console.log(error);
      this.errorMessage = error?.message ?? 'Не вдалося побудувати маршрут.';
      if (error?.details?.missingEntries) {
        this.pendingMissing = error.details.missingEntries;
        this.resolvedPoints = error.details.resolvedPoints;
      }
      this.args.onError?.(error);
    } finally {
      this.isLoading = false;
    }
  }
}
