import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { splitRouteParts } from '../services/route-optimizer';

export default class RouteResultComponent extends Component {
    @tracked isNaming = false;
    @tracked bookmarkName = '';
    @tracked actionError = null;

    @action
    openNaming() {
        this.bookmarkName = this.args.record?.name ?? '';
        this.isNaming = true;
        this.actionError = null;
    }

    @action
    updateBookmarkName(event) {
        this.bookmarkName = event.target.value;
    }

    @action
    saveBookmark(event) {
        event.preventDefault();
        try {
            this.args.onBookmark?.(this.args.record.id, this.bookmarkName);
            this.isNaming = false;
            this.actionError = null;
        } catch (error) {
            this.actionError = error.message;
        }
    }

    @action
    deleteRoute() {
        try {
            this.args.onDelete?.(this.args.record.id);
            this.actionError = null;
        } catch (error) {
            this.actionError = error.message;
        }
    }

    get distanceText() {
        const meters = this.args.route?.distanceMeters;
        if (!Number.isFinite(meters)) return null;

        return `${(meters / 1000).toLocaleString('uk-UA', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        })} км`;
    }

    get durationText() {
        const totalSeconds = this.args.route?.durationSeconds;
        if (!Number.isFinite(totalSeconds)) return null;

        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.round(totalSeconds % 60);
        const parts = [];

        if (hours) parts.push(`${hours} год`);
        if (minutes) parts.push(`${minutes} хв`);
        if (seconds || parts.length === 0) parts.push(`${seconds} с`);
        return parts.join(' ');
    }

    get routeParts() {
        const orderedStops = this.args.route?.orderedStops;
        const parts =
            Array.isArray(orderedStops) && orderedStops.length > 1
                ? splitRouteParts(orderedStops)
                : this.args.route?.routeParts ?? [];
        const lastPartIndex = parts.length - 1;

        return parts.map((part, partIndex) => ({
            ...part,
            stops: part.stops.map((stop, stopIndex) => ({
                ...stop,
                phone: (stop.phones ?? []).map((number) => ({
                    number,
                    href: `tel:${number}`,
                }))[0],
                visicomUrl: stop.vizcomId
                    ? `https://maps.visicom.ua/i/${encodeURIComponent(stop.vizcomId)}?lang=uk`
                    : null,
                isFinish: partIndex === lastPartIndex && stopIndex === part.stops.length - 1,
            })),
        }));
    }
}
