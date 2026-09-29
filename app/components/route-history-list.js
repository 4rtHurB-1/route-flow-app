import Component from '@glimmer/component';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

export default class RouteHistoryListComponent extends Component {
  @service('route-history') routeHistory;
  @tracked openRouteId = null;

  get items() {
    return this.routeHistory.routes.map((item) => ({
      ...item,
      displayTitle: item.bookmarked ? item.name : item.title,
      isOpen: item.id === this.openRouteId,
    }));
  }

  @action
  toggleRoute(id) {
    this.openRouteId = this.openRouteId === id ? null : id;
  }

  @action
  bookmarkRoute(id, name) {
    this.routeHistory.bookmarkRoute(id, name);
  }

  @action
  deleteRoute(id) {
    this.routeHistory.deleteRoute(id);
    if (this.openRouteId === id) this.openRouteId = null;
  }
}
