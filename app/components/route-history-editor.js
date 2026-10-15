import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class RouteHistoryEditorComponent extends Component {
    @service('route-optimizer') routeOptimizer;
    @service('route-history') routeHistory;

    @tracked addresses = '';
    @tracked isLoading = false;
    @tracked errorMessage = null;
    @tracked pendingMissing = null;
    @tracked resolutions = {};

    constructor() {
        super(...arguments);
        this.startEditing();
    }

    get missingItems() {
        return (this.pendingMissing ?? []).map((item) => ({
            ...item,
            choice: this.resolutions[item.index] ?? { type: 'rename', address: item.address },
        }));
    }

    @action
    startEditing() {
        this.addresses = (this.args.record.inputAddresses ?? this.args.record.route.inputAddresses ?? []).join('\n');
        this.resetLookup();
    }

    @action
    cancelEditing() {
        if (this.isLoading) return;
        this.args.onEndEdit();
        this.resetLookup();
    }

    resetLookup() {
        this.errorMessage = null;
        this.pendingMissing = null;
        this.resolutions = {};
    }

    @action
    changeAddresses(event) {
        this.addresses = event.target.value;
        this.resetLookup();
    }

    @action
    chooseResolution(index, choice) {
        this.resolutions = { ...this.resolutions, [index]: choice };
    }

    @action
    async updateRoute(event) {
        event?.preventDefault();
        if (this.isLoading) return;
        const addresses = this.addresses.split(/\r?\n/u).map((address) => address.trim()).filter(Boolean);
        if (!addresses.length) {
            this.errorMessage = 'Залиште або додайте хоча б одну адресу.';
            return;
        }
        this.isLoading = true;
        this.errorMessage = null;
        try {
            // Rebuild all points and details; never reuse the stored route or resolved points.
            const route = await this.routeOptimizer.buildRoute({
                addresses,
                resolutions: this.resolutions,
                resolvedPoints: [],
            });
            this.routeHistory.updateRoute(this.args.record.id, route);
            this.args.onEndEdit();
            this.resetLookup();
        } catch (error) {
            this.errorMessage = error?.message ?? 'Не вдалося оновити маршрут.';
            this.pendingMissing = error?.details?.missingEntries ?? null;
        } finally {
            this.isLoading = false;
        }
    }
}
